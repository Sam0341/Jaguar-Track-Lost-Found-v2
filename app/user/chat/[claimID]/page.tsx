"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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

export default function UserClaimChatPage() {
  const { claimID } = useParams(); // from folder name [claimID]
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [user, setUser] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch user info + chat messages
  useEffect(() => {
    async function loadChat() {
      const { data: userData } = await supabase.auth.getUser();
      setUser(userData?.user);

      const { data, error } = await supabase
        .from("messages")
        .select(`*, profiles:sender_id(full_name, email)`)
        .eq("claim_id", claimID)
        .order("created_at", { ascending: true });

      if (!error && data) setMessages(data);
    }

    loadChat();

    // Realtime updates
    const channel = supabase
      .channel(`messages:claim_${claimID}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `claim_id=eq.${claimID}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [claimID]);

  // Send message
  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const { error } = await supabase.from("messages").insert([
      {
        claim_id: claimID,
        sender_id: user.id,
        content: newMessage.trim(),
        is_admin: false, // user messages
      },
    ]);

    if (!error) setNewMessage("");
  }

  return (
    <div className="flex flex-col h-[90vh] max-w-2xl mx-auto bg-gray-900 text-white rounded-xl shadow-lg">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-lg font-bold text-ubGold">Chat with Admin</h1>
        <p className="text-sm text-gray-400">
          Discuss your claim status and details directly with the admin.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-gray-500 mt-8">
            No messages yet. Start the conversation below 👇
          </p>
        )}

        {messages.map((msg) => {
          const isUser = msg.sender_id === user?.id;
          return (
            <div
              key={msg.id}
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`p-3 rounded-2xl max-w-[75%] ${
                  isUser
                    ? "bg-ubGold text-black"
                    : "bg-gray-800 text-white border border-gray-700"
                }`}
              >
                {!isUser && (
                  <p className="text-xs text-gray-400 mb-1">
                    {msg.profiles?.full_name || msg.profiles?.email}
                  </p>
                )}
                <p>{msg.content}</p>
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
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={sendMessage}
        className="p-4 border-t border-gray-700 flex items-center space-x-2 bg-gray-800"
      >
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white outline-none focus:ring-2 focus:ring-ubGold"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-ubGold text-black font-semibold rounded-lg hover:bg-yellow-400 transition"
        >
          Send
        </button>
      </form>
    </div>
  );
}
