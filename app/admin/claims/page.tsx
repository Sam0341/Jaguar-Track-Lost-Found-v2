"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  FormEvent,
} from "react";
import { supabase } from "@/lib/supabaseClient";

/* ============================== TYPES ============================== */

type ItemData = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  image: string | null;
  status: string | null;
  campus_id: string | null;
  category_id: string | null;
};

type ProfileData = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type ClaimRow = {
  id: string;
  item_id: string;
  claimed_by: string;
  message: string | null;
  status: string | null;
  created_at: string;
};

type ClaimView = {
  id: string;
  message: string | null;
  status: string | null;
  created_at: string | null;
  item: ItemData | null;
  user: ProfileData | null;
  campus: string | null;
  category: string | null;
};

type Message = {
  id: string;
  claim_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  profiles?: { full_name: string | null; email: string | null };
};

/* ========================== MAIN COMPONENT ========================== */

export default function AdminClaimsPage() {
  const [claims, setClaims] = useState<ClaimView[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<ClaimView | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<"all" | "pending" | "approved" | "rejected">("all");

  const [busyStatusId, setBusyStatusId] = useState<string | null>(null);
  const [busyReturnId, setBusyReturnId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* ===================== FETCH ALL CLAIMS ===================== */

  const fetchClaims = async () => {
    setErrorMsg(null);

    try {
      const { data: claimRows, error: claimErr } = await supabase
        .from("claims")
        .select("*")
        .order("created_at", { ascending: false });

      if (claimErr) throw claimErr;

      const final: ClaimView[] = [];

      for (const row of claimRows as ClaimRow[]) {
        const { data: item } = await supabase
          .from("items")
          .select("*")
          .eq("id", row.item_id)
          .single();

        const { data: user } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("id", row.claimed_by)
          .single();

        const { data: campus } =
          item?.campus_id
            ? await supabase
                .from("campuses")
                .select("name")
                .eq("id", item.campus_id)
                .single()
            : { data: null };

        const { data: category } =
          item?.category_id
            ? await supabase
                .from("categories")
                .select("name")
                .eq("id", item.category_id)
                .single()
            : { data: null };

        let imageUrl: string | null = null;
        if (item?.image) {
          const { data: url } = supabase.storage
            .from("item-photos")
            .getPublicUrl(item.image);
          imageUrl = url?.publicUrl || null;
        }

        final.push({
          id: row.id,
          message: row.message,
          status: row.status,
          created_at: row.created_at,
          item: item
            ? {
                ...item,
                image: imageUrl,
              }
            : null,
          user,
          campus: campus?.name || null,
          category: category?.name || null,
        });
      }

      setClaims(final);
    } catch (err: any) {
      console.error("CLAIMS FETCH ERROR:", err);
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
      if (!selectedClaim) return;
  
      const claimId = selectedClaim.id;
  
      async function loadMessages() {
        const { data } = await supabase
          .from("messages")
          .select(
            "id, claim_id, sender_id, content, created_at, is_admin, image_url"
          )
          .eq("claim_id", claimId)
          .order("created_at", { ascending: true });
  
        setMessages(data || []);
      }
  
      loadMessages();
  
      const channel = supabase
        .channel(`claim-${claimId}`)
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ========================== SEND MESSAGE ========================== */

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!selectedClaim || !newMessage.trim()) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("messages").insert([
      {
        claim_id: selectedClaim.id,
        sender_id: user.id,
        content: newMessage.trim(),
        is_admin: true,
      },
    ]);

    setNewMessage("");
  }

  /* ======================== DOWNLOAD CHAT ======================== */

  function downloadChatTranscript() {
    if (!selectedClaim) return;

    const lines: string[] = [];

    lines.push("Jaguar Track Lost & Found – Claim Chat Transcript");
    lines.push("--------------------------------------------------");
    lines.push(`Claim ID: ${selectedClaim.id}`);
    lines.push(
      `Item: ${selectedClaim.item?.name || "Unknown item"} (${selectedClaim.item?.id})`
    );
    lines.push(
      `User: ${
        selectedClaim.user?.full_name ||
        selectedClaim.user?.email ||
        "Unknown user"
      }`
    );
    lines.push("");
    lines.push("----- CHAT START -----");

    messages.forEach((msg) => {
      const isAdmin = msg.sender_id !== selectedClaim.user?.id;
      const who = isAdmin
        ? "ADMIN"
        : msg.profiles?.email || msg.profiles?.full_name || "USER";

      const time = new Date(msg.created_at).toLocaleString();

      lines.push(`[${time}] ${who}: ${msg.content}`);
    });

    lines.push("----- CHAT END -----");

    const blob = new Blob(lines, {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `claim-${selectedClaim.id}-chat.txt`;

    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* ========================= UPDATE STATUS ========================= */

  async function updateClaimStatus(
    id: string,
    status: "approved" | "rejected"
  ) {
    setBusyStatusId(id);

    try {
      const { error } = await supabase
        .from("claims")
        .update({ status })
        .eq("id", id);

      if (error) throw error;

      fetchClaims();
    } catch (err) {
      console.error(err);
    } finally {
      setBusyStatusId(null);
    }
  }

  /* ========================= MARK ITEM RETURNED ========================= */

  async function markItemReturned(c: ClaimView) {
    if (!c.item) return;

    setBusyReturnId(c.id);

    try {
      const nowIso = new Date().toISOString();

      const {
        data: { user: admin },
      } = await supabase.auth.getUser();

      await supabase
        .from("items")
        .update({
          status: "Claimed",
          claimed_at: nowIso,
          claimed_by: c.user?.id || null,
        })
        .eq("id", c.item.id);

      await supabase
        .from("claims")
        .update({ status: "approved" })
        .eq("id", c.id);

      if (admin?.id) {
        await supabase.from("logs").insert([
          {
            action: "item_returned",
            item_id: c.item.id,
            performed_by: admin.id,
            timestamp: nowIso,
          },
        ]);
      }

      fetchClaims();
    } catch (err) {
      console.error("Mark returned error:", err);
      alert("Failed to mark returned");
    } finally {
      setBusyReturnId(null);
    }
  }

  /* ========================= FILTERING ========================= */

  const filteredClaims = useMemo(() => {
    const term = search.trim().toLowerCase();

    return claims.filter((c) => {
      const statusValue = (c.status || "pending").toLowerCase();

      const statusOk =
        statusFilter === "all" || statusValue === statusFilter;

      const haystack = [
        c.item?.name,
        c.campus,
        c.category,
        c.user?.email,
        c.user?.full_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const searchOk = !term || haystack.includes(term);

      return statusOk && searchOk;
    });
  }, [claims, search, statusFilter]);

  /* ========================= LOADING STATES ========================= */

  if (loading)
    return (
      <div className="text-center py-10 text-gray-400">
        Loading claims…
      </div>
    );

  if (errorMsg)
    return (
      <div className="text-center py-10 text-red-400">
        Failed to load claims: {errorMsg}
      </div>
    );

  /* ========================= CLAIM LIST VIEW ========================= */

  if (!selectedClaim) {
    return (
      <div className="p-6 max-w-7xl mx-auto">

        <h1 className="text-3xl font-bold text-ubGold mb-6">
          Claims Management
        </h1>

        {/* Filters */}
        <div className="flex flex-col gap-3 md:flex-row md:justify-between mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by item, campus, user, category…"
            className="w-72 px-3 py-2 rounded-md bg-gray-900 border border-gray-700 text-white"
          />

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as "all" | "pending" | "approved" | "rejected"
              )
            }
            className="px-3 py-2 bg-gray-900 text-white rounded-md border border-gray-700"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* CLAIMS TABLE */}
        <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden shadow">

          <table className="min-w-full text-sm">
            <thead className="bg-gray-700 text-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">Item</th>
                <th className="px-4 py-3 text-left">Campus</th>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredClaims.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-5 text-center text-gray-500"
                  >
                    No claims match your filters.
                  </td>
                </tr>
              )}

              {filteredClaims.map((c) => {
                const effectiveStatus = c.status || "pending";
                const canMarkReturned =
                  effectiveStatus === "approved" &&
                  c.item?.status !== "Claimed";

                return (
                  <tr
                    key={c.id}
                    className="border-b border-gray-800 hover:bg-gray-800/50"
                  >
                    <td className="px-4 py-3 font-semibold text-ubGold">
                      {c.item?.name || "—"}
                    </td>
                    <td className="px-4 py-3">{c.campus || "—"}</td>
                    <td className="px-4 py-3">
                      {c.user?.email || c.user?.full_name || "—"}
                    </td>
                    <td className="px-4 py-3">{c.category || "—"}</td>

                    {/* STATUS */}
                    <td className="px-4 py-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          effectiveStatus === "approved"
                            ? "bg-green-600 text-white"
                            : effectiveStatus === "rejected"
                            ? "bg-red-600 text-white"
                            : "bg-yellow-500 text-black"
                        }`}
                      >
                        {effectiveStatus}
                      </span>
                    </td>

                    {/* ACTIONS */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-2 justify-center flex-wrap">

                        <button
                          onClick={() => setSelectedClaim(c)}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-xs"
                        >
                          Chat
                        </button>

                        {/* Approve */}
                        <button
                          onClick={() =>
                            updateClaimStatus(c.id, "approved")
                          }
                          disabled={busyStatusId === c.id}
                          className="px-3 py-1 bg-green-600 text-white rounded text-xs disabled:opacity-40"
                        >
                          {busyStatusId === c.id ? "…" : "Approve"}
                        </button>

                        {/* Reject */}
                        <button
                          onClick={() =>
                            updateClaimStatus(c.id, "rejected")
                          }
                          disabled={busyStatusId === c.id}
                          className="px-3 py-1 bg-red-600 text-white rounded text-xs disabled:opacity-40"
                        >
                          {busyStatusId === c.id ? "…" : "Reject"}
                        </button>

                        {canMarkReturned && (
                          <button
                            onClick={() => markItemReturned(c)}
                            disabled={busyReturnId === c.id}
                            className="px-3 py-1 bg-ubGold text-black rounded text-xs disabled:opacity-40"
                          >
                            {busyReturnId === c.id ? "…" : "Mark Returned"}
                          </button>
                        )}

                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

        </div>
      </div>
    );
  }

  /* ========================= CHAT VIEW ========================= */

  return (
    <div className="p-6 max-w-4xl mx-auto">

      <button
        onClick={() => setSelectedClaim(null)}
        className="mb-4 px-4 py-2 bg-gray-800 text-white rounded"
      >
        ← Back
      </button>

      <div className="bg-gray-900 p-4 rounded-xl border border-gray-700 shadow">

        {/* HEADER */}
        <div className="flex justify-between items-start gap-4 mb-3">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">
              {selectedClaim.item?.name}
            </h2>
            <p className="text-gray-300 text-sm mb-1">
              {selectedClaim.item?.description}
            </p>
            <p className="text-gray-400 text-xs">
              📍 {selectedClaim.item?.location || "Unknown"} • 🏫{" "}
              {selectedClaim.campus || "Unknown campus"}
            </p>
            {selectedClaim.message && (
              <p className="text-sm text-gray-300 mt-2 italic">
                “{selectedClaim.message}”
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 items-end">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                (selectedClaim.status || "pending") === "approved"
                  ? "bg-green-600 text-white"
                  : (selectedClaim.status || "pending") === "rejected"
                  ? "bg-red-600 text-white"
                  : "bg-yellow-500 text-black"
              }`}
            >
              {selectedClaim.status || "pending"}
            </span>

            <div className="flex gap-2">

              <button
                onClick={downloadChatTranscript}
                className="px-3 py-1 bg-gray-700 text-white rounded text-xs hover:bg-gray-600"
              >
                Download Chat
              </button>
            </div>

          </div>
        </div>

        {/* CHAT AREA */}
        <div className="h-[50vh] overflow-y-auto space-y-3 mb-4 p-2 border-t border-b border-gray-700">
          {messages.map((msg) => {
            const isAdmin =
              msg.sender_id !== selectedClaim.user?.id;

            return (
              <div
                key={msg.id}
                className={`flex ${
                  isAdmin ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`p-3 rounded-xl max-w-[70%] ${
                    isAdmin
                      ? "bg-ubGold text-black"
                      : "bg-gray-800 text-white"
                  }`}
                >
                  <div className="flex justify-between mb-1">
                    <span className="text-xs opacity-70">
                      {isAdmin
                        ? "Admin"
                        : msg.profiles?.email ||
                          msg.profiles?.full_name ||
                          "User"}
                    </span>

                    <span className="text-[10px] opacity-70">
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

        {/* INPUT BOX */}
        <form
          onSubmit={sendMessage}
          className="flex gap-2 border-t border-gray-700 pt-3"
        >
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message…"
            className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white outline-none focus:ring-2 focus:ring-ubGold"
          />

          <button
            type="submit"
            className="px-4 py-2 bg-ubGold text-black rounded-lg font-semibold hover:bg-yellow-400"
          >
            Send
          </button>
        </form>

      </div>
    </div>
  );
}
