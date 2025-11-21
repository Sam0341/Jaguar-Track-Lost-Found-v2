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
          item:
            item && {
              ...item,
              image: imageUrl,
            },
          user,
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
  useEffect(() => {
    if (!selectedClaim) return;

    const claimId = selectedClaim.id;

    async function loadMessages() {
      const { data } = await supabase
        .from("messages")
        .select("*")
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

  /* ========================= ADMIN SEND MESSAGE ========================= */
  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!selectedClaim) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const form = e.target as HTMLFormElement;
    const text = (form.elements.namedItem("message") as HTMLInputElement).value.trim();

    let imageUrl: string | null = null;

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

    await supabase.from("messages").insert([
      {
        claim_id: selectedClaim.id,
        sender_id: user.id,
        content: finalContent,
        is_admin: true,
        image_url: imageUrl,
      },
    ]);

    form.reset();
    setSelectedFile(null);
    setPreviewImage(null);
  }

  /* ========================= DOWNLOAD CHAT ========================= */
  function downloadChatTranscript() {
    if (!selectedClaim) return;

    if (messages.length === 0) {
      alert("No messages to export.");
      return;
    }

    const lines: string[] = [];

    lines.push("Jaguar Track Lost & Found – Claim Chat Transcript");
    lines.push("--------------------------------------------------");
    lines.push(`Claim ID: ${selectedClaim.id}`);
    lines.push(`Item: ${selectedClaim.item?.name || "Unknown"}`);
    lines.push(`User: ${selectedClaim.user?.email || "Unknown"}`);
    lines.push(`Status: ${selectedClaim.status}`);
    lines.push("");
    lines.push("CHAT LOG");
    lines.push("--------------------------------------------------");
    lines.push("");

    messages.forEach((msg) => {
      const who = msg.is_admin ? "ADMIN" : selectedClaim.user?.email || "USER";
      const time = new Date(msg.created_at).toLocaleString();

      if (msg.image_url) {
        lines.push(`[${time}] ${who}: (Image) ${msg.image_url}`);
      }

      if (msg.content !== "[image]") {
        lines.push(`[${time}] ${who}: ${msg.content}`);
      }
    });

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
  if (!selectedClaim) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        {/* CLAIMS LIST (unchanged) */}
        { /* ... your full list code stays here ... */ }
      </div>
    );
  }

  /* ========================= SELECTED CLAIM CHAT UI ========================= */
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

            {/* ⭐ DOWNLOAD BUTTON */}
            <button
              onClick={downloadChatTranscript}
              className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-500"
            >
              ⬇ Download Chat
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
                    isAdmin ? "bg-ubGold text-black" : "bg-gray-800 text-white"
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
