"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/* ---------- Types ---------- */
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
  const [claims, setClaims] = useState<ClaimView[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<ClaimView | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastOpen, setToastOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<"all" | "pending" | "approved" | "rejected">("all");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* -------------------- Fetch claims -------------------- */
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

  useEffect(() => {
    fetchClaims();
  }, []);

  /* -------------------------- Update claim status -------------------------- */
  async function updateClaimStatus(
    claimId: string,
    status: "approved" | "rejected"
  ) {
    setActionLoading(claimId);
    try {
      const res = await fetch("/api/claims", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim_id: claimId, status }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Update failed");

      openToast(result.message || `✅ Claim ${status} successfully!`);

      const approvedRow = document.getElementById(`claim-row-${claimId}`);
      if (approvedRow) {
        approvedRow.classList.add("animate-pulse-green");
        setTimeout(() => approvedRow.classList.remove("animate-pulse-green"), 1500);
      }

      await fetchClaims();
    } catch (err: any) {
      openToast("❌ " + err.message);
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
        sender_id: user.id,
        content: newMessage.trim(),
      },
    ]);

    if (!error) setNewMessage("");
  }

  /* ---------------- Load messages + realtime ---------------- */
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
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `claim_id=eq.${claimId}`,
        },
        (payload) => setMessages((prev) => [...prev, payload.new as Message])
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedClaim]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* --------------------------- Toast --------------------------- */
  function openToast(msg: string) {
    setToastMsg(msg);
    setToastOpen(true);
    setTimeout(() => setToastOpen(false), 3500);
  }

  /* ------------------------ Filters ------------------------ */
  const filteredClaims = useMemo(() => {
    const term = search.trim().toLowerCase();
    return claims.filter((c) => {
      const statusOk =
        statusFilter === "all" ||
        (c.status?.toLowerCase?.() ?? "pending") === statusFilter;

      const name = c.items?.name?.toLowerCase?.() || "";
      const email = c.profiles?.email?.toLowerCase?.() || "";
      const full = c.profiles?.full_name?.toLowerCase?.() || "";
      const campus = c.items?.campus?.toLowerCase?.() || "";

      const matches =
        !term ||
        name.includes(term) ||
        email.includes(term) ||
        full.includes(term) ||
        campus.includes(term);

      return statusOk && matches;
    });
  }, [claims, search, statusFilter]);

  const stats = useMemo(() => {
    const total = claims.length;
    const pending = claims.filter((c) => (c.status ?? "pending") === "pending").length;
    const approved = claims.filter((c) => c.status === "approved").length;
    const rejected = claims.filter((c) => c.status === "rejected").length;
    return { total, pending, approved, rejected };
  }, [claims]);

  /* ------------------------------- UI ------------------------------- */
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

      {/* Toast */}
      {toastOpen && toastMsg && (
        <div className="fixed top-6 right-6 bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg z-50">
          {toastMsg}
        </div>
      )}

      {/* Filters + Stats */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by item, claimant, campus…"
            className="w-72 px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 outline-none focus:ring-2 focus:ring-ubGold"
          />
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "all" | "pending" | "approved" | "rejected")
            }
            className="px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 outline-none focus:ring-2 focus:ring-ubGold"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          <span className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-800">
            Total: <b>{stats.total}</b>
          </span>
          <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            Pending: <b>{stats.pending}</b>
          </span>
          <span className="px-2 py-1 rounded bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            Approved: <b>{stats.approved}</b>
          </span>
          <span className="px-2 py-1 rounded bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            Rejected: <b>{stats.rejected}</b>
          </span>
        </div>
      </div>

      {/* Table or Chat */}
      {!selectedClaim ? (
        <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-700 text-left text-gray-800 dark:text-gray-200">
              <tr>
                <th className="px-5 py-3 font-semibold">Item</th>
                <th className="px-5 py-3 font-semibold">Campus</th>
                <th className="px-5 py-3 font-semibold">Claimant</th>
                <th className="px-5 py-3 font-semibold">Message</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClaims.map((c) => (
                <tr
                  id={`claim-row-${c.id}`}
                  key={c.id}
                  className="border-b dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                  <td className="px-5 py-3 font-semibold text-ubGold">
                    {c.items?.name ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-gray-500 dark:text-gray-300">
                    {c.items?.campus ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    {c.profiles?.email || c.profiles?.full_name || "—"}
                  </td>
                  <td className="px-5 py-3 text-gray-400 max-w-xs truncate">
                    {c.message || "—"}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        (c.status ?? "pending") === "approved"
                          ? "bg-green-600 text-white"
                          : (c.status ?? "pending") === "rejected"
                          ? "bg-red-600 text-white"
                          : "bg-yellow-500 text-white"
                      }`}
                    >
                      {c.status ?? "pending"}
                    </span>
                  </td>
                  <td className="px-5 py-3 flex flex-wrap justify-center gap-2">
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
              {filteredClaims.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-6 text-center text-gray-500 dark:text-gray-400"
                  >
                    No claims match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Chat View */
        <div className="max-w-3xl mx-auto bg-gray-900 text-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gray-800 px-5 py-3 flex justify-between items-center border-b border-gray-700">
            <div>
              <h2 className="text-lg font-semibold">
                {selectedClaim.items?.name}
              </h2>
              <p className="text-xs text-gray-400">
                {selectedClaim.profiles?.email || "Unknown"} •{" "}
                {selectedClaim.items?.campus}
              </p>
              {selectedClaim.message && (
                <p className="text-sm text-gray-300 mt-2 italic">
                  “{selectedClaim.message}”
                </p>
              )}
            </div>
            <button
              onClick={() => setSelectedClaim(null)}
              className="text-sm text-gray-300 hover:text-white bg-gray-700 px-3 py-1 rounded-md"
            >
              ← Back
            </button>
          </div>

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

/* ✅ Add the green pulse animation */
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    @keyframes pulse-green {
      0% { background-color: rgba(34,197,94,0.2); }
      50% { background-color: rgba(34,197,94,0.5); }
      100% { background-color: transparent; }
    }
    .animate-pulse-green {
      animation: pulse-green 1.5s ease-in-out;
    }
  `;
  document.head.appendChild(style);
}
