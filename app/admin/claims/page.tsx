"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  FormEvent,
} from "react";
import { supabase } from "@/lib/supabaseClient";

/* ---------------------------------- TYPES ---------------------------------- */
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
  is_admin: boolean;
  image_url?: string | null;
};

/* -------------------------------------------------------------------------- */
/*                                MAIN COMPONENT                              */
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

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  /* ========================= FETCH ALL CLAIMS ========================= */
  /* ========================= FETCH ALL CLAIMS ========================= */
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
      /* ---------------- LOAD ITEM ---------------- */
      const { data: item } = await supabase
        .from("items")
        .select("*")
        .eq("id", row.item_id)
        .single();

      /* ---------------- LOAD USER WHO MADE THE CLAIM ---------------- */
      const { data: user } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", row.claimed_by)   // ✅ who claimed the item (CORRECT)
        .single();

      /* ---------------- CAMPUS ---------------- */
      const { data: campus } =
        item?.campus_id
          ? await supabase
              .from("campuses")
              .select("name")
              .eq("id", item.campus_id)
              .single()
          : { data: null };

      /* ---------------- CATEGORY ---------------- */
      const { data: category } =
        item?.category_id
          ? await supabase
              .from("categories")
              .select("name")
              .eq("id", item.category_id)
              .single()
          : { data: null };

      /* ---------------- IMAGE ---------------- */
      let imageUrl: string | null = null;
      if (item?.image) {
        const { data: url } = supabase.storage
          .from("item-photos")
          .getPublicUrl(item.image);
        imageUrl = url?.publicUrl || null;
      }

      /* ---------------- PUSH FINAL ROW ---------------- */
      final.push({
        id: row.id,
        message: row.message,
        status: row.status,
        created_at: row.created_at,

        item: item && {
          ...item,
          image: imageUrl,
        },

        user,                // ✅ NOW SHOWS CLAIM USER (not reporter)
        campus: campus?.name || null,
        category: category?.name || null,
      });
    }

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
}, []);


  /* ========================= REALTIME CLAIM UPDATES ========================= */
  useEffect(() => {
  const channel = supabase
    .channel("admin-claims-dashboard")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "claims",
      },
      () => fetchClaims()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);

  /* ========================= LOAD + REALTIME MESSAGES ========================= */
  /* ===================== LOAD + REALTIME MESSAGES ===================== */
