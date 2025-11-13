"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

// 🧱 Data Types
type Item = {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
  campus?: string | null;
  location?: string | null;
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

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load CLAIMS + USER
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

      // FIXED QUERY — correct campus relation
      const { data, error } = await supabase
        .from("claims")
        .select(`
          id,
          item_id,
          message,
          status,
          created_at,
          items:item_id (
            id,
            name,
            description,
            image,
            location,
            campus:campus_id ( name )
          )
        `)
        .eq("claimed_by", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        const formatted = data.map((c: any) => {
          const raw = Array.isArray(c.items) ? c.items[0] : c.items;

          let imageUrl = null;
          if (raw?.image) {
            const { data: publicData } = supabase.storage
              .from("item-photos")
              .getPublicUrl(raw.image);
            imageUrl = publicData?.publicUrl || null;
          }

          return {
            ...c,
            items: {
              ...raw,
              image: imageUrl,
              campus: raw?.campus?.name || "Unknown Campus",
            },
          };
        });

        setClaims(formatted);
      }

      setLoading(false);
    }

    loadClaims();
  }, []);

  // Load CHAT for a selected claim
  useEffect(() => {
    const claimId = selectedClaim?.id;
    if (!claimId) return;

    async function loadMessages() {
      const { data } = await supabase
        .from("messages")
        .select(`*, profiles:sender_id(full_name, email)`)
        .eq("claim_id", claimId)
        .order("created_at", { ascending: true });

      if (data) setMessages(data);
    }

    loadMessages();

    // Real-time updates
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

  // Send a message
  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !selectedClaim || !user) return;

    await supabase.from("messages").insert([
      {
        claim_id: selectedClaim.id,
        sender_id: user.id,
        content: newMessage.trim(),
        is_admin: false,
      },
    ]);

    setNewMessage("");
  }

  const formatDate = (date: string) =>
    new Date(date).toLocaleString("en-BZ", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  // -----------------------------
  //            UI
  // -----------------------------

  if (loading)
    return (
      <div className="flex justify-center items-center h-[60vh] text-gray-500">
        Loading your claims...
      </div>
    );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-ubGold mb-6 text-center">
        🧾 My Claims
      </h1>

      {/* LIST VIEW */}
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
                className="p-5 bg-white dark:bg-gray-900 rounded-xl border border-gray-300 dark:border-gray-700 shadow hover:shadow-lg cursor-pointer transition"
                onClick={() => setSelectedClaim(claim)}
              >
                <img
                  src={
                    claim.items?.image ||
                    "https://placehold.co/400x300?text=No+Image"
                  }
                  className="w-full h-40 object-cover rounded-lg mb-3"
                />

                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {claim.items?.name}
                </h2>

                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {claim.items?.campus}
                </p>

                <p className="text-sm text-gray-400 line-clamp-2 mt-2">
                  {claim.message || "No message provided."}
                </p>

                <span
                  className={`px-3 py-1 mt-3 inline-block text-xs rounded-full font-medium ${
                    claim.status === "approved"
                      ? "bg-green-600 text-white"
                      : claim.status === "rejected"
                      ? "bg-red-600 text-white"
                      : "bg-yellow-500 text-black"
                  }`}
                >
                  {claim.status}
                </span>
              </div>
            ))}
          </div>
        )
      ) : (
        // CHAT VIEW
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

          {/* Item Preview */}
          <div className="bg-gray-800 p-4 flex items-center gap-4 border-b border-gray-700">
            <img
              src={
                selectedClaim.items?.image ||
                "https://placehold.co/200x200?text=No+Image"
              }
              className="w-20 h-20 object-cover rounded-lg border border-gray-600"
            />
            <div>
              <p className="text-sm text-gray-300 italic">
                {selectedClaim.items?.description}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="p-4 h-[55vh] overflow-y-auto space-y-3">
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
                        : "bg-gray-800 border border-gray-700"
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
            className="p-4 border-t border-gray-700 flex space-x-2 bg-gray-800"
          >
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-4 py-2 rounded-lg bg-gray-900 border border-gray-700 text-white focus:ring-2 focus:ring-ubGold"
            />

            <button
              type="submit"
              className="px-5 py-2 bg-ubGold text-black font-semibold rounded-lg hover:bg-yellow-400"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
