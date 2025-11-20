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
  image_url?: string | null;
  sender?: { email: string | null };
};

export default function AdminChatPage({ params }: { params: { id: string } }) {
  const claimId = params.id;

  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [claimData, setClaimData] = useState<any>(null);

  // image upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () =>
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });

  /* -------------------------------------------------- */
  /*                   LOAD CHAT + CLAIM                */
  /* -------------------------------------------------- */
  useEffect(() => {
  const init = async () => {
    await loadChat();
    subscribeRealtime();
  };

  init();

  return () => {
    supabase.removeAllChannels();
  };
}, []);

  async function loadChat() {
    /* CLAIM */
    const { data: claim } = await supabase
      .from("claims")
      .select("*")
      .eq("id", claimId)
      .single();

    /* ITEM */
    const { data: item } = await supabase
      .from("items")
      .select("name, description, image, campus_id")
      .eq("id", claim.item_id)
      .single();

    /* CAMPUS */
    let campus = null;
    if (item?.campus_id) {
      const { data: c } = await supabase
        .from("campuses")
        .select("name")
        .eq("id", item.campus_id)
        .single();
      campus = c;
    }

    /* USER */
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", claim.claimed_by)
      .single();

    setClaimData({
      ...claim,
      item,
      campus,
      user: userProfile,
    });

    /* MESSAGES */
    const { data: msgs } = await supabase
      .from("messages")
      .select(`
        id,
        claim_id,
        sender_id,
        content,
        created_at,
        is_admin,
        image_url,
        sender:sender_id ( email )
      `)
      .eq("claim_id", claimId)
      .order("created_at", { ascending: true });

    if (msgs) {
      const cleaned = msgs.map((m: any) => ({
        ...m,
        sender: Array.isArray(m.sender) ? m.sender[0] : m.sender,
      }));
      setMessages(cleaned);
    }

    scrollToBottom();
  }

  /* -------------------------------------------------- */
  /*                    REALTIME                        */
  /* -------------------------------------------------- */
  function subscribeRealtime() {
    supabase
      .channel("admin-chat")
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

  /* -------------------------------------------------- */
  /*                 IMAGE UPLOAD HANDLER               */
  /* -------------------------------------------------- */
  function handleImageChange(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setPreviewImage(URL.createObjectURL(file));
  }

  /* -------------------------------------------------- */
  /*                     SEND MESSAGE                   */
  /* -------------------------------------------------- */
  async function sendMessage() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return;

    const formData = new FormData();
    formData.append("claim_id", claimId);
    formData.append("content", reply);
    if (selectedFile) formData.append("image", selectedFile);

    await fetch("/api/messages", {
      method: "POST",
      body: formData,
    });

    setReply("");
    setSelectedFile(null);
    setPreviewImage(null);
  }

  /* -------------------------------------------------- */
  /*                      UI STARTS                     */
  /* -------------------------------------------------- */

  if (!claimData)
    return (
      <div className="p-10 text-center text-gray-400">Loading chat…</div>
    );

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-3xl font-bold text-ubGold mb-4">Admin Chat</h2>

      {/* TOP SUMMARY */}
      <div className="bg-gray-900 p-4 rounded-lg border border-gray-700 mb-6">
        <h3 className="text-xl font-bold text-white">{claimData.item?.name}</h3>

        <p className="text-gray-400 text-sm">
          Claimed by: {claimData.user?.email}
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

      {/* MESSAGES BOX */}
      <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 h-[450px] overflow-y-auto space-y-4">
        {messages.map((msg) => {
          const isAdmin = msg.is_admin;

          return (
            <div
              key={msg.id}
              className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`p-3 rounded-xl max-w-[70%] shadow ${
                  isAdmin ? "bg-ubGold text-black" : "bg-gray-700 text-white"
                }`}
              >
                {/* IMAGE */}
                {msg.image_url && (
                  <img
                    src={msg.image_url}
                    className="rounded-lg max-h-60 mb-2 cursor-pointer"
                    onClick={() => window.open(msg.image_url!, "_blank")}
                  />
                )}

                {/* TEXT */}
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

        <div ref={bottomRef} />
      </div>

      {/* IMAGE PREVIEW */}
      {previewImage && (
        <div className="mt-3 flex items-center gap-2">
          <img
            src={previewImage}
            className="w-20 h-20 rounded border border-gray-700"
          />
          <button
            onClick={() => {
              setPreviewImage(null);
              setSelectedFile(null);
            }}
            className="text-red-400"
          >
            Remove
          </button>
        </div>
      )}

      {/* MESSAGE INPUT */}
      <div className="mt-4 flex gap-3">
        <label className="cursor-pointer bg-gray-700 px-3 py-2 rounded-lg text-white border border-gray-600">
          📎
          <input type="file" hidden accept="image/*" onChange={handleImageChange} />
        </label>

        <input
          className="flex-1 px-4 py-2 rounded-lg bg-gray-900 border border-gray-700 text-white"
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
