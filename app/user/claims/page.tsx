"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

// 🧱 Data Types
type Item = {
  id: string;
  name: string;
  campus: string | null;
  description: string | null;
  image: string | null;
  category?: string | null;
  location?: string | null;
};

type Claim = {
  id: string;
  item_id: string;
  status: string | null;
  message: string | null;
  created_at: string;
  items?: Item;
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

export default function MyClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [someoneTyping, setSomeoneTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<any>(null);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load user + claims
  useEffect(() => {
    async function loadClaims() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("claims")
        .select(
          `
          id,
          item_id,
          message,
          status,
          created_at,
          items:item_id (
            id,
            name,
            campus,
            description,
            image,
            location
          )
        `
        )
        .eq("claimed_by", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        const formatted = data.map((c: any) => {
          const item = Array.isArray(c.items) ? c.items[0] : c.items;
          let imageUrl = null;
          if (item?.image) {
            const { data: publicData } = supabase.storage
              .from("item-photos")
              .getPublicUrl(item.image);
            imageUrl = publicData?.publicUrl || null;
          }
          return {
            ...c,
            items: { ...item, image: imageUrl },
          };
        });
        setClaims(formatted);
      }
      setLoading(false);
    }
    loadClaims();
  }, []);

  // 💬 Load messages for selected claim
  useEffect(() => {
    const claimId = selectedClaim?.id;
    if (!claimId) return;

    async function loadMessages() {
      const { data, error } = await supabase
        .from("messages")
        .select(`*, profiles:sender_id(full_name, email)`)
        .eq("claim_id", claimId)
        .order("created_at", { ascending: true });

      if (!error && data) setMessages(data);
    }

    loadMessages();

    // Listen for new messages + typing events
    const channel = supabase
      .channel(`messages:claim=${claimId}`)
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
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload?.userId !== user?.id) {
          setSomeoneTyping(true);
          setTimeout(() => setSomeoneTyping(false), 2000);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedClaim, user]);

  // Send text message
  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !selectedClaim || !user) return;

    const { error } = await supabase.from("messages").insert([
      {
        claim_id: selectedClaim.id,
        sender_id: user.id,
        content: newMessage.trim(),
        is_admin: false,
      },
    ]);
    if (!error) setNewMessage("");
  }

  // Typing broadcast
  useEffect(() => {
    if (!typing || !selectedClaim) return;

    supabase.channel(`messages:claim=${selectedClaim.id}`).send({
      type: "broadcast",
      event: "typing",
      payload: { userId: user?.id },
    });
  }, [typing, selectedClaim, user]);

  // Handle typing timeout
  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    setTyping(true);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => setTyping(false), 1500);
  };

  // Upload proof image
  async function handleImageUpload(file: File | null) {
    if (!file || !selectedClaim || !user) return;
    const filePath = `proofs/${selectedClaim.id}/${Date.now()}_${file.name}`;

    const { error } = await supabase.storage
      .from("chat_uploads")
      .upload(filePath, file, { upsert: true });

    if (!error) {
      const imageUrl = `https://npudlbublntelxzmzlmu.supabase.co/storage/v1/object/public/chat_uploads/${filePath}`;
      await supabase.from("messages").insert([
        {
          claim_id: selectedClaim.id,
          sender_id: user.id,
          content: imageUrl,
          is_admin: false,
        },
      ]);
    } else {
      console.error("Upload error:", error.message);
    }
  }

  const formatDate = (date: string) =>
    new Date(date).toLocaleString("en-BZ", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  // UI
  if (loading)
    return (
      <div className="flex justify-center items-center h-[70vh] text-gray-500 dark:text-gray-400">
        Loading your claims...
      </div>
    );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-ubGold mb-6 text-center">
        🧾 My Claims
      </h1>

      {/* Claim list */}
      {!selectedClaim ? (
        claims.length === 0 ? (
          <p className="text-center text-gray-400">
            You haven’t made any claims yet.
          </p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {claims.map((claim) => (
              <div
                key={claim.id}
                className="p-5 bg-white dark:bg-gray-900 rounded-xl border border-gray-300 dark:border-gray-700 shadow hover:shadow-lg transition cursor-pointer"
                onClick={() => setSelectedClaim(claim)}
              >
                <img
                  src={
                    claim.items?.image ||
                    "https://placehold.co/400x300?text=No+Image"
                  }
                  alt={claim.items?.name || "Item"}
                  className="w-full h-40 object-cover rounded-lg mb-3"
                />
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  {claim.items?.name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  {claim.items?.campus}
                </p>
                <p className="text-sm mb-2 text-gray-400 line-clamp-2">
                  {claim.message || "No message provided."}
                </p>
                <span
                  className={`px-3 py-1 text-xs font-medium rounded-full ${
                    claim.status?.toLowerCase() === "approved"
                      ? "bg-green-600 text-white"
                      : claim.status?.toLowerCase() === "rejected"
                      ? "bg-red-600 text-white"
                      : "bg-yellow-500 text-white"
                  }`}
                >
                  {claim.status
                    ? claim.status.charAt(0).toUpperCase() +
                      claim.status.slice(1)
                    : "Pending"}
                </span>
              </div>
            ))}
          </div>
        )
      ) : (
        // Chat view
        <div className="max-w-3xl mx-auto bg-gray-900 text-white rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gray-800 px-5 py-3 flex justify-between items-center border-b border-gray-700">
            <div>
              <h2 className="text-lg font-semibold">
                {selectedClaim.items?.name}
              </h2>
              <p className="text-xs text-gray-400">
                {selectedClaim.items?.campus} •{" "}
                {formatDate(selectedClaim.created_at)}
              </p>
            </div>
            <button
              onClick={() => setSelectedClaim(null)}
              className="text-sm text-gray-300 hover:text-white bg-gray-700 px-3 py-1 rounded-md"
            >
              ← Back
            </button>
          </div>

          {/* Item Preview */}
          {selectedClaim.items && (
            <div className="bg-gray-800 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 border-b border-gray-700">
              {selectedClaim.items.image ? (
                <img
                  src={selectedClaim.items.image}
                  alt={selectedClaim.items.name}
                  className="w-24 h-24 object-cover rounded-lg border border-gray-600"
                />
              ) : (
                <div className="w-24 h-24 bg-gray-700 flex items-center justify-center rounded-lg text-gray-400">
                  No Image
                </div>
              )}
              <div>
                <p className="text-sm text-gray-300 italic">
                  {selectedClaim.items.description}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  📍 Location: {selectedClaim.items.location || "N/A"}
                </p>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="p-4 h-[60vh] overflow-y-auto space-y-3">
            {messages.map((msg) => {
              const isUser = msg.sender_id === user?.id;
              const isImage = msg.content.includes(
                "https://npudlbublntelxzmzlmu.supabase.co"
              );
              return (
                <div
                  key={msg.id}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`p-3 rounded-2xl max-w-[75%] ${
                      isUser
                        ? "bg-ubGold text-black"
                        : "bg-gray-800 text-gray-100 border border-gray-700"
                    }`}
                  >
                    {!isUser && (
                      <p className="text-xs text-gray-400 mb-1">
                        {msg.profiles?.full_name || "Admin"}
                      </p>
                    )}
                    {isImage ? (
                      <img
                        src={msg.content}
                        alt="Proof"
                        className="rounded-lg cursor-pointer mt-1 max-h-56 object-cover"
                        onClick={() => setZoomImage(msg.content)}
                      />
                    ) : (
                      <p>{msg.content}</p>
                    )}
                    <p className="text-[10px] mt-1 text-gray-400 text-right">
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}

            {someoneTyping && (
              <p className="text-xs text-gray-400 italic">Admin is typing...</p>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={sendMessage}
            className="p-4 border-t border-gray-700 flex items-center space-x-2 bg-gray-800"
          >
            <label
              htmlFor="proofUpload"
              className="cursor-pointer text-gray-300 hover:text-ubGold"
              title="Upload proof image"
            >
              📎
            </label>
            <input
              id="proofUpload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleImageUpload(e.target.files?.[0] || null)}
            />
            <input
              type="text"
              value={newMessage}
              onChange={handleTyping}
              placeholder="Type your message..."
              className="flex-1 px-4 py-2 rounded-lg bg-gray-900 border border-gray-700 text-white outline-none focus:ring-2 focus:ring-ubGold"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-ubGold text-black font-semibold rounded-lg hover:bg-yellow-400"
            >
              Send
            </button>
          </form>
        </div>
      )}

      {zoomImage && (
        <div
          onClick={() => setZoomImage(null)}
          className="fixed inset-0 bg-black/90 z-[9999] flex justify-center items-center cursor-zoom-out transition"
        >
          <img
            src={zoomImage}
            alt="Zoomed"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-lg"
          />
        </div>
      )}
    </div>
  );
}