useEffect(() => {
  if (!selectedClaim) return;

  const claimId = selectedClaim.id;

  async function loadMessages() {
    const { data } = await supabase
      .from("messages")
      .select(`
        id,
        claim_id,
        sender_id,
        content,
        created_at,
        is_admin,
        image_url
      `)
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
      setMessages((prev: Message[]) => [
        ...prev,
        payload.new as Message,
      ]);
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

  /* ========================= ADMIN SEND MESSAGE ========================= */
  /* ========================= ADMIN SEND MESSAGE ========================= */
async function sendMessage(e: any) {
  e.preventDefault();

  // ✅ SAFETY CHECK — Must have a claim selected
  if (!selectedClaim || !selectedClaim.id) {
    console.error("No claim selected");
    return;
  }

  // ✅ GET CURRENT ADMIN USER
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData?.user) {
    console.error("Not logged in");
    return;
  }

  const user = authData.user; // <-- FIXED!

  const text = e.target.elements.message.value.trim();
  let imageUrl: string | null = null;

  // ===== OPTIONAL IMAGE UPLOAD =====
  if (selectedFile) {
    const ext = selectedFile.name.split(".").pop();
    const fileName = `${selectedClaim.id}/${Date.now()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("chat_uploads")
      .upload(fileName, selectedFile);

    if (!uploadErr) {
      const { data } = supabase.storage
        .from("chat_uploads")
        .getPublicUrl(fileName);

      imageUrl = data.publicUrl;
    }
  }

  const finalContent = text || (imageUrl ? "[image]" : "");

  // ===== INSERT MESSAGE =====
  await supabase.from("messages").insert([
    {
      claim_id: selectedClaim.id,
      sender_id: user.id,     // <-- FIXED — Won't crash
      content: finalContent,
      is_admin: true,
      image_url: imageUrl,
    },
  ]);

  e.target.reset();
  setSelectedFile(null);
  setPreviewImage(null);
}


  /* ========================= CHANGE CLAIM STATUS ========================= */
  async function updateClaimStatus(id: string, status: "approved" | "rejected") {
    setBusyStatusId(id);
    await supabase.from("claims").update({ status }).eq("id", id);
    setBusyStatusId(null);
    fetchClaims();
  }

  /* ========================= MARK RETURNED ========================= */
  async function markItemReturned(c: ClaimView) {
    if (!c.item) return;
    setBusyReturnId(c.id);

    const nowIso = new Date().toISOString();
    const {
      data: { user: admin },
    } = await supabase.auth.getUser();

    await supabase.from("items").update({ status: "Claimed" }).eq("id", c.item.id);

    if (c.status !== "approved") {
      await supabase.from("claims").update({ status: "approved" }).eq("id", c.id);
    }

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

    setBusyReturnId(null);
    fetchClaims();
  }

  /* ========================= FILTERS ========================= */
  const filteredClaims = useMemo(() => {
    const term = search.toLowerCase();

    return claims.filter((c) => {
      const statusValue = (c.status || "pending").toLowerCase();

      const statusOk = statusFilter === "all" || statusValue === statusFilter;

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

      return statusOk && haystack.includes(term);
    });
  }, [claims, search, statusFilter]);

  /* ========================= UI ========================= */

  if (loading)
    return <div className="text-center py-10 text-gray-400">Loading claims…</div>;

  if (errorMsg)
    return (
      <div className="text-center py-10 text-red-400">
        Failed to load claims: {errorMsg}
      </div>
    );

  /* ========================= CLAIMS LIST VIEW ========================= */
  if (!selectedClaim) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-ubGold mb-6">
          Claims Management
        </h1>

        {/* FILTERS */}
        <div className="flex flex-col md:flex-row justify-between gap-3 mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by item, campus, user, category…"
            className="w-72 px-3 py-2 rounded-md bg-gray-900 border border-gray-700 outline-none focus:ring-2 focus:ring-ubGold text-sm"
          />

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as "all" | "pending" | "approved" | "rejected"
              )
            }
            className="px-3 py-2 rounded-md bg-gray-900 border border-gray-700 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* TABLE */}
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
                    No claims found.
                  </td>
                </tr>
              )}

              {filteredClaims.map((c) => {
                const effectiveStatus = c.status || "pending";

                return (
                  <tr
                    key={c.id}
                    className="border-b border-gray-800 hover:bg-gray-800/80 transition"
                  >
                    <td className="px-4 py-3 font-semibold text-ubGold">
                      {c.item?.name}
                    </td>
                    <td className="px-4 py-3">{c.campus}</td>
                    <td className="px-4 py-3">
                      {c.user?.email || c.user?.full_name}
                    </td>
                    <td className="px-4 py-3">{c.category}</td>
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
                      <div className="flex gap-2 justify-center">
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

                        {effectiveStatus === "approved" &&
                          c.item?.status !== "Claimed" && (
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
  /* ========================= DOWNLOAD CHAT ========================= */
  function downloadChatTranscript() {
  if (!selectedClaim) return;

  //-- 1: Prepare user label (full name → email → Unknown)
  const userLabel =
    selectedClaim.user?.full_name ||
    selectedClaim.user?.email ||
    "Unknown User";

  //-- 2: Skip if no messages
  if (messages.length === 0) {
    alert("No messages to export.");
    return;
  }

  //-- 3: Header info
  const lines: string[] = [];

  lines.push("Jaguar Track Lost & Found – Claim Chat Transcript");
  lines.push("--------------------------------------------------");
  lines.push(`Claim ID: ${selectedClaim.id}`);
  lines.push(`Item: ${selectedClaim.item?.name || "Unknown"}`);
  lines.push(`User: ${userLabel}`);
  lines.push(`Status: ${selectedClaim.status || "pending"}`);
  lines.push("");
  lines.push("CHAT LOG");
  lines.push("--------------------------------------------------");
  lines.push("");

  //-- 4: Format messages
  messages.forEach((msg) => {
    // Skip empty text messages
    const hasText =
      msg.content && msg.content.trim() !== "" && msg.content !== "[image]";

    const hasImage = !!msg.image_url;

    if (!hasText && !hasImage) return; // don't include empty entries

    const sender = msg.is_admin
      ? "ADMIN"
      : userLabel; // user full name/email, not "USER"

    const time = new Date(msg.created_at).toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    if (hasText) {
      lines.push(`[${time}] ${sender}: ${msg.content}`);
    }

    if (hasImage) {
      lines.push(`[${time}] ${sender} (Image):`);
      lines.push(`${msg.image_url}`);
    }

    lines.push(""); // spacing between messages
  });

  //-- 5: Convert to file and download
  const text = lines.join("\n");
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `claim-${selectedClaim.id}-chat.txt`;
  link.click();

  URL.revokeObjectURL(url);
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
  {/* LEFT SIDE - ITEM INFO */}
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

  {/* RIGHT SIDE - STATUS + DOWNLOAD BUTTON */}
  <div className="flex flex-col items-end gap-2">
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

    {/* 📥 DOWNLOAD CHAT BUTTON */}
    <button
      onClick={downloadChatTranscript}
      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs shadow"
    >
      Download Chat
    </button>
  </div>
</div>


        {/* MESSAGES */}
        <div className="h-[55vh] overflow-y-auto space-y-3 mb-4 p-2 border-t border-b border-gray-700">
          {messages.map((msg) => {
            const isAdmin = msg.is_admin;

            return (
              <div
                key={msg.id}
                className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`p-3 rounded-xl max-w-[70%] shadow ${
                    isAdmin
                      ? "bg-ubGold text-black"
                      : "bg-gray-800 text-white"
                  }`}
                >
                  {msg.image_url && (
                    <img
                      src={msg.image_url}
                      className="rounded-lg max-h-60 mb-2 cursor-pointer"
                      onClick={() => window.open(msg.image_url!, "_blank")}
                    />
                  )}

                  {msg.content !== "[image]" && (
                    <p className="text-sm">{msg.content}</p>
                  )}

                  <div className="text-[10px] opacity-70 mt-1 text-right">
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

        {/* IMAGE PREVIEW */}
        {previewImage && (
          <div className="mb-3 flex items-center gap-3">
            <img
              src={previewImage}
              className="w-20 h-20 object-cover rounded-lg border border-gray-700"
            />
            <button
              className="text-red-400"
              onClick={() => {
                setPreviewImage(null);
                setSelectedFile(null);
              }}
            >
              Remove
            </button>
          </div>
        )}

        {/* INPUT */}
        <form
          onSubmit={sendMessage}
          className="flex gap-2 border-t border-gray-700 pt-3"
        >
          <label className="cursor-pointer bg-gray-700 px-3 py-2 rounded-lg text-white border border-gray-600">
            📎
            <input
              type="file"
              hidden
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setSelectedFile(file);
                  setPreviewImage(URL.createObjectURL(file));
                }
              }}
            />
          </label>

          <input
            name="message"
            type="text"
            className="flex-1 px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700"
            placeholder="Type your message…"
          />

          <button className="px-4 py-2 bg-ubGold text-black rounded-lg font-semibold hover:bg-yellow-400">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
