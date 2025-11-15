"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

type Message = {
  id: string;
  claim_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_admin: boolean;
  sender?: { email: string | null };
};

export default function AdminChatPage({ params }: { params: { id: string } }) {
  const claimId = params.id;
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [claimData, setClaimData] = useState<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    loadChat();
    subscribeToRealtime();

    return () => {
      supabase.removeAllChannels();
    };
  }, []);

  async function loadChat() {
    // STEP 1 — Fetch claim ONLY
    const { data: claim, error: claimErr } = await supabase
      .from("claims")
      .select("*")
      .eq("id", claimId)
      .single();

    if (!claim || claimErr) {
      console.error("Failed to load claim", claimErr);
      return;
    }

    // STEP 2 — Fetch item separately
    const { data: item, error: itemErr } = await supabase
      .from("items")
      .select("name, description, image, campus_id")
      .eq("id", claim.item_id)
      .single();

    // STEP 3 — Fetch campus separately
    let campus = null;
    if (item?.campus_id) {
      const { data: c } = await supabase
        .from("campuses")
        .select("name")
        .eq("id", item.campus_id)
        .single();

      campus = c;
    }

    // STEP 4 — Fetch user separately
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", claim.claimed_by)
      .single();

    // Build final claim object
    setClaimData({
      ...claim,
      item,
      campus,
      user: userProfile,
    });

    // STEP 5 — Load messages
    const { data: msgs } = await supabase
      .from("messages")
      .select(`
        id,
        claim_id,
        sender_id,
        content,
        created_at,
        is_admin,
        sender:sender_id ( email )
      `)
      .eq("claim_id", claimId)
      .order("created_at", { ascending: true });

    if (msgs) {
      const normalized = msgs.map((m: any) => ({
        ...m,
        sender: Array.isArray(m.sender) ? m.sender[0] : m.sender,
      }));
      setMessages(normalized);
    }

    scrollToBottom();
  }

  function subscribeToRealtime() {
    supabase
      .channel("messages-admin-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", table: "messages", schema: "public" },
        (payload) => {
          if (payload.new.claim_id === claimId) {
            setMessages((prev) => [...prev, payload.new as Message]);
            scrollToBottom();
          }
        }
      )
      .subscribe();
  }

  async function sendMessage() {
    if (!reply.trim()) return;

    const { data: auth } = await supabase.auth.getUser();
    const adminId = auth?.user?.id;

    await supabase.from("messages").insert({
      claim_id: claimId,
      sender_id: adminId,
      content: reply,
      is_admin: true,
    });

    setReply("");
    scrollToBottom();
  }

  if (!claimData) {
    return <div className="p-10 text-gray-400 text-center">Loading chat…</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-3xl font-bold text-ubGold mb-4">Admin Chat</h2>

      {/* CLAIM SUMMARY */}
      <div className="bg-gray-900 p-4 rounded-lg border border-gray-700 mb-6">
        <h3 className="text-xl text-white font-bold mb-1">
          {claimData.item?.name}
        </h3>

        <p className="text-gray-400 text-sm">
          Claimed by: {claimData.user?.email || "Unknown User"}
        </p>

        <p className="text-gray-400 text-sm mt-1">
          Campus: {claimData.campus?.name || "N/A"}
        </p>

        <span
          className={`inline-block mt-3 px-3 py-1 rounded-full text-xs font-semibold ${
            claimData.status === "pending"
              ? "bg-yellow-500 text-black"
              : claimData.status === "approved"
              ? "bg-green-500 text-black"
              : "bg-red-500 text-white"
          }`}
        >
          {claimData.status.toUpperCase()}
        </span>
      </div>

      {/* CHAT BOX */}
      <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 h-[450px] overflow-y-auto space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`p-3 max-w-[80%] rounded-lg ${
              msg.is_admin
                ? "bg-blue-600 text-white ml-auto"
                : "bg-gray-700 text-gray-200"
            }`}
          >
            <p>{msg.content}</p>
            <p className="text-xs text-gray-300 mt-1">
              {new Date(msg.created_at).toLocaleString()}
            </p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* MESSAGE INPUT */}
      <div className="mt-4 flex gap-3">
        <input
          className="flex-1 px-4 py-2 rounded-lg bg-gray-900 border border-gray-700 text-white outline-none"
          placeholder="Type your reply…"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
        />

        <button
          onClick={sendMessage}
          className="px-5 py-2 bg-ubGold text-black font-bold rounded-lg hover:bg-yellow-400"
        >
          Send
        </button>
      </div>
    </div>
  );
}
