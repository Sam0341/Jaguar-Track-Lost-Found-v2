"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

// 🧱 Data Types
type Item = {
  id: string;
  name: string;
  campus: string | null;
  description: string | null;
  image: string | null;
  category?: string | null;
};

type Claim = {
  id: string;
  item_id: string;
  status: string | null;
  message: string | null;
  created_at: string;
  items?: Item;
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
  const [newMessage, setNewMessage] = useState("");
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 🔹 Auto-scroll when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 🔹 Load claims for the logged-in user
  useEffect(() => {
    async function loadClaims() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("claims")
        .select(
          `
          id,
          item_id,
          message,
          status,
          created_at,
          items:item_id (
            id,
            name,
            campus,
            description,
            image
          )
        `
        )
        .eq("claimed_by", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading claims:", error);
      } else {
        // ✅ Flatten items and attach public image URLs
        const formatted = (data || []).map((c: any) => {
          const item = Array.isArray(c.items) ? c.items[0] : c.items;

          // 🖼️ Convert storage path to public URL
          let imageUrl = null;
          if (item?.image) {
            const { data: publicData } = supabase.storage
              .from("item-images") // 🔸 your bucket name here
              .getPublicUrl(item.image);
            imageUrl = publicData?.publicUrl || null;
          }

          return {
            ...c,
            items: {
              ...item,
              image: imageUrl,
            },
          };
        });
        setClaims(formatted);
      }

      setLoading(false);
    }

    loadClaims();
  }, []);

  // 🔹 Load messages for selected claim
  useEffect(() => {
    const claimId = selectedClaim?.id;
    if (!claimId) return;

    async function loadMessages() {
      const { data, error } = await supabase
        .from("messages")
        .select(`*, profiles:sender_id(full_name, email)`)
        .eq("claim_id", claimId)
        .order("created_at", { ascending: true });

      if (!error && data) {
        setMessages(data);
      } else if (error) {
        console.error("Error loading messages:", error);
      }
    }

    loadMessages();

    // 🔁 Realtime updates
    const channel = supabase
      .channel(`messages:claim=${claimId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `claim_id=eq.${claimId}`,
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

  // 📨 Send new message
  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !selectedClaim || !user) return;

    const { error } = await supabase.from("messages").insert([
      {
        claim_id: selectedClaim.id,
        sender_id: user.id,
        content: newMessage.trim(),
        is_admin: false,
      },
    ]);

    if (error) console.error("Error sending message:", error);
    else setNewMessage("");
  }

  // 🗓️ Format timestamp
  const formatDate = (date: string) =>
    new Date(date).toLocaleString("en-BZ", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  // ⏳ Loading Screen
  if (loading)
    return (
      <div className="flex justify-center items-center h-[70vh] text-gray-500 dark:text-gray-400">
        Loading your claims...
      </div>
    );

  // 🧱 Page Layout
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-ubGold mb-6 text-center">
        🧾 My Claims
      </h1>

      {/* 💡 Claims List View */}
      {!selectedClaim ? (
        claims.length === 0 ? (
          <p className="text-center text-gray-400">
            You haven’t made any claims yet.
          </p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {claims.map((claim) => (
              <div
                key={claim.id}
                className="p-5 bg-white dark:bg-gray-900 rounded-xl border border-gray-300 dark:border-gray-700 shadow hover:shadow-lg transition cursor-pointer"
                onClick={() => setSelectedClaim(claim)}
              >
                <img
                  src={
                    claim.items?.image ||
                    "https://placehold.co/400x300?text=No+Image"
                  }
                  alt={claim.items?.name || "Item"}
                  className="w-full h-40 object-cover rounded-lg mb-3"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      "https://placehold.co/400x300?text=No+Image";
                  }}
                />
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  {claim.items?.name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  {claim.items?.campus}
                </p>
                <p className="text-sm mb-2 text-gray-400">
                  {claim.message || "No message provided."}
                </p>
                <span
                  className={`px-3 py-1 text-xs font-medium rounded-full ${
                    claim.status?.toLowerCase() === "approved"
                      ? "bg-green-600 text-white"
                      : claim.status?.toLowerCase() === "rejected"
                      ? "bg-red-600 text-white"
                      : "bg-yellow-500 text-white"
                  }`}
                >
                  {claim.status
                    ? claim.status.charAt(0).toUpperCase() +
                      claim.status.slice(1)
                    : "Pending"}
                </span>
              </div>
            ))}
          </div>
        )
      ) : (
        // 💬 Chat View
        <div className="max-w-3xl mx-auto bg-gray-900 text-white rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gray-800 px-5 py-3 flex justify-between items-center border-b border-gray-700">
            <div>
              <h2 className="text-lg font-semibold">
                {selectedClaim.items?.name}
              </h2>
              <p className="text-xs text-gray-400">
                {selectedClaim.items?.campus} •{" "}
                {formatDate(selectedClaim.created_at)}
              </p>
            </div>
            <button
              onClick={() => setSelectedClaim(null)}
              className="text-sm text-gray-300 hover:text-white bg-gray-700 px-3 py-1 rounded-md"
            >
              ← Back
            </button>
          </div>

          {/* Messages */}
          <div className="p-4 h-[65vh] overflow-y-auto space-y-3">
            {messages.map((msg) => {
              const isUser = msg.sender_id === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`p-3 rounded-2xl max-w-[75%] ${
                      isUser
                        ? "bg-ubGold text-black"
                        : "bg-gray-800 text-gray-100 border border-gray-700"
                    }`}
                  >
                    {!isUser && (
                      <p className="text-xs text-gray-400 mb-1">
                        {msg.profiles?.full_name || "Admin"}
                      </p>
                    )}
                    <p>{msg.content}</p>
                    <p className="text-[10px] mt-1 text-gray-400 text-right">
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={sendMessage}
            className="p-4 border-t border-gray-700 flex items-center space-x-2 bg-gray-800"
          >
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-4 py-2 rounded-lg bg-gray-900 border border-gray-700 text-white outline-none focus:ring-2 focus:ring-ubGold"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-ubGold text-black font-semibold rounded-lg hover:bg-yellow-400"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
