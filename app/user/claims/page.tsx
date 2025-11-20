"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

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
};

type Message = {
  id: string;
  claim_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_admin: boolean;
  image_url?: string | null;
  profiles?: {
    full_name: string | null;
    email: string | null;
  };
};

export default function MyClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [imagePreview, setImagePreview] = useState<string | null>(null); // full-screen modal preview
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load user + claims
  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);

      if (!data.user) {
        setLoading(false);
        return;
      }

      const { data: claimRows } = await supabase
        .from("claims")
        .select("*")
        .eq("claimed_by", data.user.id)
        .order("created_at", { ascending: false });

      if (!claimRows) {
        setClaims([]);
        setLoading(false);
        return;
      }

      const results: Claim[] = [];

      for (const c of claimRows) {
        const { data: item } = await supabase
          .from("items")
          .select("*")
          .eq("id", c.item_id)
          .single();

        let imageUrl = null;
        if (item?.image) {
          const { data: bucket } = supabase.storage
            .from("item-photos")
            .getPublicUrl(item.image);
          imageUrl = bucket?.publicUrl || null;
        }

        results.push({
          ...c,
          item: item
            ? {
                ...item,
                image: imageUrl,
              }
            : null,
        });
      }

      setClaims(results);
      setLoading(false);
    }

    load();
  }, []);

  // Load + Realtime Messages
  useEffect(() => {
    if (!selectedClaim) return;

    const claimId = selectedClaim.id;

    async function loadMessages() {
      const { data } = await supabase
        .from("messages")
        .select("*, profiles:sender_id(full_name,email)")
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
          table: "messages",
          filter: `claim_id=eq.${claimId}`,
          schema: "public",
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

  // Send message (text + optional image)
  async function sendMessage(e: any) {
    e.preventDefault();

    if (!selectedClaim || !user) return;

    const msgText = e.target.elements.message.value.trim();

    if (!msgText && !uploadFile) return;

    const form = new FormData();
    form.append("claim_id", selectedClaim.id);
    form.append("content", msgText || "");
    if (uploadFile) form.append("image", uploadFile);

    const res = await fetch("/api/messages", {
      method: "POST",
      body: form,
    });

    if (res.ok) {
      e.target.reset();
      setUploadFile(null);
    }
  }

  // UI BEGINS -----------------------

  if (loading)
    return (
      <p className="text-center text-gray-400 pt-20">
        Loading your claims...
      </p>
    );

  return (
    <div className="max-w-5xl mx-auto p-6 text-white">
      <h1 className="text-3xl font-bold text-ubGold text-center mb-6">
        🧾 My Claims
      </h1>

      {/* ------- CLAIM LIST VIEW ------- */}
      {!selectedClaim ? (
        claims.length === 0 ? (
          <p className="text-center text-gray-400">
            You haven’t made any claims yet.
          </p>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {claims.map((claim) => (
              <div
                key={claim.id}
                className="bg-darkCard p-4 rounded-xl border border-gray-700 hover:border-ubGold cursor-pointer transition"
                onClick={() => setSelectedClaim(claim)}
              >
                <img
                  src={
                    claim.item?.image ||
                    "https://placehold.co/400x300?text=No+Image"
                  }
                  className="w-full h-40 object-cover rounded-lg mb-3"
                />

                <h2 className="text-lg font-semibold">
                  {claim.item?.name}
                </h2>

                <p className="text-gray-400 text-sm">
                  {claim.item?.campus}
                </p>

                <p className="text-gray-500 text-sm mt-2 line-clamp-2">
                  {claim.message}
                </p>

                <span
                  className={`mt-3 inline-block px-3 py-1 text-xs rounded-full ${
                    claim.status === "approved"
                      ? "bg-green-600"
                      : claim.status === "rejected"
                      ? "bg-red-600"
                      : "bg-yellow-500"
                  } text-black`}
                >
                  {claim.status}
                </span>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          {/* BACK BUTTON */}
          <button
            onClick={() => setSelectedClaim(null)}
            className="mb-4 px-4 py-2 bg-gray-800 text-white rounded-lg"
          >
            ← Back
          </button>

          {/* ---------- CHAT PANEL ---------- */}
          <div className="bg-darkCard rounded-xl shadow p-4 border border-gray-700">

            {/* HEADER */}
            <h2 className="text-xl font-bold mb-1">
              {selectedClaim.item?.name}
            </h2>
            <p className="text-gray-300 text-sm mb-3">
              {selectedClaim.item?.description}
            </p>

            <p className="text-gray-400 text-xs">
              📍 {selectedClaim.item?.location}
            </p>
            <p className="text-gray-400 text-xs mb-4">
              🏫 {selectedClaim.item?.campus}
            </p>

            {/* User claim message */}
            {selectedClaim.message && (
              <div className="mb-4 p-3 bg-gray-800 border border-gray-700 rounded-lg">
                <p className="text-sm text-gray-300">
                  <span className="font-semibold text-ubGold">
                    Claim Message:
                  </span>
                  <br />
                  {selectedClaim.message}
                </p>
              </div>
            )}

            {/* ---------- MESSAGES LIST ---------- */}
            <div className="h-[55vh] overflow-y-auto space-y-3 mb-4 p-2 border-t border-b border-gray-700">
              {messages.map((msg) => {
                const mine = msg.sender_id === user?.id;

                return (
                  <div
                    key={msg.id}
                    className={`flex ${mine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`p-3 rounded-xl max-w-[70%] ${
                        mine
                          ? "bg-ubGold text-black"
                          : "bg-gray-800 text-white"
                      }`}
                    >
                      {/* IMAGE MESSAGE */}
                      {msg.image_url && (
                        <img
                          src={msg.image_url}
                          className="rounded-lg mb-2 cursor-pointer max-h-60"
                          onClick={() => setImagePreview(msg.image_url!)}
                        />
                      )}

                      {/* TEXT MESSAGE */}
                      {msg.content !== "[image]" && (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}

                      <p className="text-[10px] opacity-60 mt-1">
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>

            {/* ---------- MESSAGE INPUT ---------- */}
            <form
              onSubmit={sendMessage}
              className="flex gap-2 border-t border-gray-700 pt-3 items-center"
            >
              {/* IMAGE PREVIEW BEFORE SENDING */}
              {uploadFile && (
                <img
                  src={URL.createObjectURL(uploadFile)}
                  className="w-20 h-20 object-cover rounded-lg border border-gray-600"
                />
              )}

              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setUploadFile(e.target.files?.[0] ?? null)
                }
                className="hidden"
                id="chat-image-upload"
              />

              <label
                htmlFor="chat-image-upload"
                className="cursor-pointer bg-gray-800 border border-gray-700 px-3 py-2 rounded-lg hover:bg-gray-700"
              >
                📷
              </label>

              <input
                type="text"
                name="message"
                placeholder="Type your message..."
                className="flex-1 px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700"
              />

              <button className="px-4 py-2 bg-ubGold text-black rounded-lg font-semibold">
                Send
              </button>
            </form>
          </div>
        </>
      )}

      {/* ---------- IMAGE PREVIEW MODAL ---------- */}
      {imagePreview && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          onClick={() => setImagePreview(null)}
        >
          <img
            src={imagePreview}
            className="max-w-[90%] max-h-[90%] rounded-lg shadow-lg"
          />
        </div>
      )}
    </div>
  );
}
