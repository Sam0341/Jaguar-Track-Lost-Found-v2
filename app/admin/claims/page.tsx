"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/* -------------------------------------------------------------------------- */
/*                                    TYPES                                   */
/* -------------------------------------------------------------------------- */

type ItemRow = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  image: string | null;
  status: string | null;
  campus_id: string | null;
  category_id: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role?: string | null;
};

type ClaimRow = {
  id: string;
  item_id: string;
  claimed_by: string;
  message: string | null;
  status: string | null;
  created_at: string;
  updated_at: string | null;
};

type ClaimView = {
  id: string;
  message: string | null;
  status: string | null;
  created_at: string | null;

  item: ItemRow | null;
  user: ProfileRow | null;
  campus: string | null;
  category: string | null;
};

type Message = {
  id: string;
  claim_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_admin: boolean;
  profiles: {
    full_name: string | null;
    email: string | null;
    role: string | null;
  } | null;
};

/* -------------------------------------------------------------------------- */
/*                              MAIN COMPONENT                                */
/* -------------------------------------------------------------------------- */

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

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  /* -------------------------------------------------------------------------- */
  /*                             FETCH ALL CLAIMS                               */
  /* -------------------------------------------------------------------------- */

  const fetchClaims = async () => {
    setErrorMsg(null);

    try {
      const { data: claimRows, error: claimErr } = await supabase
        .from("claims")
        .select("*")
        .order("created_at", { ascending: false });

      if (claimErr) throw claimErr;

      if (!claimRows?.length) {
        setClaims([]);
        return;
      }

      const itemIds = [...new Set(claimRows.map((c) => c.item_id))];
      const userIds = [...new Set(claimRows.map((c) => c.claimed_by))];

      const { data: items } = await supabase
        .from("items")
        .select("*")
        .in("id", itemIds);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .in("id", userIds);

      const { data: campuses } = await supabase
        .from("campuses")
        .select("id, name");

      const { data: categories } = await supabase
        .from("categories")
        .select("id, name");

      const itemsMap = new Map(items?.map((i) => [i.id, i]));
      const profilesMap = new Map(profiles?.map((p) => [p.id, p]));
      const campusMap = new Map(campuses?.map((c) => [c.id, c.name]));
      const categoryMap = new Map(categories?.map((c) => [c.id, c.name]));

      const final = claimRows.map((row) => {
        const item = itemsMap.get(row.item_id) || null;
        const user = profilesMap.get(row.claimed_by) || null;

        // fix image url
        let fixedItem = item;
        if (item?.image) {
          const { data } = supabase.storage
            .from("item-photos")
            .getPublicUrl(item.image);

          fixedItem = { ...item, image: data?.publicUrl ?? null };
        }

        return {
          id: row.id,
          message: row.message,
          status: row.status,
          created_at: row.created_at,
          item: fixedItem,
          user,
          campus: item?.campus_id ? campusMap.get(item.campus_id) : null,
          category: item?.category_id ? categoryMap.get(item.category_id) : null,
        };
      });

      setClaims(final);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
  }, []);

  /* -------------------------------------------------------------------------- */
  /*                             REALTIME CLAIM UPDATES                         */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    const channel = supabase
      .channel("claims-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "claims" },
        () => fetchClaims()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  /* -------------------------------------------------------------------------- */
  /*                            LOAD CHAT MESSAGES                              */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    if (!selectedClaim) return;

    const claimId = selectedClaim.id;

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
          profiles:sender_id (
            full_name,
            email,
            role
          )
        `)
        .eq("claim_id", claimId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error(error);
        return;
      }

      const normalized: Message[] = data.map((m: any) => ({
        id: m.id,
        claim_id: m.claim_id,
        sender_id: m.sender_id,
        content: m.content,
        created_at: m.created_at,
        is_admin: m.is_admin === true,
        profiles: m.profiles
          ? {
              full_name: m.profiles.full_name,
              email: m.profiles.email,
              role: m.profiles.role,
            }
          : null,
      }));

      setMessages(normalized);
    }

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
        () => loadMessages()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selectedClaim]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* -------------------------------------------------------------------------- */
  /*                           SEND ADMIN MESSAGE                               */
  /* -------------------------------------------------------------------------- */

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClaim || !newMessage.trim()) return;

    const { data } = await supabase.auth.getUser();
    if (!data.user) return;

    await supabase.from("messages").insert([
      {
        claim_id: selectedClaim.id,
        sender_id: data.user.id,
        content: newMessage.trim(),
        is_admin: true,
      },
    ]);

    setNewMessage("");
  }

  /* -------------------------------------------------------------------------- */
  /*                             UI RENDERING BELOW                              */
  /* -------------------------------------------------------------------------- */

  if (loading) return <div className="p-6 text-gray-400">Loading…</div>;

  if (errorMsg)
    return <div className="p-6 text-red-500">Error: {errorMsg}</div>;

  /* -------------------------------------------------------------------------- */
  /*                              CLAIM LIST UI                                 */
  /* -------------------------------------------------------------------------- */

  if (!selectedClaim) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-ubGold mb-6">
          Claims Management
        </h1>

        {/* Search + Filter */}
        <div className="flex items-center gap-3 mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="px-3 py-2 rounded bg-gray-900 border border-gray-700 text-white w-72"
          />
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as "all" | "pending" | "approved" | "rejected"
              )
            }
            className="px-3 py-2 bg-gray-900 border border-gray-700 text-white rounded"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Claims table */}
        <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
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
              {claims.map((c) => {
                const effectiveStatus = c.status || "pending";

                return (
                  <tr
                    key={c.id}
                    className="border-b border-gray-800 hover:bg-gray-800/80"
                  >
                    <td className="px-4 py-3 text-ubGold">{c.item?.name}</td>
                    <td className="px-4 py-3">{c.campus}</td>
                    <td className="px-4 py-3">
                      {c.user?.email || c.user?.full_name || "—"}
                    </td>
                    <td className="px-4 py-3">{c.category}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          effectiveStatus === "approved"
                            ? "bg-green-600"
                            : effectiveStatus === "rejected"
                            ? "bg-red-600"
                            : "bg-yellow-500 text-black"
                        }`}
                      >
                        {effectiveStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setSelectedClaim(c)}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-xs"
                      >
                        Chat
                      </button>
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

  /* -------------------------------------------------------------------------- */
  /*                              CHAT VIEW UI                                   */
  /* -------------------------------------------------------------------------- */

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button
        onClick={() => setSelectedClaim(null)}
        className="mb-4 px-4 py-2 bg-gray-800 text-white rounded"
      >
        ← Back
      </button>

      <div className="bg-gray-900 p-4 rounded-xl border border-gray-700 shadow">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">
              {selectedClaim.item?.name}
            </h2>
            <p className="text-gray-400 text-sm">
              {selectedClaim.item?.description}
            </p>
          </div>

          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              selectedClaim.status === "approved"
                ? "bg-green-600"
                : selectedClaim.status === "rejected"
                ? "bg-red-600"
                : "bg-yellow-500 text-black"
            }`}
          >
            {selectedClaim.status}
          </span>
        </div>

        {/* Messages */}
        <div className="h-[55vh] overflow-y-auto space-y-3 p-2 border-y border-gray-700">
          {messages.map((msg) => {
            const isAdmin = msg.is_admin === true;

            return (
              <div
                key={msg.id}
                className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`p-3 rounded-lg max-w-[70%] ${
                    isAdmin ? "bg-ubGold text-black" : "bg-gray-800 text-white"
                  }`}
                >
                  <div className="text-xs opacity-70 mb-1">
                    {isAdmin ? "Admin" : msg.profiles?.email || "User"}
                  </div>
                  <p className="text-sm">{msg.content}</p>
                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* Send Message */}
        <form onSubmit={sendMessage} className="flex gap-2 pt-3">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message…"
            className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-ubGold text-black rounded-lg font-semibold"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
