"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/* ========= TYPES ========= */

type ItemRow = {
  id: string;
  name: string | null;
  description: string | null;
  image: string | null;
  location: string | null;
  status: string | null;
  reporter_email: string | null;
  campus?: { name: string | null } | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type ClaimRow = {
  id: string;
  item_id: string | null;
  claimed_by: string | null;
  message: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ClaimView = {
  id: string;
  message: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  item: ItemRow | null;
  claimant: ProfileRow | null;
};

type MessageRow = {
  id: string;
  claim_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_admin: boolean;
  profiles?: { full_name: string | null; email: string | null } | null;
};

/* ========= COMPONENT ========= */

export default function AdminClaimsPage() {
  const [claims, setClaims] = useState<ClaimView[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<ClaimView | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<"all" | "pending" | "approved" | "rejected">("all");

  const [toast, setToast] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const PUBLIC_BUCKET = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/item-photos`;

  /* ========= UTIL ========= */

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }

  function formatDateTime(ts: string | null) {
    if (!ts) return "—";
    return new Date(ts).toLocaleString("en-BZ", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /* ========= FETCH CLAIMS (NO EMBED) ========= */

  async function fetchClaims() {
    setLoading(true);
    setErrorMsg(null);

    try {
      // 1) Get claims only
      const { data: claimRows, error: claimErr } = await supabase
        .from("claims")
        .select("*")
        .order("created_at", { ascending: false });

      if (claimErr) throw claimErr;

      const claimsData = (claimRows || []) as ClaimRow[];

      if (claimsData.length === 0) {
        setClaims([]);
        setLoading(false);
        return;
      }

      // 2) Collect item_ids + claimed_by ids
      const itemIds = Array.from(
        new Set(
          claimsData
            .map((c) => c.item_id)
            .filter((id): id is string => !!id)
        )
      );
      const profileIds = Array.from(
        new Set(
          claimsData
            .map((c) => c.claimed_by)
            .filter((id): id is string => !!id)
        )
      );

      // 3) Fetch items
      let itemsMap = new Map<string, ItemRow>();
      if (itemIds.length > 0) {
        const { data: itemRows, error: itemErr } = await supabase
          .from("items")
          .select(
            `
            id,
            name,
            description,
            image,
            location,
            status,
            reporter_email,
            campus:campus_id ( name )
          `
          )
          .in("id", itemIds);

        if (itemErr) throw itemErr;

        (itemRows || []).forEach((row: any) => {
          itemsMap.set(row.id, row as ItemRow);
        });
      }

      // 4) Fetch profiles (claimants)
      let profileMap = new Map<string, ProfileRow>();
      if (profileIds.length > 0) {
        const { data: profileRows, error: profileErr } = await supabase
          .from("profiles")
          .select("id, full_name, email, phone")
          .in("id", profileIds);

        if (profileErr) throw profileErr;

        (profileRows || []).forEach((row: any) => {
          profileMap.set(row.id, row as ProfileRow);
        });
      }

      // 5) Combine
      const combined: ClaimView[] = claimsData.map((c) => ({
        id: c.id,
        message: c.message,
        status: c.status,
        created_at: c.created_at,
        updated_at: c.updated_at,
        item: c.item_id ? itemsMap.get(c.item_id) ?? null : null,
        claimant: c.claimed_by ? profileMap.get(c.claimed_by) ?? null : null,
      }));

      setClaims(combined);
    } catch (err: any) {
      console.error("Fetch claims error:", err);
      setErrorMsg(err.message || "Failed to load claims");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchClaims();
  }, []);

  /* ========= FILTERS + STATS ========= */

  const filteredClaims = useMemo(() => {
    const term = search.trim().toLowerCase();

    return claims.filter((c) => {
      const status = (c.status ?? "pending").toLowerCase();
      const statusMatch =
        statusFilter === "all" || status === statusFilter.toLowerCase();

      if (!statusMatch) return false;

      if (!term) return true;

      const itemName = c.item?.name?.toLowerCase() || "";
      const campus = c.item?.campus?.name?.toLowerCase() || "";
      const email = c.claimant?.email?.toLowerCase() || "";
      const fullName = c.claimant?.full_name?.toLowerCase() || "";

      return (
        itemName.includes(term) ||
        campus.includes(term) ||
        email.includes(term) ||
        fullName.includes(term)
      );
    });
  }, [claims, search, statusFilter]);

  const stats = useMemo(() => {
    const total = claims.length;
    const pending = claims.filter((c) => (c.status ?? "pending") === "pending")
      .length;
    const approved = claims.filter((c) => c.status === "approved").length;
    const rejected = claims.filter((c) => c.status === "rejected").length;
    return { total, pending, approved, rejected };
  }, [claims]);

  /* ========= UPDATE CLAIM STATUS ========= */

  async function updateClaimStatus(
    claimId: string,
    status: "approved" | "rejected"
  ) {
    try {
      setActionLoading(claimId);

      const res = await fetch("/api/claims", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim_id: claimId, status }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to update claim.");

      showToast(result.message || `Claim ${status} successfully.`);
      await fetchClaims();
    } catch (err: any) {
      console.error("Update status error:", err);
      showToast("❌ " + (err.message || "Failed to update claim."));
    } finally {
      setActionLoading(null);
    }
  }

  /* ========= CHAT: LOAD MESSAGES + REALTIME ========= */

  useEffect(() => {
    const claimId = selectedClaim?.id;
    if (!claimId) return;

    async function loadMessages() {
      const { data, error } = await supabase
        .from("messages")
        .select(`
          id,
          claim_id,
          sender_id,
          content,
          created_at,
          is_admin,
          profiles:sender_id ( full_name, email )
        `)
        .eq("claim_id", claimId)
        .order("created_at", { ascending: true });

      if (!error) {
        // normalize profiles (because of embed alias)
        const normalized = (data || []).map((m: any) => ({
          ...m,
          profiles: Array.isArray(m.profiles) ? m.profiles[0] ?? null : m.profiles,
        }));
        setMessages(normalized as MessageRow[]);
      }
    }

    loadMessages();

    const channel = supabase
      .channel(`messages-claim-${claimId}`)
      .on(
        "postgres_changes",
        {
          schema: "public",
          table: "messages",
          event: "INSERT",
          filter: `claim_id=eq.${claimId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as MessageRow]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedClaim]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ========= CHAT: SEND MESSAGE ========= */

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClaim || !newMessage.trim()) return;

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      showToast("❌ Could not send message (no admin user).");
      return;
    }

    const { error: insertErr } = await supabase.from("messages").insert({
      claim_id: selectedClaim.id,
      sender_id: user.id,
      content: newMessage.trim(),
      is_admin: true,
    });

    if (insertErr) {
      console.error(insertErr);
      showToast("❌ Failed to send message.");
      return;
    }

    setNewMessage("");
  }

  /* ========= RENDER ========= */

  if (loading) {
    return (
      <div className="text-center py-16 text-gray-400">Loading claims…</div>
    );
  }

  if (errorMsg) {
    return (
      <div className="text-center py-16 text-red-400">
        Failed to load claims: {errorMsg}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto relative">
      <h1 className="text-3xl font-bold text-ubGold mb-6">Claims Management</h1>

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      {/* Filters + Stats */}
      {!selectedClaim && (
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by item, campus, email…"
              className="w-72 px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 outline-none focus:ring-2 focus:ring-ubGold"
            />
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as "all" | "pending" | "approved" | "rejected"
                )
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
      )}

      {/* ===== TABLE VIEW ===== */}
      {!selectedClaim && (
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
                  key={c.id}
                  className="border-b dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                  <td className="px-5 py-3 font-semibold text-ubGold">
                    {c.item?.name ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-gray-500 dark:text-gray-300">
                    {c.item?.campus?.name ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    {c.claimant?.email ||
                      c.claimant?.full_name ||
                      "Unknown user"}
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
                          : "bg-yellow-500 text-black"
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
      )}

      {/* ===== CHAT VIEW ===== */}
      {selectedClaim && (
        <div className="max-w-3xl mx-auto bg-gray-900 text-white rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gray-800 px-5 py-3 flex justify-between items-center border-b border-gray-700">
            <div>
              <h2 className="text-lg font-semibold">
                {selectedClaim.item?.name || "Item"}
              </h2>
              <p className="text-xs text-gray-400">
                {selectedClaim.claimant?.email || "Unknown user"} •{" "}
                {selectedClaim.item?.campus?.name || "Unknown campus"}
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

          {/* Chat messages */}
          <div className="p-4 h-[65vh] overflow-y-auto space-y-3">
            {messages.map((msg) => {
              const isAdmin = msg.is_admin;
              const senderName =
                isAdmin ? "Admin" : msg.profiles?.email || "User";

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
                      <span className="text-xs font-medium text-gray-600">
                        {senderName}
                      </span>
                      <span className="text-[10px] text-gray-500">
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
