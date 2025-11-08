"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

// 🔹 Reusable Chat Component
function ClaimChat({
  claimId,
  onClose,
}: {
  claimId: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [user, setUser] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load messages + session
  useEffect(() => {
    async function loadChat() {
      const { data: userData } = await supabase.auth.getUser();
      setUser(userData?.user);

      const { data, error } = await supabase
        .from("messages")
        .select(`*, profiles:sender_id(full_name,email)`)
        .eq("claim_id", claimId)
        .order("created_at", { ascending: true });

      if (!error && data) setMessages(data);
    }
    loadChat();

    // Realtime subscription
    const channel = supabase
      .channel(`messages:claim_${claimId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `claim_id=eq.${claimId}`,
        },
        (payload) => setMessages((prev) => [...prev, payload.new])
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [claimId]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    await supabase.from("messages").insert([
      {
        claim_id: claimId,
        sender_id: user.id,
        content: newMessage.trim(),
        is_admin: user?.user_metadata?.role === "admin",
      },
    ]);
    setNewMessage("");
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
      <div className="w-full sm:w-[420px] h-full bg-gray-900 text-white flex flex-col shadow-2xl animate-slide-in">
        <div className="flex justify-between items-center px-4 py-3 border-b border-gray-700">
          <h2 className="font-bold text-ubGold text-lg">Claim Chat</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-lg"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
                      : "bg-gray-800 text-white border border-gray-700"
                  }`}
                >
                  {!isUser && (
                    <p className="text-xs text-gray-400 mb-1">
                      {msg.profiles?.full_name || msg.profiles?.email}
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
          className="p-3 border-t border-gray-700 flex items-center space-x-2 bg-gray-800"
        >
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white outline-none focus:ring-2 focus:ring-ubGold"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-ubGold text-black font-semibold rounded-lg hover:bg-yellow-400 transition"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

// 🔹 Main Admin Dashboard
export default function AdminDashboard() {
  const [tab, setTab] = useState<"items" | "claims">("items");
  const [items, setItems] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingClaims, setLoadingClaims] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState<string | null>(null);

  useEffect(() => {
    fetchItems();
    fetchClaims();
  }, []);

  async function fetchItems() {
    setLoadingItems(true);
    const { data } = await supabase
      .from("items")
      .select("*")
      .order("reported_at", { ascending: false });
    setItems(data || []);
    setLoadingItems(false);
  }

  async function fetchClaims() {
    setLoadingClaims(true);
    const { data } = await supabase
      .from("claims")
      .select(
        `id, message, status, created_at, items:item_id(name, campus), profiles:claimed_by(full_name,email)`
      )
      .order("created_at", { ascending: false });
    setClaims(data || []);
    setLoadingClaims(false);
  }

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("en-BZ", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  return (
    <div className="p-6 max-w-7xl mx-auto relative">
      <h1 className="text-3xl font-bold text-ubGold mb-6">Admin Dashboard</h1>

      {/* Tabs */}
      <div className="flex gap-3 mb-8">
        <button
          onClick={() => setTab("items")}
          className={`px-4 py-2 rounded-md font-semibold transition ${
            tab === "items"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
          }`}
        >
          📦 Reported Items
        </button>
        <button
          onClick={() => setTab("claims")}
          className={`px-4 py-2 rounded-md font-semibold transition ${
            tab === "claims"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
          }`}
        >
          🧾 Claims Management
        </button>
      </div>

      {tab === "items" ? (
        <section>
          {loadingItems ? (
            <p className="text-gray-500">Loading reported items...</p>
          ) : items.length === 0 ? (
            <p className="text-gray-400">No reported items found.</p>
          ) : (
            <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow-md">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Campus</th>
                    <th className="px-4 py-3">Reporter</th>
                    <th className="px-4 py-3">Reported At</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <td className="px-4 py-3">{item.name}</td>
                      <td className="px-4 py-3">{item.status}</td>
                      <td className="px-4 py-3">{item.campus}</td>
                      <td className="px-4 py-3">{item.reporter_name}</td>
                      <td className="px-4 py-3">
                        {item.reported_at ? formatDate(item.reported_at) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section>
          {loadingClaims ? (
            <p className="text-gray-500">Loading claims...</p>
          ) : claims.length === 0 ? (
            <p className="text-gray-400">No claims found yet.</p>
          ) : (
            <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow-md">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                  <tr>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">Campus</th>
                    <th className="px-4 py-3">Claimed By</th>
                    <th className="px-4 py-3">Message</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((claim) => (
                    <tr
                      key={claim.id}
                      className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <td className="px-4 py-3">{claim.items?.name || "N/A"}</td>
                      <td className="px-4 py-3">{claim.items?.campus || "—"}</td>
                      <td className="px-4 py-3">
                        {claim.profiles?.email || "Unknown"}
                      </td>
                      <td className="px-4 py-3">{claim.message || "—"}</td>
                      <td className="px-4 py-3">{claim.status}</td>
                      <td className="px-4 py-3">{formatDate(claim.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedClaim(claim.id)}
                          className="px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                        >
                          💬 Chat
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* 🪟 Chat Drawer */}
      {selectedClaim && (
        <ClaimChat claimId={selectedClaim} onClose={() => setSelectedClaim(null)} />
      )}
    </div>
  );
}
