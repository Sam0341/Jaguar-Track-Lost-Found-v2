"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

/* TYPES */
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
  item?: Item | null;
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

export default function MyClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* AUTO SCROLL */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* LOAD CLAIMS */
  useEffect(() => {
    async function loadClaims() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user);
      if (!user) return setLoading(false);

      const { data: claimRows } = await supabase
        .from("claims")
        .select("*")
        .eq("claimed_by", user.id)
        .order("created_at", { ascending: false });

      if (!claimRows) {
        setClaims([]);
        return setLoading(false);
      }

      const claimList: Claim[] = [];

      for (const claim of claimRows) {
        const { data: item } = await supabase
          .from("items")
          .select("*")
          .eq("id", claim.item_id)
          .single();

        let imageUrl = null;
        if (item?.image) {
          const { data: pub } = supabase.storage
            .from("item-photos")
            .getPublicUrl(item.image);
          imageUrl = pub?.publicUrl || null;
        }

        claimList.push({
          ...claim,
          item: item
            ? {
                ...item,
                image: imageUrl,
              }
            : null,
        });
      }

      setClaims(claimList);
      setLoading(false);
    }

    loadClaims();
  }, []);

  /* LOAD MESSAGES + REALTIME */
  useEffect(() => {
  if (!selectedClaim?.id) return; // safe check
  const claimId = selectedClaim.id; // TS fix ✔

  async function loadMessages() {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("claim_id", claimId) // now no underline
      .order("created_at", { ascending: true });

    if (error) console.error(error);
    setMessages(data || []);
  }

  loadMessages();

  /* REALTIME SUBSCRIPTION */
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
}, [selectedClaim?.id]);

  /* SEND MESSAGE */
  async function sendMessage(e: any) {
    e.preventDefault();
    if (!selectedClaim || !user) return;

    const text = e.target.elements.message.value.trim();
    if (!text && !selectedFile) return;

    const form = new FormData();
    form.append("claim_id", selectedClaim.id);
    form.append("content", text || "");

    if (selectedFile) form.append("image", selectedFile);

    await fetch("/api/messages", { method: "POST", body: form });

    e.target.reset();
    setPreviewImage(null);
    setSelectedFile(null);
  }

  /* UI ------------------------------ */
  if (loading)
    return (
      <p className="text-center text-gray-400 pt-20">
        Loading your claims...
      </p>
    );

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-ubGold text-center mb-6">
        🧾 My Claims
      </h1>

      {!selectedClaim ? (
        /* CLAIM LIST */
        <div>
          {claims.length === 0 ? (
            <p className="text-center text-gray-400">
              You haven't made any claims yet.
            </p>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {claims.map((claim) => (
                <div
                  key={claim.id}
                  className="bg-gray-900 p-4 rounded-xl border border-gray-800 hover:border-ubGold cursor-pointer transition"
                  onClick={() => setSelectedClaim(claim)}
                >
                  <img
                    src={
                      claim.item?.image ||
                      "https://placehold.co/400x300?text=No+Image"
                    }
                    className="w-full h-40 object-cover rounded-lg mb-3"
                  />

                  <h2 className="text-lg font-semibold text-white">
                    {claim.item?.name}
                  </h2>

                  <p className="text-gray-500 text-sm">
                    {claim.item?.campus}
                  </p>

                  <p className="text-gray-400 mt-2 text-sm line-clamp-2">
                    {claim.message}
                  </p>

                  <span
                    className={`mt-3 inline-block px-3 py-1 text-xs rounded-full ${
                      claim.status === "approved"
                        ? "bg-green-600"
                        : claim.status === "rejected"
                        ? "bg-red-600"
                        : "bg-yellow-500"
                    } text-white`}
                  >
                    {claim.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* CHAT VIEW */
        <>
          <button
            onClick={() => setSelectedClaim(null)}
            className="mb-4 px-4 py-2 bg-gray-800 text-white rounded-lg"
          >
            ← Back
          </button>

          <div className="bg-gray-900 rounded-xl shadow p-4">
            <h2 className="text-xl font-bold text-white mb-2">
              {selectedClaim.item?.name}
            </h2>

            {/* CHAT MESSAGES */}
            <div className="h-[55vh] overflow-y-auto space-y-3 mb-4 p-2 border-t border-b border-gray-700">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.sender_id === user?.id
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <div
                    className={`p-3 rounded-xl max-w-[70%] ${
                      msg.sender_id === user?.id
                        ? "bg-ubGold text-black"
                        : "bg-gray-800 text-white"
                    }`}
                  >
                    {/* IMAGE MESSAGE */}
                    {msg.image_url && (
                      <img
                        src={msg.image_url}
                        className="w-40 rounded-lg mb-2 cursor-pointer"
                        onClick={() =>
                          window.open(msg.image_url || "", "_blank")
                        }
                      />
                    )}

                    {/* TEXT MESSAGE */}
                    {msg.content !== "[image]" && <p>{msg.content}</p>}

                    <p className="text-[10px] opacity-60 mt-1 text-right">
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}

              <div ref={messagesEndRef} />
            </div>

            {/* IMAGE PREVIEW */}
            {previewImage && (
              <div className="mb-3 flex items-center gap-3">
                <img
                  src={previewImage}
                  className="w-20 h-20 rounded-lg object-cover border border-gray-700"
                />
                <button
                  onClick={() => {
                    setPreviewImage(null);
                    setSelectedFile(null);
                  }}
                  className="text-red-400 hover:underline"
                >
                  Remove
                </button>
              </div>
            )}

            {/* INPUT BOX */}
            <form
              onSubmit={sendMessage}
              className="flex gap-2 border-t border-gray-700 pt-3"
              encType="multipart/form-data"
            >
              <label className="cursor-pointer bg-gray-800 px-3 py-2 rounded-lg border border-gray-700 text-white">
                📎
                <input
                  type="file"
                  name="image"
                  accept="image/*"
                  className="hidden"
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
                type="text"
                name="message"
                placeholder="Type your message..."
                className="flex-1 px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700"
              />

              <button className="px-4 py-2 bg-ubGold text-black rounded-lg font-bold">
                Send
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
