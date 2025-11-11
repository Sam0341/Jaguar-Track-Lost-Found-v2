"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/* ----------------------------- Types ----------------------------- */
type ItemData = {
  id: string;
  name: string;
  campus: string | null;
  description: string | null;
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
  status: string | null; // "pending" | "approved" | "rejected"
  created_at: string | null;
  items: ItemData | null;
  profiles: ProfileData | null; // claimant
};

type Message = {
  id: string;
  claim_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  profiles?: { full_name: string | null; email: string | null }; // joined sender profile
};

/* --------------------------- Utilities --------------------------- */
const SUPABASE_PUBLIC_BUCKET =
  "https://npudlbublntelxzmzlmu.supabase.co/storage/v1/object/public/item-photos";

function resolveImage(src?: string | null) {
  if (!src) return "/placeholder.png";
  if (src.startsWith("http")) return src;
  return `${SUPABASE_PUBLIC_BUCKET}/${src}`;
}

function formatWhen(ts?: string | null, withTime = true) {
  if (!ts) return "—";
  const d = new Date(ts);
  return withTime
    ? d.toLocaleString("en-BZ", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : d.toLocaleDateString("en-BZ", { year: "numeric", month: "short", day: "numeric" });
}

function statusBadgeCls(status?: string | null) {
  const s = status?.toLowerCase();
  if (s === "approved") return "bg-green-600 text-white";
  if (s === "rejected") return "bg-red-600 text-white";
  return "bg-yellow-500 text-white";
}

function titleCase(s?: string | null) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function userLabel(p?: ProfileData | null) {
  return p?.email || p?.full_name || "Anonymous";
}

/* --------------------------- Component --------------------------- */
export default function AdminClaimsPage() {
  const [claims, setClaims] = useState<ClaimView[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<ClaimView | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // UI helpers
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">(
    "all"
  );

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
  async function updateClaimStatus(claimId: string, status: "approved" | "rejected") {
    setActionLoading(claimId);
    try {
      const { error } = await supabase.from("claims").update({ status }).eq("id", claimId);
      if (error) throw error;

      setClaims((prev) => prev.map((c) => (c.id === claimId ? { ...c, status } : c)));
      showToast(`✅ Claim ${status.toUpperCase()} successfully!`);
    } catch (err: any) {
      showToast("❌ " + err.message, "error");
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
  function showToast(msg: string, type: "success" | "error" | "info" = "success") {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3500);
  }

  /* ------------------------ Filters & searching ----------------------- */
  const filteredClaims = useMemo(() => {
    return claims.filter((c) => {
      const matchesStatus =
        statusFilter === "all" ? true : (c.status || "pending").toLowerCase() === statusFilter;
      const hay =
        `${c.items?.name ?? ""} ${c.items?.campus ?? ""} ${c.profiles?.email ?? ""} ${c.message ?? ""}`
          .toLowerCase()
          .trim();
      const matchesSearch = hay.includes(search.toLowerCase().trim());
      return matchesStatus && matchesSearch;
    });
  }, [claims, statusFilter, search]);

  /* ------------------------------- UI ------------------------------- */
  if (loading) {
    return (
      <div className="text-center py-16 text-gray-400 dark:text-gray-500">Loading claims…</div>
    );
  }

  if (errorMsg) {
    return (
      <div className="text-center py-16 text-red-500">
        Failed to load claims: {errorMsg}
        <div className="mt-4">
          <button
            onClick={fetchClaims}
            className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-500"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-ubGold mb-6">Claims Management</h1>

      {/* Toast */}
      {showToast && toastMsg && (
        <div className="fixed top-6 right-6 z-[100] px-4 py-2 rounded-lg shadow-lg text-white bg-green-600">
          {toastMsg}
        </div>
      )}

      {/* If no claim selected, show card list (Phase 1) */}
      {!selectedClaim ? (
        <>
          {/* Controls */}
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-2">
              {(["all", "pending", "approved", "rejected"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium border transition ${
                    statusFilter === s
                      ? "bg-ubGold text-black border-yellow-500"
                      : "bg-white/5 border-gray-700 text-gray-300 hover:bg-white/10"
                  }`}
                >
                  {s === "all" ? "All" : titleCase(s)}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-80">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by item, campus, claimant, message…"
                className="w-full rounded-lg bg-gray-900 border border-gray-700 text-gray-100 px-3 py-2 outline-none focus:ring-2 focus:ring-ubGold"
              />
              <span className="pointer-events-none absolute right-3 top-2.5 text-gray-500">⌕</span>
            </div>
          </div>

          {/* Cards grid */}
          {filteredClaims.length === 0 ? (
            <p className="text-gray-400 text-center py-10">No claims match your filter.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredClaims.map((c) => {
                const status = (c.status || "pending").toLowerCase();
                return (
                  <div
                    key={c.id}
                    className={`rounded-xl overflow-hidden border transition shadow-sm hover:shadow-md cursor-default ${
                      status === "pending"
                        ? "border-yellow-600/40 ring-1 ring-yellow-600/30"
                        : "border-gray-700"
                    } bg-gray-900`}
                  >
                    <div
                      className="h-40 bg-gray-800 overflow-hidden"
                      onClick={() => setSelectedClaim(c)}
                      title="Open chat"
                    >
                      <img
                        src={resolveImage(c.items?.image || null)}
                        alt={c.items?.name || "Item"}
                        className="w-full h-full object-cover opacity-90 hover:opacity-100 transition"
                        onError={(e) => ((e.currentTarget.src = "/placeholder.png"))}
                      />
                    </div>

                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-100">
                            {c.items?.name ?? "Untitled"}
                          </h3>
                          <p className="text-xs text-gray-400">{c.items?.campus || "—"}</p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusBadgeCls(
                            c.status
                          )}`}
                        >
                          {titleCase(c.status || "pending")}
                        </span>
                      </div>

                      <div className="text-xs text-gray-400">
                        <span className="font-medium text-gray-300">Claimant:</span>{" "}
                        {userLabel(c.profiles)}
                      </div>

                      {c.message && (
                        <p className="text-sm text-gray-300 line-clamp-2">{c.message}</p>
                      )}

                      <div className="flex items-center justify-between pt-2">
                        <span className="text-[11px] text-gray-500">
                          {formatWhen(c.created_at, true)}
                        </span>

                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedClaim(c)}
                            className="px-3 py-1 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-500"
                          >
                            Chat
                          </button>
                          <button
                            onClick={() => updateClaimStatus(c.id, "approved")}
                            disabled={actionLoading === c.id}
                            className="px-3 py-1 rounded-md bg-green-600 text-white text-sm hover:bg-green-500 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => updateClaimStatus(c.id, "rejected")}
                            disabled={actionLoading === c.id}
                            className="px-3 py-1 rounded-md bg-red-600 text-white text-sm hover:bg-red-500 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* -------------------------- Chat view (Phase 2) -------------------------- */
        <div className="max-w-4xl mx-auto rounded-xl overflow-hidden border border-gray-800 bg-gray-900 shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-5 py-3 bg-gray-800/70 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <img
                src={resolveImage(selectedClaim.items?.image || null)}
                alt="Item"
                className="w-12 h-12 rounded-lg object-cover border border-gray-700"
                onError={(e) => ((e.currentTarget.src = "/placeholder.png"))}
              />
              <div>
                <h2 className="text-lg font-semibold text-gray-100">
                  {selectedClaim.items?.name}
                </h2>
                <p className="text-xs text-gray-400">
                  {userLabel(selectedClaim.profiles)} • {selectedClaim.items?.campus || "—"}
                </p>
                {selectedClaim.message && (
                  <p className="text-[12px] text-gray-300 mt-1 italic">
                    “{selectedClaim.message}”
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={() => setSelectedClaim(null)}
              className="text-sm text-gray-200 bg-gray-700 px-3 py-1 rounded-md hover:bg-gray-600"
            >
              ← Back
            </button>
          </div>

          {/* Messages */}
          <ChatMessages
            messages={messages}
            claimantId={selectedClaim.profiles?.id || "__unknown__"}
          />

          {/* Input */}
          <form
            onSubmit={sendMessage}
            className="p-4 border-t border-gray-800 bg-gray-850 flex items-center gap-2"
          >
            <input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message…"
              className="flex-1 px-4 py-2 rounded-lg bg-gray-950 border border-gray-800 text-gray-100 outline-none focus:ring-2 focus:ring-ubGold"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-ubGold text-black font-semibold hover:bg-yellow-400"
            >
              Send
            </button>
          </form>

          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
}

/* ---------------------- Chat Messages component ---------------------- */
function ChatMessages({
  messages,
  claimantId,
}: {
  messages: Message[];
  claimantId: string;
}) {
  // Build chunks by calendar day + same-sender groups
  const withSeparators = useMemo(() => {
    const out: Array<
      | { kind: "day"; label: string }
      | { kind: "msg"; msg: Message; isAdmin: boolean; grouped: boolean }
    > = [];

    let lastDay = "";
    let lastSender = "";

    for (const m of messages) {
      const d = new Date(m.created_at);
      const day = d.toDateString();
      if (day !== lastDay) {
        out.push({
          kind: "day",
          label: day === new Date().toDateString() ? "Today" : d.toLocaleDateString("en-BZ", { weekday: "short", year: "numeric", month: "short", day: "numeric" }),
        });
        lastDay = day;
        lastSender = ""; // break grouping across days
      }
      const isAdmin = m.sender_id !== claimantId;
      const grouped = m.sender_id === lastSender;
      out.push({ kind: "msg", msg: m, isAdmin, grouped });
      lastSender = m.sender_id;
    }
    return out;
  }, [messages, claimantId]);

  return (
    <div className="p-4 h-[65vh] overflow-y-auto space-y-3 bg-[#0f141b]">
      {withSeparators.map((node, idx) =>
        node.kind === "day" ? (
          <div
            key={`day-${idx}`}
            className="text-center my-2 text-[11px] uppercase tracking-wider text-gray-400"
          >
            {node.label}
          </div>
        ) : (
          <div
            key={node.msg.id}
            className={`flex ${node.isAdmin ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[78%] px-3 py-2 rounded-2xl shadow-sm ${
                node.isAdmin
                  ? "bg-ubGold text-black rounded-br-none"
                  : "bg-gray-800 text-gray-100 border border-gray-700 rounded-bl-none"
              } ${node.grouped ? "-mt-1" : ""}`}
            >
              {!node.isAdmin && !node.grouped && (
                <p className="text-[11px] text-gray-400 mb-0.5">
                  {node.msg.profiles?.full_name || node.msg.profiles?.email || "User"}
                </p>
              )}
              <p className="text-sm leading-relaxed">{node.msg.content}</p>
              <p className="text-[10px] text-gray-400 mt-0.5 text-right">
                {new Date(node.msg.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        )
      )}
    </div>
  );
}
