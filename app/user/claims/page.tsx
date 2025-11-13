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
};

export default function MyClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when messages load
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load user claims + items
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

      const finalClaims: Claim[] = [];
      for (const claim of claimRows) {
        const { data: itemData } = await supabase
          .from("items")
          .select("*")
          .eq("id", claim.item_id)
          .single();

        finalClaims.push({
          ...claim,
          item: itemData || null,
        });
      }

      setClaims(finalClaims);
      setLoading(false);
    }

    loadData();
  }, []);

  // Load messages in selected chat
  useEffect(() => {
    if (!selectedClaim) return;
    const claimId = selectedClaim.id;

    async function loadMessages() {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("claim_id", claimId)
        .order("created_at", { ascending: true });

      setMessages(data || []);
    }

    loadMessages();

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
      // call removeChannel but don't return its Promise to satisfy React's cleanup signature
      void supabase.removeChannel(channel);
    };
  }, [selectedClaim]);

  // Send message
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

  if (loading)
    return (
      <p className="text-center text-gray-400 pt-20">
        Loading your claims...
      </p>
    );

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-ubGold text-center mb-6">
        🧾 My Claims
      </h1>

      {/* CLAIM LIST */}
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
                className="bg-gray-900 p-4 rounded-xl shadow cursor-pointer border border-gray-800 hover:border-ubGold transition"
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
                  {claim.item?.name}
                </h2>

                <p className="text-gray-400 text-sm">
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
          {/* BACK BUTTON */}
          <button
            onClick={() => setSelectedClaim(null)}
            className="mb-4 px-4 py-2 bg-gray-800 rounded-lg text-white"
          >
            ← Back
          </button>

          {/* CHAT HEADER */}
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 mb-4">
            <h2 className="text-2xl font-bold text-white mb-1">
              {selectedClaim.item?.name}
            </h2>

            {/* CLAIM STATUS */}
            <span
              className={`px-3 py-1 text-xs rounded-full font-semibold ${
                selectedClaim.status === "approved"
                  ? "bg-green-600"
                  : selectedClaim.status === "rejected"
                  ? "bg-red-600"
                  : "bg-yellow-500"
              }`}
            >
              {selectedClaim.status?.toUpperCase()}
            </span>

            <p className="text-gray-400 text-sm mt-2">
              📍 Location: {selectedClaim.item?.location || "Unknown"}
            </p>
            <p className="text-gray-400 text-sm">
              🏫 Campus: {selectedClaim.item?.campus || "Unknown"}
            </p>

            {/* CLAIM MESSAGE BUBBLE */}
            <div className="mt-4 bg-ubGold text-black p-4 rounded-xl shadow">
              <p className="font-bold text-sm">Claim Message:</p>
              <p className="text-sm mt-1">{selectedClaim.message}</p>
            </div>
          </div>

          {/* CHAT MESSAGES */}
          <div className="h-[60vh] overflow-y-auto space-y-3 p-2 bg-gray-900 rounded-lg border border-gray-700">
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
                  className={`p-3 rounded-xl max-w-[70%] shadow ${
                    msg.sender_id === user?.id
                      ? "bg-ubGold text-black"
                      : "bg-gray-800 text-white border border-gray-700"
                  }`}
                >
                  <p
                    className={`text-[10px] mb-1 font-bold ${
                      msg.sender_id === user?.id
                        ? "text-black"
                        : "text-ubGold"
                    }`}
                  >
                    {msg.sender_id === user?.id ? "YOU" : "ADMIN"}
                  </p>

                  <p>{msg.content}</p>

                  <p className="text-[10px] opacity-60 mt-1 text-right">
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

          {/* MESSAGE INPUT */}
          <form
            onSubmit={sendMessage}
            className="flex gap-2 mt-3 border-t border-gray-700 pt-3"
          >
            <input
              type="text"
              name="message"
              placeholder="Type your message..."
              className="flex-1 px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700"
            />
            <button className="px-4 py-2 bg-ubGold text-black rounded-lg font-bold">
              Send
            </button>
          </form>
        </>
      )}
    </div>
  );
}
