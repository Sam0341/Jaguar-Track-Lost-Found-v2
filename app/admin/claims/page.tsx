"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/* ============================
   TYPES
============================ */

type Campus = {
  id: string;
  name: string;
};

type Category = {
  id: string;
  name: string;
};

type ItemData = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  image: string | null;
  campus_id: string | null;
  category_id: string | null;

  campuses?: Campus | null;
  categories?: Category | null;
};

type ProfileData = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone?: string | null;
};

type ClaimView = {
  id: string;
  item_id: string;
  claimed_by: string;
  message: string | null;
  status: string | null;
  created_at: string;

  items?: ItemData | null;
  profiles?: ProfileData | null;
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
  } | null;
};

/* ============================
   PAGE START
============================ */

export default function AdminClaimsPage() {
  const [claims, setClaims] = useState<ClaimView[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<ClaimView | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<"all" | "pending" | "approved" | "rejected">("all");

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastOpen, setToastOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* ============================
     LOAD CLAIMS
  ============================ */

  async function fetchClaims() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("claims")
        .select(`
          id,
          item_id,
          claimed_by,
          message,
          status,
          created_at,

          items:item_id (
            id,
            name,
            description,
            location,
            image,
            campus_id,
            category_id,

            campuses:campus_id (
              id,
              name
            ),

            categories:category_id (
              id,
              name
            )
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

      setClaims((data as unknown as ClaimView[]) || []);
    } catch (err: any) {
      console.error("Fetch claims error:", err);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchClaims();
  }, []);

  /* ============================
     UPDATE STATUS
  ============================ */

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

      openToast(`Claim ${status}!`);
      fetchClaims();
    } catch (err: any) {
      openToast("Failed to update status.");
    }

    setActionLoading(null);
  }

  /* ============================
     LOAD MESSAGES FOR CHAT
  ============================ */

  useEffect(() => {
    const claimId = selectedClaim?.id;
    if (!claimId) return;

    async function loadMessages() {
      const { data } = await supabase
        .from("messages")
        .select(`*, profiles:sender_id(full_name, email)`)
        .eq("claim_id", claimId)
        .order("created_at", { ascending: true });

      setMessages(data || []);
    }

    loadMessages();

    const channel = supabase
      .channel(`messages:claim=${claimId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          table: "messages",
          schema: "public",
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

  /* ============================
     SEND MESSAGE
  ============================ */

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedClaim || !newMessage.trim()) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("messages").insert([
      {
        claim_id: selectedClaim.id,
        sender_id: user?.id,
        content: newMessage.trim(),
        is_admin: true,
      },
    ]);

    setNewMessage("");
  }

  /* ============================
     TOAST
  ============================ */

  function openToast(msg: string) {
    setToastMsg(msg);
    setToastOpen(true);
    setTimeout(() => setToastOpen(false), 3000);
  }

  /* ============================
     FILTERS
  ============================ */

  const filteredClaims = useMemo(() => {
    const term = search.toLowerCase().trim();

    return claims.filter((c) => {
      const statusMatch =
        statusFilter === "all" || (c.status ?? "pending") === statusFilter;

      const txt =
        [
          c.items?.name,
          c.items?.location,
          c.items?.campuses?.name,
          c.items?.categories?.name,
          c.profiles?.full_name,
          c.profiles?.email,
        ]
          .join(" ")
          .toLowerCase() || "";

      const searchMatch = !term || txt.includes(term);

      return statusMatch && searchMatch;
    });
  }, [claims, search, statusFilter]);

  /* ============================
     PAGE UI
  ============================ */

  if (loading)
    return (
      <div className="py-20 text-center text-gray-400">Loading claims…</div>
    );

  return (
    <div className="p-6 max-w-7xl mx-auto relative">
      <h1 className="text-3xl font-bold text-ubGold mb-8">Claims Management</h1>

      {/* Toast */}
      {toastOpen && toastMsg && (
        <div className="fixed top-6 right-6 bg-green-600 text-white px-5 py-3 rounded shadow-lg">
          {toastMsg}
        </div>
      )}

      {/* Filters */}
      {!selectedClaim && (
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <input
            placeholder="Search claims…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 rounded border bg-gray-900 border-gray-700 text-white w-80"
          />

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as "all" | "pending" | "approved" | "rejected"
              )
            }
            className="px-3 py-2 rounded border bg-gray-900 border-gray-700 text-white"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      )}

      {/* LIST VIEW */}
      {!selectedClaim && (
        <div className="overflow-x-auto bg-gray-900 rounded-xl border border-gray-700 shadow">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-800 text-gray-300">
              <tr>
                <th className="px-5 py-3">Item</th>
                <th className="px-5 py-3">Campus</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Claimant</th>
                <th className="px-5 py-3">Message</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-center">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredClaims.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-gray-700 hover:bg-gray-800"
                >
                  <td className="px-5 py-3 text-ubGold font-semibold">
                    {c.items?.name}
                  </td>

                  <td className="px-5 py-3">
                    {c.items?.campuses?.name ?? "—"}
                  </td>

                  <td className="px-5 py-3">
                    {c.items?.categories?.name ?? "—"}
                  </td>

                  <td className="px-5 py-3">
                    {c.profiles?.email || c.profiles?.full_name || "—"}
                  </td>

                  <td className="px-5 py-3 text-gray-400 max-w-xs truncate">
                    {c.message ?? "—"}
                  </td>

                  <td className="px-5 py-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        (c.status ?? "pending") === "approved"
                          ? "bg-green-600"
                          : (c.status ?? "pending") === "rejected"
                          ? "bg-red-600"
                          : "bg-yellow-500"
                      } text-white`}
                    >
                      {c.status ?? "pending"}
                    </span>
                  </td>

                  <td className="px-5 py-3 text-center flex gap-2 justify-center">
                    <button
                      onClick={() => setSelectedClaim(c)}
                      className="px-3 py-1 bg-blue-600 text-white rounded"
                    >
                      Chat
                    </button>

                    <button
                      onClick={() => updateClaimStatus(c.id, "approved")}
                      disabled={actionLoading !== null}
                      className="px-3 py-1 bg-green-600 text-white rounded disabled:opacity-50"
                    >
                      Approve
                    </button>

                    <button
                      onClick={() => updateClaimStatus(c.id, "rejected")}
                      disabled={actionLoading !== null}
                      className="px-3 py-1 bg-red-600 text-white rounded disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}

              {filteredClaims.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-10 text-gray-400"
                  >
                    No claims found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CHAT VIEW */}
      {selectedClaim && (
        <div className="max-w-3xl mx-auto bg-gray-900 rounded-xl mt-6 border border-gray-700 shadow">
          <div className="flex justify-between items-center bg-gray-800 px-5 py-4">
            <div>
              <h2 className="text-lg font-bold text-ubGold">
                {selectedClaim.items?.name}
              </h2>
              <p className="text-xs text-gray-400">
                {selectedClaim.profiles?.email} •{" "}
                {selectedClaim.items?.campuses?.name}
              </p>
            </div>

            <button
              className="text-gray-300 hover:text-white"
              onClick={() => setSelectedClaim(null)}
            >
              ← Back
            </button>
          </div>

          {/* MESSAGES */}
          <div className="p-4 h-[65vh] overflow-y-auto space-y-3">
            {messages.map((msg) => {
              const isAdmin = msg.is_admin;

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
                        : "bg-gray-800 text-white border border-gray-700"
                    }`}
                  >
                    <div className="text-xs text-gray-700 mb-1">
                      {isAdmin ? "Admin" : msg.profiles?.email}
                    </div>

                    <p>{msg.content}</p>

                    <div className="text-[10px] opacity-60 mt-1">
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>

          {/* INPUT */}
          <form
            onSubmit={sendMessage}
            className="flex gap-2 border-t border-gray-700 p-4 bg-gray-800"
          >
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 rounded bg-gray-900 border border-gray-700 text-white"
            />
            <button
              type="submit"
              className="bg-ubGold text-black px-4 py-2 rounded"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
