"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

// TYPES
type Item = {
  id: string;
  name: string;
  campus: string | null;
  description: string | null;
  image: string | null;
  location: string | null;
};

type Claim = {
  id: string;
  item_id: string;
  claimed_by: string;
  message: string | null;
  status: string | null;
  created_at: string;
  item?: Item;
  profiles?: { email: string | null; full_name: string | null };
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
  profiles?: { full_name: string | null; email: string | null };
};

export default function AdminClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [newMessage, setNewMessage] = useState("");

  // Scroll chat down
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch all claims
  useEffect(() => {
    async function loadClaims() {
      const { data: claimRows } = await supabase
        .from("claims")
        .select("*, profiles:claimed_by(full_name,email)")
        .order("created_at", { ascending: false });

      if (!claimRows) return setClaims([]);

      const finalClaims: Claim[] = [];

      for (const claim of claimRows) {
        const { data: item } = await supabase
          .from("items")
          .select("*")
          .eq("id", claim.item_id)
          .single();

        let imageUrl = null;
        if (item?.image) {
          const { data: urlData } = supabase.storage
            .from("item-photos")
            .getPublicUrl(item.image);

          imageUrl = urlData?.publicUrl || null;
        }

        finalClaims.push({
          ...claim,
          item: item ? { ...item, image: imageUrl } : null,
        });
      }

      setClaims(finalClaims);
      setLoading(false);
    }

    loadClaims();
  }, []);

  // Load messages + realtime
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

      // Auto mark ALL user messages as seen
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
        (payload) => {
          setMessages((prev) => [...prev, payload.payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      // removeChannel returns a Promise; call it without returning to keep cleanup synchronous
      void supabase.removeChannel(channel);
    };
  }, [selectedClaim]);

  // Send text
  async function sendMessage(e: any) {
    e.preventDefault();
    if (!newMessage.trim() || !selectedClaim) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error("No authenticated user found");
      return;
    }

    await supabase.from("messages").insert([
      {
        claim_id: selectedClaim.id,
        sender_id: user.id,
        content: newMessage,
        is_admin: true,
        seen: false,
        file_url: null,
      },
    ]);

    setNewMessage("");
  }

  // Send image
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

    const { data } = await supabase.storage
      .from("chat-attachments")
      .getPublicUrl(path);

    const url = data?.publicUrl;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error("No authenticated user found");
      return;
    }

    await supabase.from("messages").insert([
      {
        claim_id: selectedClaim.id,
        sender_id: user.id,
        content: null,
        file_url: url,
        seen: false,
        is_admin: true,
      },
    ]);
  }

  // UI — LIST VIEW
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
                <p className="text-gray-400 text-sm">{c.profiles?.email}</p>
                <span
                  className={`inline-block mt-2 px-3 py-1 text-xs rounded-full ${
                    c.status === "approved"
                      ? "bg-green-600"
                      : c.status === "rejected"
                      ? "bg-red-600"
                      : "bg-yellow-500"
                  } text-white`}
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
            const bubbleOwn = msg.is_admin;
            return (
              <div
                key={msg.id}
                className={`flex ${bubbleOwn ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`p-3 max-w-[70%] rounded-xl ${
                    bubbleOwn
                      ? "bg-ubGold text-black rounded-br-none"
                      : "bg-gray-800 text-white rounded-bl-none"
                  }`}
                >
                  {/* BADGE */}
                  <span
                    className={`text-[10px] px-2 py-1 rounded-full ${
                      bubbleOwn
                        ? "bg-black/20 text-black"
                        : "bg-white/20 text-white"
                    }`}
                  >
                    {bubbleOwn ? "Admin" : msg.profiles?.email || "User"}
                  </span>

                  {/* TEXT */}
                  {msg.content && (
                    <p className="mt-1 text-sm">{msg.content}</p>
                  )}

                  {/* IMAGE */}
                  {msg.file_url && (
                    <img
                      src={msg.file_url}
                      className="mt-2 rounded-lg shadow border border-gray-700"
                    />
                  )}

                  {/* TIME + READ STATUS */}
                  <div className="text-[10px] opacity-60 mt-1">
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}

                    {bubbleOwn && (
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
        <form
          onSubmit={sendMessage}
          className="flex items-center gap-3 pt-3"
        >
          <label className="cursor-pointer bg-gray-800 px-3 py-2 rounded-lg border border-gray-700">
            📎
            <input type="file" className="hidden" onChange={sendImage} />
          </label>

          <input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message…"
            className="flex-1 px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700"
          />

          <button className="px-4 py-2 bg-ubGold text-black rounded-lg">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
