"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

// TYPES BASED ON YOUR NEW SCHEMA 🔥🔥
type Item = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  image: string | null;
  campus_id: string | null;
  category_id: string | null;
};

type Claim = {
  id: string;
  item_id: string;
  claimed_by: string;
  message: string | null;
  status: string | null;
  created_at: string;
  item?: Item | null;
  profiles?: {
    full_name: string | null;
    email: string | null;
  };
};

type Message = {
  id: string;
  claim_id: string;
  sender_id: string;
  content: string | null;
  file_url: string | null;
  created_at: string;
  is_admin: boolean;
  seen: boolean;
  profiles?: {
    full_name: string | null;
    email: string | null;
  };
};

export default function AdminClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // FETCH ALL CLAIMS (JOIN PROFILES + ITEMS) ✔️
  useEffect(() => {
    async function loadClaims() {
      const { data: claimRows } = await supabase
        .from("claims")
        .select("*, profiles:claimed_by(full_name,email)")
        .order("created_at", { ascending: false });

      if (!claimRows) return setClaims([]);

      const result: Claim[] = [];

      for (const claim of claimRows) {
        const { data: item } = await supabase
          .from("items")
          .select("*")
          .eq("id", claim.item_id)
          .single();

        let imageUrl = null;
        if (item?.image) {
          const { data: img } = supabase.storage
            .from("item-photos")
            .getPublicUrl(item.image);

          imageUrl = img?.publicUrl ?? null;
        }

        result.push({
          ...claim,
          item: item
            ? {
                ...item,
                image: imageUrl,
              }
            : null,
        });
      }

      setClaims(result);
      setLoading(false);
    }

    loadClaims();
  }, []);

  // FETCH MESSAGES + REALTIME ✔️
  useEffect(() => {
    if (!selectedClaim) return;

    const claimId = selectedClaim.id;

    async function loadMessages() {
      const { data } = await supabase
        .from("messages")
        .select(
          "id, claim_id, sender_id, content, file_url, created_at, is_admin, seen, profiles:sender_id(full_name,email)"
        )
        .eq("claim_id", claimId)
        .order("created_at", { ascending: true });

      const normalized = (data || []).map((m: any) => ({
        ...m,
        profiles: Array.isArray(m.profiles) ? m.profiles[0] : m.profiles,
      }));

      setMessages(normalized);

      // MARK USER MESSAGES AS SEEN
      await supabase
        .from("messages")
        .update({ seen: true })
        .eq("claim_id", claimId)
        .eq("is_admin", false);
    }

    loadMessages();

    const channel = supabase
      .channel(`claim-${claimId}`)
      .on(
        "postgres_changes" as any,
        { event: "INSERT", table: "messages", filter: `claim_id=eq.${claimId}` },
        (payload: any) => {
          // Supabase realtime payload may nest the row under payload.payload.new for broadcast events,
          // fall back to payload.new if present.
          const newRow = payload?.payload?.new ?? payload?.new;
          setMessages((prev) => [...prev, newRow as Message]);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selectedClaim]);

  // SEND TEXT MESSAGE ✔️
  async function sendMessage(e: any) {
    e.preventDefault();
    if (!newMessage.trim() || !selectedClaim) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    await supabase.from("messages").insert([
      {
        claim_id: selectedClaim.id,
        sender_id: user.id,
        content: newMessage,
        file_url: null,
        is_admin: true,
        seen: false,
      },
    ]);

    setNewMessage("");
  }

  // SEND IMAGE ✔️
  async function sendImage(e: any) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedClaim) return;

    const ext = file.name.split(".").pop();
    const path = `${selectedClaim.id}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("chat-attachments")
      .upload(path, file);

    if (error) return;

    const { data } = supabase.storage
      .from("chat-attachments")
      .getPublicUrl(path);

    const url = data?.publicUrl;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    await supabase.from("messages").insert([
      {
        claim_id: selectedClaim.id,
        sender_id: user.id,
        content: null,
        file_url: url,
        is_admin: true,
        seen: false,
      },
    ]);
  }

  // UI — CLAIM LIST VIEW
  if (!selectedClaim) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-ubGold mb-6">
          Admin — All Claims
        </h1>

        {loading ? (
          <p className="text-center text-gray-400">Loading…</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {claims.map((c) => (
              <div
                key={c.id}
                className="bg-gray-900 p-4 rounded-xl border border-gray-800 hover:border-ubGold cursor-pointer transition"
                onClick={() => setSelectedClaim(c)}
              >
                <img
                  src={
                    c.item?.image ||
                    "https://placehold.co/300x200?text=No+Image"
                  }
                  className="w-full h-40 object-cover rounded-lg"
                />

                <h2 className="text-lg font-semibold text-white mt-2">
                  {c.item?.name}
                </h2>

                <p className="text-gray-400 text-sm">
                  {c.profiles?.email || "Unknown User"}
                </p>

                <span
                  className={`inline-block mt-2 px-3 py-1 text-xs rounded-full ${
                    c.status === "approved"
                      ? "bg-green-600"
                      : c.status === "rejected"
                      ? "bg-red-600"
                      : "bg-yellow-600"
                  }`}
                >
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // UI — CHAT VIEW
  return (
    <div className="max-w-4xl mx-auto p-6">
      <button
        onClick={() => setSelectedClaim(null)}
        className="mb-4 px-4 py-2 bg-gray-800 text-white rounded-lg"
      >
        ← Back
      </button>

      <div className="rounded-xl bg-gray-900 p-5 border border-gray-800 shadow-lg">
        <h2 className="text-xl font-bold text-white mb-2">
          {selectedClaim.item?.name}
        </h2>

        {/* CHAT */}
        <div className="h-[60vh] overflow-y-auto space-y-4 p-2 border-y border-gray-700">
          {messages.map((msg) => {
            const isMine = msg.is_admin;

            return (
              <div
                key={msg.id}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`p-3 max-w-[70%] rounded-xl ${
                    isMine
                      ? "bg-ubGold text-black rounded-br-none"
                      : "bg-gray-800 text-white rounded-bl-none"
                  }`}
                >
                  {/* Badge */}
                  <span className="text-[10px] opacity-70">
                    {isMine ? "Admin" : msg.profiles?.email}
                  </span>

                  {/* Text */}
                  {msg.content && (
                    <p className="mt-1 text-sm">{msg.content}</p>
                  )}

                  {/* Image */}
                  {msg.file_url && (
                    <img
                      src={msg.file_url}
                      className="mt-2 rounded-lg border border-gray-700"
                    />
                  )}

                  {/* Time */}
                  <div className="text-[10px] opacity-60 mt-1">
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}

                    {isMine && (
                      <span className="ml-2 text-blue-300">
                        {msg.seen ? "✓ Seen" : "✓ Sent"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* INPUT */}
        <form onSubmit={sendMessage} className="flex items-center gap-3 pt-3">
          <label className="cursor-pointer bg-gray-800 px-3 py-2 rounded-lg border border-gray-700">
            📎
            <input type="file" className="hidden" onChange={sendImage} />
          </label>

          <input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 px-3 py-2 bg-gray-800 rounded-lg border border-gray-700 text-white"
            placeholder="Type a message…"
          />

          <button className="px-4 py-2 bg-ubGold text-black rounded-lg">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
