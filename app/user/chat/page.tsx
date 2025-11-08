"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

type Claim = {
  id: string;
  status: string | null;
  created_at: string;
  items: {
    id: string;
    name: string;
    image: string | null;
    campus: string | null;
    category: string | null;
  } | null;
};

type Message = {
  id: string;
  claim_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export default function MyClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");

  // 🧠 Load user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user));
  }, []);

  // 📦 Load user's claims
  useEffect(() => {
    async function fetchClaims() {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) return;

      const { data, error } = await supabase
        .from("claims")
        .select(
          `
          id,
          status,
          created_at,
          items (
            id,
            name,
            image,
            campus,
            category
          )
        `
        )
        .eq("claimed_by", user.id)
        .order("created_at", { ascending: false });

      if (!error) setClaims(data || []);
      setLoading(false);
    }

    fetchClaims();
  }, []);

  // 📨 Load messages for active chat
  useEffect(() => {
    if (!activeChat) return;

    async function fetchMessages() {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("claim_id", activeChat)
        .order("created_at", { ascending: true });

      if (!error) setMessages(data || []);
    }

    fetchMessages();

    // 🔁 Real-time subscription
    const channel = supabase
      .channel(`messages:claim_${activeChat}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `claim_id=eq.${activeChat}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChat]);

  // ✉️ Send message
  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !user || !activeChat) return;

    const { error } = await supabase.from("messages").insert([
      {
        claim_id: activeChat,
        sender_id: user.id,
        content: newMessage.trim(),
      },
    ]);

    if (!error) setNewMessage("");
  }

  const formatDate = (date: string) =>
    new Date(date).toLocaleString("en-BZ", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (loading)
    return (
      <div className="text-center py-16 text-gray-400">
        Loading your claims...
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold text-ubGold mb-6">My Claimed Items</h1>

      {claims.length === 0 ? (
        <p className="text-gray-400 text-center">
          You haven’t made any claims yet.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
          {claims.map((claim) => {
            const item = claim.items;
            const imageSrc = item?.image
              ? item.image.startsWith("http")
                ? item.image
                : `https://npudlbublntelxzmzlmu.supabase.co/storage/v1/object/public/item-photos/${item.image}`
              : "https://placehold.co/300x200?text=No+Image";

            return (
              <div
                key={claim.id}
                className="bg-gray-900 text-white rounded-xl border border-gray-700 shadow-lg overflow-hidden flex flex-col"
              >
                <img
                  src={imageSrc}
                  alt={item?.name || "Item"}
                  className="h-40 w-full object-cover"
                  onError={(e) =>
                    ((e.target as HTMLImageElement).src =
                      "https://placehold.co/300x200?text=Image+Unavailable")
                  }
                />

                <div className="p-4 flex flex-col justify-between flex-1">
                  <div>
                    <h2 className="text-lg font-semibold">{item?.name}</h2>
                    <p className="text-sm text-gray-400 mt-1">
                      {item?.category || "Uncategorized"} •{" "}
                      {item?.campus || "Unknown campus"}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      Claimed on {formatDate(claim.created_at)}
                    </p>
                  </div>

                  <div className="mt-4">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        claim.status?.toLowerCase() === "approved"
                          ? "bg-green-600 text-white"
                          : claim.status?.toLowerCase() === "rejected"
                          ? "bg-red-600 text-white"
                          : "bg-yellow-500 text-black"
                      }`}
                    >
                      {claim.status
                        ? claim.status.charAt(0).toUpperCase() +
                          claim.status.slice(1)
                        : "Pending"}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2">
                    <button
                      onClick={() =>
                        setActiveChat(activeChat === claim.id ? null : claim.id)
                      }
                      className="block w-full text-center bg-ubGold text-black font-semibold py-2 rounded-lg hover:bg-yellow-400 transition"
                    >
                      💬 {activeChat === claim.id ? "Close Chat" : "Chat with Admin"}
                    </button>

                    {item && (
                      <Link
                        href={`/items/${item.id}`}
                        className="block w-full text-center bg-blue-600 text-white font-semibold py-2 rounded-lg hover:bg-blue-700 transition"
                      >
                        🔍 View Item
                      </Link>
                    )}
                  </div>

                  {/* 💬 Chat Section */}
                  {activeChat === claim.id && (
                    <div className="mt-4 p-3 rounded-lg bg-gray-800 border border-gray-700">
                      <div className="h-48 overflow-y-auto space-y-2 mb-3">
                        {messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${
                              msg.sender_id === user?.id
                                ? "justify-end"
                                : "justify-start"
                            }`}
                          >
                            <span
                              className={`px-3 py-2 rounded-lg text-sm ${
                                msg.sender_id === user?.id
                                  ? "bg-blue-600 text-white"
                                  : "bg-gray-600 text-white"
                              }`}
                            >
                              {msg.content}
                            </span>
                          </div>
                        ))}
                        {messages.length === 0 && (
                          <p className="text-center text-gray-400 text-sm">
                            No messages yet. Start chatting below 👇
                          </p>
                        )}
                      </div>

                      <form onSubmit={handleSendMessage} className="flex gap-2">
                        <input
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Type your message..."
                          className="flex-1 p-2 rounded-lg bg-gray-900 text-white border border-gray-700 outline-none focus:ring-2 focus:ring-ubGold"
                        />
                        <button
                          type="submit"
                          className="bg-blue-600 hover:bg-blue-700 px-4 rounded-lg text-white font-semibold transition"
                        >
                          ➤
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
