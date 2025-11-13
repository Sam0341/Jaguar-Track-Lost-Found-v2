"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

// Types
type Item = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  image: string | null;
  campus?: { name: string | null };
  category?: { name: string | null };
};

type Claim = {
  id: string;
  item_id: string;
  message: string | null;
  status: string | null;
  created_at: string;
  items: Item | null;
};

type Message = {
  id: string;
  claim_id: string;
  sender_id: string;
  content: string;
  created_at: string;
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

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
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

      // FIXED QUERY FOR NEW DB STRUCTURE
      const { data, error } = await supabase
        .from("claims")
        .select(`
          id,
          item_id,
          message,
          status,
          created_at,
          items:item_id (
            id,
            name,
            description,
            image,
            location,
            campus:campus_id ( name ),
            category:category_id ( name )
          )
        `)
        .eq("claimed_by", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        const processed = data.map((claim: any) => {
          let imgUrl = null;
          if (claim.items?.image) {
            const { data: pub } = supabase.storage
              .from("item-photos")
              .getPublicUrl(claim.items.image);

            imgUrl = pub?.publicUrl || null;
          }

          return {
            ...claim,
            items: {
              ...claim.items,
              image: imgUrl,
            },
          };
        });

        setClaims(processed);
      }

      setLoading(false);
    }

    loadClaims();
  }, []);

  // Load messages when claim is opened
    useEffect(() => {
      const claimId = selectedClaim?.id;
      if (!claimId) return;
  
      async function loadThread() {
        const { data } = await supabase
          .from("messages")
          .select(`*, profiles:sender_id(full_name, email)`)
          .eq("claim_id", claimId)
          .order("created_at", { ascending: true });
  
        setMessages(data || []);
      }
  
      loadThread();
  
      // Real-time
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
  
      // ensure cleanup returns void (not a Promise)
      return () => {
        void supabase.removeChannel(channel);
      };
    }, [selectedClaim]);

  async function sendMessage(e: any) {
    e.preventDefault();
    if (!newMessage.trim() || !selectedClaim || !user) return;

    await supabase.from("messages").insert([
      {
        claim_id: selectedClaim.id,
        sender_id: user.id,
        content: newMessage.trim(),
        is_admin: false,
      },
    ]);

    setNewMessage("");
  }

  // Date formatter
  const formatDate = (date: string) =>
    new Date(date).toLocaleString("en-BZ", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  // LOADING SCREEN
  if (loading)
    return (
      <div className="flex justify-center items-center h-[70vh] text-gray-400">
        Loading your claims...
      </div>
    );

  // RETURN
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-ubGold text-center mb-6">
        🧾 My Claims
      </h1>

      {/* ---------------- LIST VIEW ---------------- */}
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
                className="p-5 bg-white dark:bg-gray-900 border rounded-xl shadow hover:shadow-lg cursor-pointer transition"
                onClick={() => setSelectedClaim(claim)}
              >
                <img
                  src={
                    claim.items?.image ??
                    "https://placehold.co/400x300?text=No+Image"
                  }
                  className="w-full h-40 object-cover rounded-lg mb-3"
                />

                <h3 className="text-lg font-semibold dark:text-white">
                  {claim.items?.name}
                </h3>

                <p className="text-sm text-gray-500 dark:text-gray-300">
                  {claim.items?.campus?.name}
                </p>

                <p className="text-sm text-gray-400 mt-2 line-clamp-2">
                  {claim.message || "No message included."}
                </p>

                <span
                  className={`inline-block mt-3 px-3 py-1 text-xs rounded-full text-white ${
                    claim.status === "approved"
                      ? "bg-green-600"
                      : claim.status === "rejected"
                      ? "bg-red-600"
                      : "bg-yellow-500"
                  }`}
                >
                  {claim.status}
                </span>
              </div>
            ))}
          </div>
        )
      ) : (
        /* ---------------- CHAT VIEW ---------------- */
        <div className="max-w-3xl mx-auto bg-gray-900 text-white rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gray-800 p-4 border-b border-gray-700 flex justify-between">
            <div>
              <h2 className="text-lg font-bold">{selectedClaim.items?.name}</h2>
              <p className="text-xs text-gray-400">
                {selectedClaim.items?.campus?.name} •{" "}
                {formatDate(selectedClaim.created_at)}
              </p>
            </div>

            <button
              onClick={() => setSelectedClaim(null)}
              className="bg-gray-700 px-3 py-1 rounded-md hover:bg-gray-600"
            >
              ← Back
            </button>
          </div>

          {/* Item summary */}
          <div className="bg-gray-800 p-4 border-b border-gray-700 flex gap-4">
            <img
              src={
                selectedClaim.items?.image ??
                "https://placehold.co/100x100?text=No+Image"
              }
              className="w-20 h-20 rounded-lg object-cover"
            />

            <div>
              <p className="text-sm text-gray-300 italic">
                {selectedClaim.items?.description}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                📍 {selectedClaim.items?.location}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="p-4 h-[60vh] overflow-y-auto space-y-3">
            {messages.map((msg) => {
              const isUser = msg.sender_id === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex ${
                    isUser ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`p-3 rounded-2xl max-w-[70%] ${
                      isUser
                        ? "bg-ubGold text-black"
                        : "bg-gray-800 border border-gray-700"
                    }`}
                  >
                    {!isUser && (
                      <p className="text-xs text-gray-400 mb-1">
                        {msg.profiles?.email}
                      </p>
                    )}

                    <p>{msg.content}</p>

                    <p className="text-[10px] text-gray-400 mt-1 text-right">
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <form
            onSubmit={sendMessage}
            className="p-4 border-t border-gray-700 flex gap-2 bg-gray-800"
          >
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-gray-900 text-white p-2 rounded-lg border border-gray-700"
            />

            <button
              type="submit"
              className="bg-ubGold text-black px-4 py-2 rounded-lg"
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* Zoomed Image */}
      {zoomImage && (
        <div
          onClick={() => setZoomImage(null)}
          className="fixed inset-0 bg-black/80 flex justify-center items-center"
        >
          <img
            src={zoomImage}
            className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-lg"
          />
        </div>
      )}
    </div>
  );
}
