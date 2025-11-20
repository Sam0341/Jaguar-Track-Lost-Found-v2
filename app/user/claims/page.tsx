"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

/* TYPES */
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
  image_url?: string | null;
  profiles?: { full_name: string | null; email: string | null };
};

export default function MyClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* AUTO SCROLL */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* LOAD CLAIMS */
  useEffect(() => {
    async function loadClaims() {
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

      if (!claimRows) {
        setClaims([]);
        setLoading(false);
        return;
      }

      const fullClaims = [];

      for (const claim of claimRows) {
        const { data: item } = await supabase
          .from("items")
          .select("*")
          .eq("id", claim.item_id)
          .single();

        let imageUrl = null;
        if (item?.image) {
          const { data: url } = supabase.storage
            .from("item-photos")
            .getPublicUrl(item.image);
          imageUrl = url.publicUrl;
        }

        fullClaims.push({
          ...claim,
          item: item
            ? {
                ...item,
                image: imageUrl,
              }
            : null,
        });
      }

      setClaims(fullClaims);
      setLoading(false);
    }

    loadClaims();
  }, []);

  /* LOAD MESSAGES + REALTIME */
  useEffect(() => {
    if (!selectedClaim) return;

    async function loadMessages() {
      const { data } = await supabase
        .from("messages")
        .select("*, profiles:sender_id(full_name,email)")
        .eq("claim_id", selectedClaim.id)
        .order("created_at", { ascending: true });

      setMessages(data || []);
    }

    loadMessages();

    const channel = supabase
      .channel(`claim-${selectedClaim.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          table: "messages",
          filter: `claim_id=eq.${selectedClaim.id}`,
          schema: "public",
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [selectedClaim]);

  /* SEND MESSAGE (TEXT + IMAGE) */
  async function sendMessage(e: any) {
    e.preventDefault();

    if (!selectedClaim || !user) return;

    const text = e.target.elements.message.value.trim();
    const file = e.target.elements.image.files[0] || null;

    if (!text && !file) return;

    const form = new FormData();
    form.append("claim_id", selectedClaim.id);
    form.append("content", text);
    if (file) form.append("image", file);

    await fetch("/api/messages", { method: "POST", body: form });

    e.target.reset();
  }

  /* UI ------------------------------------------------------------ */

  if (loading)
    return (
      <p className="text-center text-gray-400 pt-20">Loading your claims...</p>
    );

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-ubGold text-center mb-6">
        🧾 My Claims
      </h1>

      {!selectedClaim ? (
        /* CLAIM LIST */
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
                <p className="text-gray-500 text-sm">{claim.item?.campus}</p>
                <p className="text-gray-400 text-sm mt-2 line-clamp-2">
                  {claim.message}
                </p>

                <span
                  className={`mt-3 inline-block px-3 py-1 text-xs rounded-full 
                    ${
                      claim.status === "approved"
                        ? "bg-green-600"
                        : claim.status === "rejected"
                        ? "bg-red-600"
                        : "bg-yellow-500"
                    }
                    text-white`}
                >
                  {claim.status}
                </span>
              </div>
            ))}
          </div>
        )
      ) : (
        /* CHAT VIEW */
        <>
          <button
            onClick={() => setSelectedClaim(null)}
            className="mb-4 px-4 py-2 bg-gray-800 text-white rounded-lg"
          >
            ← Back
          </button>

          <div className="bg-gray-900 rounded-xl shadow p-4">
            <h2 className="text-xl font-bold text-white mb-2">
              {selectedClaim.item?.name}
            </h2>

            <p className="text-gray-300 text-sm mb-2">
              {selectedClaim.item?.description}
            </p>

            <div className="h-[55vh] overflow-y-auto space-y-3 mb-4 p-2 border-t border-b border-gray-700">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.sender_id === user.id ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`p-3 rounded-xl max-w-[70%] ${
                      msg.sender_id === user.id
                        ? "bg-ubGold text-black"
                        : "bg-gray-800 text-white"
                    }`}
                  >
                    {/* IMAGE */}
                    {msg.image_url && (
                      <img
                        src={msg.image_url}
                        className="w-40 rounded-lg mb-2 cursor-pointer"
                        onClick={() => window.open(msg.image_url, "_blank")}
                      />
                    )}

                    {/* TEXT */}
                    {msg.content !== "[image]" && <p>{msg.content}</p>}

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

            {/* INPUT BOX */}
            <form
              onSubmit={sendMessage}
              className="flex gap-2 border-t border-gray-700 pt-3"
              encType="multipart/form-data"
            >
              <label className="cursor-pointer bg-gray-800 px-3 py-2 rounded-lg border border-gray-700 text-white">
                📎
                <input type="file" name="image" className="hidden" />
              </label>

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
          </div>
        </>
      )}
    </div>
  );
}
