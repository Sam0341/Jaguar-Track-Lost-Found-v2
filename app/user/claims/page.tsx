"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

// TYPES ----------------------------------------
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
  item?: Item | null;
};

type Message = {
  id: string;
  claim_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_admin: boolean;
  profiles?: { full_name: string | null; email: string | null };
};

export default function MyClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  const [adminTyping, setAdminTyping] = useState(false);
  const [user, setUser] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll -------------------------
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load claims -------------------------
  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      if (!user) return;

      const { data: claimRows } = await supabase
        .from("claims")
        .select("*")
        .eq("claimed_by", user.id)
        .order("created_at", { ascending: false });

      const finalClaims: Claim[] = [];

      for (const c of claimRows ?? []) {
        const { data: item } = await supabase
          .from("items")
          .select("*")
          .eq("id", c.item_id)
          .single();

        let imageURL = null;
        if (item?.image) {
          const { data } = supabase.storage
            .from("item-photos")
            .getPublicUrl(item.image);
          imageURL = data?.publicUrl || null;
        }

        finalClaims.push({
          ...c,
          item: {
            ...item,
            image: imageURL,
          },
        });
      }

      setClaims(finalClaims);
    }

    loadData();
  }, []);

  // Load messages when selecting a claim -------------------------
    useEffect(() => {
      if (!selectedClaim) return;
  
      const claimId = selectedClaim.id;
  
      async function loadMessages() {
        const { data } = await supabase
          .from("messages")
          .select("*, profiles:sender_id(full_name,email)")
          .eq("claim_id", claimId)
          .order("created_at", { ascending: true });
  
        setMessages(data ?? []);
      }
  
      loadMessages();
  
      const channel = supabase
        .channel(`claim-${claimId}`)
        .on(
          "postgres_changes" as any,
          {
            event: "INSERT",
            table: "messages",
            filter: `claim_id=eq.${claimId}`,
          } as any,
          (payload: any) => {
            setMessages((prev) => [...prev, payload.new as Message]);
          }
        )
        .on("broadcast", { event: "typing" }, (payload) => {
          if (!payload.payload) return;
  
          const fromAdmin = payload.payload.is_admin;
  
          if (fromAdmin) {
            setAdminTyping(true);
            setTimeout(() => setAdminTyping(false), 1500);
          }
        })
        .subscribe();
  
      return () => {
        // fire-and-forget removal; do not return a Promise from effect cleanup
        void supabase.removeChannel(channel);
      };
    }, [selectedClaim]);

  // Send message -------------------------
  async function sendMessage(e: any) {
    e.preventDefault();
    const content = e.target.elements.message.value.trim();

    if (!content || !user || !selectedClaim) return;

    await supabase.from("messages").insert([
      {
        claim_id: selectedClaim.id,
        sender_id: user.id,
        content,
        is_admin: false,
      },
    ]);

    e.target.reset();
  }

  // Typing indicator -------------------------
  function handleTyping(e: any) {
    if (!selectedClaim) return;

    setTyping(true);

    if (typingTimeout.current) clearTimeout(typingTimeout.current);

    typingTimeout.current = setTimeout(() => setTyping(false), 1500);

    supabase.channel(`claim-${selectedClaim.id}`).send({
      type: "broadcast",
      event: "typing",
      payload: { is_admin: false },
    });
  }

  // UI -----------------------------------------------------------
  return (
    <div className="max-w-6xl mx-auto p-6">
      {!selectedClaim ? (
        <>
          <h1 className="text-3xl font-bold text-ubGold text-center mb-6">
            🧾 My Claims
          </h1>

          {claims.length === 0 ? (
            <p className="text-center text-gray-500">You haven't made any claims.</p>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
              {claims.map((claim) => (
                <div
                  key={claim.id}
                  onClick={() => setSelectedClaim(claim)}
                  className="bg-gray-900 border border-gray-700 p-4 rounded-xl shadow hover:border-ubGold cursor-pointer transition"
                >
                  <img
                    src={
                      claim.item?.image ||
                      "https://placehold.co/600x400?text=No+Image"
                    }
                    className="w-full h-44 object-cover rounded-lg mb-3"
                  />

                  <h2 className="text-lg text-white font-semibold">
                    {claim.item?.name}
                  </h2>

                  <p className="text-gray-400 text-sm">
                    {claim.item?.campus || "Unknown campus"}
                  </p>

                  <p className="text-gray-500 mt-2 line-clamp-2">
                    {claim.message}
                  </p>

                  <span
                    className={`inline-block mt-3 px-3 py-1 text-xs rounded-full text-white ${
                      claim.status === "approved"
                        ? "bg-green-600"
                        : claim.status === "rejected"
                        ? "bg-red-600"
                        : "bg-yellow-600"
                    }`}
                  >
                    {claim.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div>
          <button
            onClick={() => setSelectedClaim(null)}
            className="mb-4 px-4 py-2 bg-gray-800 rounded-lg text-white"
          >
            ← Back
          </button>

          {/* ITEM DETAILS SIDEBAR */}
          <div className="bg-gray-900 rounded-xl shadow p-5 border border-gray-700">
            <h2 className="text-2xl font-black text-white mb-3">
              {selectedClaim.item?.name}
            </h2>

            <img
              src={
                selectedClaim.item?.image ||
                "https://placehold.co/600x400?text=No+Image"
              }
              className="w-full max-h-64 object-cover rounded-lg mb-4 cursor-pointer"
            />

            <p className="text-gray-300">
              <strong>Description:</strong>{" "}
              {selectedClaim.item?.description || "No description"}
            </p>

            <p className="text-gray-300 mt-1">
              <strong>Location:</strong>{" "}
              {selectedClaim.item?.location || "Unknown"}
            </p>

            <p className="text-gray-300 mt-1">
              <strong>Campus:</strong>{" "}
              {selectedClaim.item?.campus || "Unknown"}
            </p>

            <hr className="border-gray-700 my-4" />

            {/* CHAT BOX */}
            <div className="h-[55vh] overflow-y-auto bg-gray-800/40 p-4 rounded-lg border border-gray-700 space-y-3">
              {messages.map((msg) => {
                const isMe = msg.sender_id === user?.id;
                const isImage = msg.content.includes("supabase.co");

                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`p-3 rounded-xl max-w-[70%] ${
                        isMe
                          ? "bg-ubGold text-black"
                          : "bg-gray-800 text-white"
                      }`}
                    >
                      {isImage ? (
                        <img
                          src={msg.content}
                          className="rounded-lg max-h-52 cursor-pointer"
                        />
                      ) : (
                        <p>{msg.content}</p>
                      )}

                      <p className="text-[10px] opacity-60 mt-1">
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}

              {adminTyping && (
                <p className="text-xs text-gray-400 italic">Admin is typing…</p>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* INPUT BOX */}
            <form onSubmit={sendMessage} className="flex gap-2 mt-4">
              <input
                type="text"
                name="message"
                onChange={handleTyping}
                placeholder="Type your message…"
                className="flex-1 px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700"
              />
              <button className="px-4 py-2 bg-ubGold text-black rounded-lg">
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
