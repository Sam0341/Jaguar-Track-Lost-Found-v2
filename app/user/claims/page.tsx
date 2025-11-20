"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

// TYPES
type Item = {
  id: string;
  name: string;
  campus: string | null;
  description: string | null;
  image: string | null;
  location: string | null;
};

type Claim = {
  id: string;
  item_id: string;
  claimed_by: string;
  message: string | null;
  status: string | null;
  created_at: string;
  item?: Item;
};

type Message = {
  id: string;
  claim_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_admin: boolean;
  profiles?: {
    full_name: string | null;
    email: string | null;
  };
};

export default function MyClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // AUTO SCROLL
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // LOAD CLAIMS + ITEMS
  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user);
      if (!user) return setLoading(false);

      const { data: claimRows } = await supabase
        .from("claims")
        .select("*")
        .eq("claimed_by", user.id)
        .order("created_at", { ascending: false });

      if (!claimRows || claimRows.length === 0) {
        setClaims([]);
        setLoading(false);
        return;
      }

      const finalClaims = [];

      for (const claim of claimRows) {
        const { data: itemData } = await supabase
          .from("items")
          .select("*")
          .eq("id", claim.item_id)
          .single();

        // FIX IMAGE (convert supabase path → public URL)
        let imageUrl = null;
        if (itemData?.image) {
          const { data: bucket } = supabase.storage
            .from("item-photos")
            .getPublicUrl(itemData.image);
          imageUrl = bucket?.publicUrl || null;
        }

        finalClaims.push({
          ...claim,
          item: itemData
            ? {
                ...itemData,
                image: imageUrl,
              }
            : null,
        });
      }

      setClaims(finalClaims);
      setLoading(false);
    }

    loadData();
  }, []);

  // LOAD MESSAGES FOR CHAT VIEW
  useEffect(() => {
    if (!selectedClaim) return;

    const claimId = selectedClaim.id;

    async function loadMessages() {
      const { data } = await supabase
        .from("messages")
        .select("*, profiles:sender_id(full_name,email)")
        .eq("claim_id", claimId)
        .order("created_at", { ascending: true });

      setMessages(data || []);
    }

    loadMessages();

    // LIVE CHAT LISTENER
    const channel = supabase
      .channel(`claim-${claimId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          table: "messages",
          filter: `claim_id=eq.${claimId}`,
          schema: "public",
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedClaim]);

  // SEND MESSAGE
  async function sendMessage(e: any) {
    e.preventDefault();
    const input = e.target.elements.message;
    const content = input.value.trim();

    if (!content || !user || !selectedClaim) return;

    await supabase.from("messages").insert([
      {
        claim_id: selectedClaim.id,
        sender_id: user.id,
        content,
        is_admin: false,
      },
    ]);

    input.value = "";
  }

  // UI STARTS HERE --------------------------

  if (loading)
    return (
      <p className="text-center text-gray-400 pt-20">Loading your claims...</p>
    );

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-ubGold text-center mb-6">
        🧾 My Claims
      </h1>

      {/* CLAIM LIST VIEW */}
      {!selectedClaim ? (
        claims.length === 0 ? (
          <p className="text-center text-gray-400">
            You haven’t made any claims yet.
          </p>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {claims.map((claim) => (
              <div
                key={claim.id}
                className="bg-gray-900 p-4 rounded-xl border border-gray-800 hover:border-ubGold cursor-pointer transition"
                onClick={() => setSelectedClaim(claim)}
              >
                <img
                  src={
                    claim.item?.image ||
                    "https://placehold.co/400x300?text=No+Image"
                  }
                  className="w-full h-40 object-cover rounded-lg mb-3"
                />

                <h2 className="text-lg font-semibold text-white">
                  {claim.item?.name || "Unknown Item"}
                </h2>

                <p className="text-gray-500 text-sm">
                  {claim.item?.campus || "No campus"}
                </p>

                <p className="text-gray-400 text-sm mt-2 line-clamp-2">
                  {claim.message}
                </p>

                <span
                  className={`mt-3 inline-block px-3 py-1 text-xs rounded-full ${
                    claim.status === "approved"
                      ? "bg-green-600"
                      : claim.status === "rejected"
                      ? "bg-red-600"
                      : "bg-yellow-500"
                  } text-white`}
                >
                  {claim.status}
                </span>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          {/* CHAT VIEW */}
          <button
            onClick={() => setSelectedClaim(null)}
            className="mb-4 px-4 py-2 bg-gray-800 text-white rounded-lg"
          >
            ← Back
          </button>

          <div className="bg-gray-900 rounded-xl shadow p-4">
            {/* ITEM TITLE */}
            <h2 className="text-xl font-bold text-white mb-2">
              {selectedClaim.item?.name}
            </h2>

            {/* ITEM DESCRIPTION */}
            <p className="text-gray-300 text-sm mb-2">
              {selectedClaim.item?.description}
            </p>

            {/* LOCATION + CAMPUS */}
            <p className="text-gray-400 text-xs mb-1">
              📍 Location: {selectedClaim.item?.location || "Unknown"}
            </p>
            <p className="text-gray-400 text-xs mb-3">
              🏫 Campus: {selectedClaim.item?.campus || "Unknown"}
            </p>

            {/* CLAIM MESSAGE (THE USER'S REASON) */}
            {selectedClaim.message && (
              <div className="mt-2 p-3 bg-gray-800 border border-gray-700 rounded-lg mb-4">
                <p className="text-sm text-gray-300">
                  <span className="font-semibold text-ubGold">
                    Claim Message:
                  </span>
                  <br />
                  {selectedClaim.message}
                </p>
              </div>
            )}

            {/* MESSAGES */}
            <div className="h-[55vh] overflow-y-auto space-y-3 mb-4 p-2 border-t border-b border-gray-700">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.sender_id === user?.id
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <div
                    className={`p-3 rounded-xl max-w-[70%] ${
                      msg.sender_id === user?.id
                        ? "bg-ubGold text-black"
                        : "bg-gray-800 text-white"
                    }`}
                  >
                    <p>{msg.content}</p>

                    <p className="text-[10px] opacity-60 mt-1">
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}

              <div ref={messagesEndRef} />
            </div>

            {/* INPUT */}
            <form
              onSubmit={sendMessage}
              className="flex gap-2 border-t border-gray-700 pt-3"
            >
              <input
                type="text"
                name="message"
                placeholder="Type your message..."
                className="flex-1 px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700"
              />
              <button className="px-4 py-2 bg-ubGold text-black rounded-lg">
                Send
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
