"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/* ----------------------------- Types ----------------------------- */
type ItemData = {
  id: string;
  name: string;
  campus: string;
  description: string;
  image?: string | null;
  reporter_email?: string | null;
};

type ProfileData = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone?: string | null;
};

type ClaimView = {
  id: string;
  message: string | null;
  status: string | null;
  created_at: string | null;
  items: ItemData | null;
  profiles: ProfileData | null;
};

type Message = {
  id: string;
  claim_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  profiles?: { full_name: string | null; email: string | null };
};

export default function AdminClaimsPage() {
  /* --------------------------- Page state --------------------------- */
  const [claims, setClaims] = useState<ClaimView[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<ClaimView | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");

  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false); // renamed from showToast to avoid clash
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchClaims();
  }, []);

  /* -------------------- Fetch claims (with joins) -------------------- */
  async function fetchClaims() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from("claims")
        .select(`
          id,
          message,
          status,
          created_at,
          item_id,
          claimed_by,
          items:item_id (
            id,
            name,
            campus,
            description,
            image,
            reporter_email
          ),
          profiles:claimed_by (
            id,
            full_name,
            email,
            phone
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setClaims((data as any) || []);
    } catch (err: any) {
      console.error("Fetch claims error:", err);
      setErrorMsg(err.message || "Failed to fetch claims");
    } finally {
      setLoading(false);
    }
  }

  /* -------------------------- Update status -------------------------- */
  async function updateClaimStatus(
    claimId: string,
    status: "approved" | "rejected"
  ) {
    setActionLoading(claimId);
    try {
      const { error } = await supabase
        .from("claims")
        .update({ status })
        .eq("id", claimId);
      if (error) throw error;

      setClaims((prev) => prev.map((c) => (c.id === claimId ? { ...c, status } : c)));
      triggerToast(`✅ Claim ${status.toUpperCase()} successfully!`);
    } catch (err: any) {
      triggerToast("❌ " + err.message, "error");
    } finally {
      setActionLoading(null);
    }
  }

  /* ----------------------------- Chat ----------------------------- */
  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClaim || !newMessage.trim()) return;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) return;

    const { error } = await supabase.from("messages").insert([
      {
        claim_id: selectedClaim.id,
        sender_id: user.id, // real admin id
        content: newMessage.trim(),
      },
    ]);

    if (!error) setNewMessage("");
  }

  // Load messages when a claim is selected + realtime
  useEffect(() => {
    const claimId = selectedClaim?.id;
    if (!claimId) return;

    async function loadMessages() {
      const { data, error } = await supabase
        .from("messages")
        .select(`*, profiles:sender_id(full_name, email)`)
        .eq("claim_id", claimId)
        .order("created_at", { ascending: true });

      if (!error) setMessages(data || []);
    }

    loadMessages();

    const channel = supabase
      .channel(`messages:claim=${claimId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `claim_id=eq.${claimId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Message])
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedClaim]);

  // autoscroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* --------------------------- Toast helper --------------------------- */
  function triggerToast(
    msg: string,
    type: "success" | "error" | "info" = "success"
  ) {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3500);
  }

  /* ----------------------------- Render ----------------------------- */
  if (loading)
    return <div className="text-center py-16 text-gray-400">Loading claims...</div>;

  if (errorMsg)
    return (
      <div className="text-center py-16 text-red-400">
        Failed to load claims: {errorMsg}
      </div>
    );

  return (
    <div className="p-6 max-w-7xl mx-auto relative">
      <h1 className="text-3xl font-bold text-ubGold mb-6">Claims Management</h1>

      {/* 🔔 Toast */}
      {toastVisible && toastMsg && (
        <div className="fixed top-6 right-6 bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg z-[9999]">
          {toastMsg}
        </div>
      )}

      {/* 📋 Table View */}
      {!selectedClaim ? (
        <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-700 text-left text-gray-800 dark:text-gray-200">
              <tr>
                <th className="px-5 py-3 font-semibold">Item</th>
                <th className="px-5 py-3 font-semibold">Campus</th>
                <th className="px-5 py-3 font-semibold">Claimant</th>
                <th className="px-5 py-3 font-semibold">Claim Message</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => (
                <tr
                  key={c.id}
                  className="border-b dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition"
                >
                  <td className="px-5 py-3 font-semibold text-ubGold">
                    {c.items?.name ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-gray-400">{c.items?.campus ?? "—"}</td>
                  <td className="px-5 py-3">{c.profiles?.email || c.profiles?.full_name || "—"}</td>
                  <td className="px-5 py-3 text-gray-300 max-w-xs truncate">
                    {c.message || "—"}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        c.status === "approved"
                          ? "bg-green-600 text-white"
                          : c.status === "rejected"
                          ? "bg-red-600 text-white"
                          : "bg-yellow-500 text-white"
                      }`}
                    >
                      {c.status ?? "pending"}
                    </span>
                  </td>
                  <td className="px-5 py-3 space-x-2">
                    <button
                      onClick={() => setSelectedClaim(c)}
                      className="px-3 py-1 bg-blue-600 text-white rounded-md"
                    >
                      View Chat
                    </button>
                    <button
                      onClick={() => updateClaimStatus(c.id, "approved")}
                      disabled={actionLoading !== null}
                      className="px-3 py-1 bg-green-600 text-white rounded-md disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => updateClaimStatus(c.id, "rejected")}
                      disabled={actionLoading !== null}
                      className="px-3 py-1 bg-red-600 text-white rounded-md disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // 💬 Chat View
        <div className="max-w-3xl mx-auto bg-gray-900 text-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gray-800 px-5 py-3 flex justify-between items-center border-b border-gray-700">
            <div>
              <h2 className="text-lg font-semibold">{selectedClaim.items?.name}</h2>
              <p className="text-xs text-gray-400">
                {selectedClaim.profiles?.email || "Unknown"} • {selectedClaim.items?.campus}
              </p>
              {selectedClaim.message && (
                <p className="text-sm text-gray-300 mt-2 italic">“{selectedClaim.message}”</p>
              )}
            </div>
            <button
              onClick={() => setSelectedClaim(null)}
              className="text-sm text-gray-300 hover:text-white bg-gray-700 px-3 py-1 rounded-md"
            >
              ← Back
            </button>
          </div>

          {/* Chat messages */}
          <div className="p-4 h-[65vh] overflow-y-auto space-y-3">
            {messages.map((msg) => {
              const isAdmin =
                msg.profiles?.email && !msg.profiles.email.endsWith("@ub.edu.bz");
              return (
                <div
                  key={msg.id}
                  className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`p-3 rounded-2xl max-w-[75%] shadow-md ${
                      isAdmin
                        ? "bg-ubGold text-black rounded-br-none"
                        : "bg-gray-800 text-gray-100 border border-gray-700 rounded-bl-none"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium text-gray-400">
                        {isAdmin ? "Admin" : msg.profiles?.email || "User"}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-sm">{msg.content}</p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

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
