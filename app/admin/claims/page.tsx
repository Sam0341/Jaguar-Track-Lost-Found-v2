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

type CampusRow = {
  id: string;
  name: string;
};

type CategoryRow = {
  id: string;
  name: string;
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
  profiles?: {
    full_name: string | null;
    email: string | null;
  };
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

  /* ------------------------------------------------------------------------ */
  /*                             FETCH ALL CLAIMS                             */
  /* ------------------------------------------------------------------------ */

  const fetchClaims = async () => {
    setErrorMsg(null);

    try {
      // 1) Load all claims the current auth user is allowed to see
      const { data: claimRows, error: claimErr } = await supabase
        .from("claims")
        .select<"*", ClaimRow>("*")
        .order("created_at", { ascending: false });

      if (claimErr) throw claimErr;
      if (!claimRows || claimRows.length === 0) {
        setClaims([]);
        return;
      }

      // Collect IDs to batch query
      const itemIds = Array.from(
        new Set(claimRows.map((c) => c.item_id).filter(Boolean))
      );
      const userIds = Array.from(
        new Set(claimRows.map((c) => c.claimed_by).filter(Boolean))
      );

      // 2) Fetch all items
      let itemsMap = new Map<string, ItemRow>();
      if (itemIds.length > 0) {
        const { data: items, error: itemErr } = await supabase
          .from("items")
          .select<"*", ItemRow>("*")
          .in("id", itemIds);

        if (itemErr) throw itemErr;

        items?.forEach((it) => {
          itemsMap.set(it.id, it);
        });
      }

      // 3) Fetch all profiles for claimants
      let profilesMap = new Map<string, ProfileRow>();
      if (userIds.length > 0) {
        const { data: profiles, error: profErr } = await supabase
          .from("profiles")
          .select<"id, full_name, email", ProfileRow>("id, full_name, email")
          .in("id", userIds);

        if (profErr) throw profErr;

        profiles?.forEach((p) => {
          profilesMap.set(p.id, p);
        });
      }

      // 4) Collect campus/category IDs from items
      const campusIds = Array.from(
        new Set(
          Array.from(itemsMap.values())
            .map((it) => it.campus_id)
            .filter((id): id is string => !!id)
        )
      );

      const categoryIds = Array.from(
        new Set(
          Array.from(itemsMap.values())
            .map((it) => it.category_id)
            .filter((id): id is string => !!id)
        )
      );

      let campusMap = new Map<string, string>();
      let categoryMap = new Map<string, string>();

      if (campusIds.length > 0) {
        const { data: campuses, error: campusErr } = await supabase
          .from("campuses")
          .select<"id, name", CampusRow>("id, name")
          .in("id", campusIds);

        if (campusErr) throw campusErr;
        campuses?.forEach((c) => campusMap.set(c.id, c.name));
      }

      if (categoryIds.length > 0) {
        const { data: categories, error: catErr } = await supabase
          .from("categories")
          .select<"id, name", CategoryRow>("id, name")
          .in("id", categoryIds);

        if (catErr) throw catErr;
        categories?.forEach((c) => categoryMap.set(c.id, c.name));
      }

      // 5) Build final ClaimView list
      const final: ClaimView[] = claimRows.map((row) => {
        const item = itemsMap.get(row.item_id) || null;

        // Fix image public URL if present
        let fixedItem: ItemRow | null = item;
        if (item && item.image) {
          const { data: urlData } = supabase.storage
            .from("item-photos")
            .getPublicUrl(item.image);

          const publicUrl = urlData?.publicUrl || null;

          fixedItem = {
            ...item,
            image: publicUrl,
          };
        }

        const user = profilesMap.get(row.claimed_by) || null;

        const campusName =
          item?.campus_id ? campusMap.get(item.campus_id) || null : null;

        const categoryName =
          item?.category_id ? categoryMap.get(item.category_id) || null : null;

        return {
          id: row.id,
          message: row.message,
          status: row.status,
          created_at: row.created_at,
          item: fixedItem,
          user,
          campus: campusName,
          category: categoryName,
        };
      });

      setClaims(final);
    } catch (err: any) {
      console.error("Fetch claims error:", err);
      setErrorMsg(err.message || "Failed to fetch claims");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchClaims();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------------------------------------ */
  /*                     REALTIME DASHBOARD (CLAIMS TABLE)                    */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    const channel = supabase
      .channel("admin-claims-dashboard")
      .on(
        "postgres_changes",
        { schema: "public", table: "claims", event: "*" },
        () => {
          // whenever a claim is inserted/updated/deleted, refresh dashboard
          fetchClaims();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------------------------------------ */
  /*                         CHAT: LOAD MESSAGES (ADMIN)                      */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!selectedClaim) return;

    const claimId = selectedClaim.id;

    async function loadMessages() {
      const { data, error } = await supabase
        .from("messages")
        .select(
          "id, claim_id, sender_id, content, created_at, is_admin, profiles:sender_id(full_name, email)"
        )
        .eq("claim_id", claimId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Load messages error:", error);
        return;
      }

      // Normalize Supabase response: profiles can be returned as an array when
      // using a foreign-table select like `profiles:sender_id(...)`. Convert
      // it to the single object shape expected by our Message type.
      const normalized = (data || []).map((d: any) => {
        const profilesField = d.profiles;
        let profileObj: { full_name: string | null; email: string | null } | null = null;

        if (Array.isArray(profilesField)) {
          profileObj = profilesField[0] || null;
        } else if (profilesField && typeof profilesField === "object") {
          profileObj = profilesField;
        }

        return {
          id: d.id,
          claim_id: d.claim_id,
          sender_id: d.sender_id,
          content: d.content,
          created_at: d.created_at,
          is_admin: d.is_admin,
          profiles: profileObj,
        } as Message;
      });

      setMessages(normalized);
    }

    loadMessages();

    const channel = supabase
      .channel(`claim-${claimId}`)
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

  /* ------------------------------------------------------------------------ */
  /*                          SEND MESSAGE (ADMIN)                            */
  /* ------------------------------------------------------------------------ */

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClaim || !newMessage.trim()) return;

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return;

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

  /* ------------------------------------------------------------------------ */
  /*                     APPROVE / REJECT CLAIM STATUS                        */
  /* ------------------------------------------------------------------------ */

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

      await fetchClaims();
    } catch (err) {
      console.error("Update claim status error:", err);
    } finally {
      setBusyStatusId(null);
    }
  }

  /* ------------------------------------------------------------------------ */
  /*                       MARK ITEM AS RETURNED / CLAIMED                    */
  /* ------------------------------------------------------------------------ */

  async function markItemReturned(claim: ClaimView) {
    if (!claim.item) return;

    setBusyReturnId(claim.id);
    try {
      const nowIso = new Date().toISOString();
      const { data: authData } = await supabase.auth.getUser();
      const admin = authData?.user;

      // 1) Update item row
      const itemUpdate: Partial<ItemRow> & {
        status?: string | null;
        claimed_at?: string;
        claimed_by?: string | null;
      } = {
        status: "Claimed",
      };

      // Add claimed_at field if you have it; otherwise remove
      // @ts-ignore - if you added claimed_at column
      itemUpdate.claimed_at = nowIso;

      if (claim.user?.id) {
        // @ts-ignore - if you have claimed_by column
        itemUpdate.claimed_by = claim.user.id;
      }

      const { error: itemErr } = await supabase
        .from("items")
        .update(itemUpdate)
        .eq("id", claim.item.id);

      if (itemErr) throw itemErr;

      // 2) Ensure claim status is approved
      if (claim.status !== "approved") {
        await supabase
          .from("claims")
          .update({ status: "approved" })
          .eq("id", claim.id);
      }

      // 3) Insert into logs table
      if (admin?.id) {
        await supabase.from("logs").insert([
          {
            action: "item_returned",
            item_id: claim.item.id,
            performed_by: admin.id,
            timestamp: nowIso,
          },
        ]);
      }

      await fetchClaims();
    } catch (err) {
      console.error("Mark item returned error:", err);
      alert("Failed to mark item as returned.");
    } finally {
      setBusyReturnId(null);
    }
  }

  /* ------------------------------------------------------------------------ */
  /*                             FILTERS & STATS                              */
  /* ------------------------------------------------------------------------ */

  const filteredClaims = useMemo(() => {
    const term = search.trim().toLowerCase();

    return claims.filter((c) => {
      const effectiveStatus = (c.status || "pending").toLowerCase();

      const statusOk =
        statusFilter === "all" || effectiveStatus === statusFilter;

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

  const stats = useMemo(() => {
    const total = claims.length;
    const pending = claims.filter(
      (c) => (c.status || "pending") === "pending"
    ).length;
    const approved = claims.filter((c) => c.status === "approved").length;
    const rejected = claims.filter((c) => c.status === "rejected").length;

    return { total, pending, approved, rejected };
  }, [claims]);

  /* ------------------------------------------------------------------------ */
  /*                            LOADING / ERROR UI                            */
  /* ------------------------------------------------------------------------ */

  if (loading) {
    return (
      <div className="text-center py-10 text-gray-400">
        Loading claims…
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="text-center py-10 text-red-400">
        Failed to load claims: {errorMsg}
      </div>
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                               LIST VIEW UI                               */
  /* ------------------------------------------------------------------------ */

  if (!selectedClaim) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-ubGold mb-6">
          Claims Management
        </h1>

        {/* Filters + Counters */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
          <div className="flex gap-2 flex-wrap items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by item, campus, user, category…"
              className="w-72 px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 outline-none focus:ring-2 focus:ring-ubGold text-sm"
            />
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as
                    | "all"
                    | "pending"
                    | "approved"
                    | "rejected"
                )
              }
              className="px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-sm outline-none focus:ring-2 focus:ring-ubGold"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Realtime counters */}
          <div className="flex flex-wrap gap-2 text-xs md:text-sm">
            <span className="px-3 py-1 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-100">
              Total: <b>{stats.total}</b>
            </span>
            <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-200">
              Pending: <b>{stats.pending}</b>
            </span>
            <span className="px-3 py-1 rounded-full bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-200">
              Approved: <b>{stats.approved}</b>
            </span>
            <span className="px-3 py-1 rounded-full bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-200">
              Rejected: <b>{stats.rejected}</b>
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-gray-900 rounded-xl shadow border border-gray-700 overflow-hidden">
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
                    className="py-6 text-center text-gray-500"
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
                    className="border-b border-gray-800 hover:bg-gray-800/80 transition"
                  >
                    <td className="px-4 py-3 font-semibold text-ubGold">
                      {c.item?.name || "—"}
                    </td>
                    <td className="px-4 py-3">{c.campus || "—"}</td>
                    <td className="px-4 py-3">
                      {c.user?.email || c.user?.full_name || "—"}
                    </td>
                    <td className="px-4 py-3">{c.category || "—"}</td>
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
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2 justify-center">
                        <button
                          onClick={() => setSelectedClaim(c)}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-xs"
                        >
                          Chat
                        </button>

                        <button
                          onClick={() =>
                            updateClaimStatus(c.id, "approved")
                          }
                          disabled={busyStatusId === c.id}
                          className="px-3 py-1 bg-green-600 text-white rounded text-xs disabled:opacity-50"
                        >
                          {busyStatusId === c.id ? "…" : "Approve"}
                        </button>

                        <button
                          onClick={() =>
                            updateClaimStatus(c.id, "rejected")
                          }
                          disabled={busyStatusId === c.id}
                          className="px-3 py-1 bg-red-600 text-white rounded text-xs disabled:opacity-50"
                        >
                          {busyStatusId === c.id ? "…" : "Reject"}
                        </button>

                        {canMarkReturned && (
                          <button
                            onClick={() => markItemReturned(c)}
                            disabled={busyReturnId === c.id}
                            className="px-3 py-1 bg-ubGold text-black rounded text-xs disabled:opacity-50"
                          >
                            {busyReturnId === c.id
                              ? "Marking…"
                              : "Mark Returned"}
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

  /* ------------------------------------------------------------------------ */
  /*                                CHAT VIEW UI                              */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={() => setSelectedClaim(null)}
        className="mb-4 px-4 py-2 bg-gray-800 text-white rounded"
      >
        ← Back
      </button>

      <div className="bg-gray-900 p-4 rounded-xl border border-gray-700 shadow">
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

            {(selectedClaim.status || "pending") === "approved" &&
              selectedClaim.item?.status !== "Claimed" && (
                <button
                  onClick={() => markItemReturned(selectedClaim)}
                  disabled={busyReturnId === selectedClaim.id}
                  className="px-3 py-1 bg-ubGold text-black rounded text-xs disabled:opacity-50"
                >
                  {busyReturnId === selectedClaim.id
                    ? "Marking…"
                    : "Mark Item Returned"}
                </button>
              )}
          </div>
        </div>

        <div className="h-[50vh] overflow-y-auto space-y-3 mb-4 p-2 border-t border-b border-gray-700">
          {messages.map((msg) => {
            const isAdmin =
              msg.profiles?.email &&
              !msg.profiles.email.endsWith("@ub.edu.bz");

            return (
              <div
                key={msg.id}
                className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
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
                      {isAdmin ? "Admin" : msg.profiles?.email || "User"}
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
