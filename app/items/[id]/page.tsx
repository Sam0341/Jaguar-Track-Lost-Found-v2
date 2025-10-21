"use client";

import { useEffect, useState } from "react";
import { getItemById, type Item } from "@/lib/items";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function ItemDetails({ params }: { params: { id: string } }) {
  const [item, setItem] = useState<Item | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [claimMessage, setClaimMessage] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    async function fetchItem() {
      const { data: userData } = await supabase.auth.getUser();
      const currentUser = userData?.user;
      setUser(currentUser);
      if (currentUser?.user_metadata?.role === "admin") {
        setIsAdmin(true);
      }

      const data = await getItemById(params.id);
      setItem(data);
    }
    fetchItem();
  }, [params.id]);

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setFeedback("⚠️ Please log in to claim an item.");
      return;
    }

    try {
      const { error } = await supabase.from("claims").insert([
        {
          item_id: item?.id,
          claimed_by: user.id,
          message: claimMessage || null,
          status: "Pending",
        },
      ]);

      if (error) throw error;
      setFeedback("✅ Claim submitted successfully! Await admin approval.");
      setClaimMessage("");
      setShowClaimForm(false);
    } catch (err: any) {
      console.error("Claim error:", err);
      setFeedback("❌ Failed to submit claim. Please try again.");
    }
  };

  if (!item) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        Loading item details...
      </div>
    );
  }

  const SUPABASE_URL =
    "https://npudlbublntelxzmzlmu.supabase.co/storage/v1/object/public/item-photos";
  const imageSrc = item.image
    ? item.image.startsWith("http")
      ? item.image
      : `${SUPABASE_URL}/${item.image}`
    : "https://placehold.co/600x400?text=No+Image+Available";

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* 🖼️ Image Section */}
        <div className="rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800">
          <img
            src={imageSrc}
            alt={item.name}
            className="w-full h-80 object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "https://placehold.co/600x400?text=Image+Unavailable";
            }}
          />
        </div>

        {/* 📋 Info Section */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {item.name}
          </h1>
          <p className="text-gray-700 dark:text-gray-400 mt-2">
            {item.description}
          </p>

          {/* 🏷️ Tags */}
          <div className="flex flex-wrap gap-2 mt-4">
            {item.category && (
              <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm font-medium px-3 py-1 rounded-full">
                {item.category}
              </span>
            )}
            <span
              className={`text-sm font-medium px-3 py-1 rounded-full ${
                item.status?.toLowerCase() === "found"
                  ? "bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-200"
                  : "bg-yellow-100 text-yellow-700 dark:bg-yellow-700 dark:text-yellow-200"
              }`}
            >
              {item.status?.toUpperCase()}
            </span>
            {item.campus && (
              <span className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium px-3 py-1 rounded-full">
                {item.campus}
              </span>
            )}
          </div>

          {/* 👤 Reporter Info */}
          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 space-y-1">
            <p>
              <strong>Reported by:</strong>{" "}
              {item.reporter_name ? (
                <>
                  {item.reporter_name}
                  {isAdmin && item.reporter_email && (
                    <span className="text-blue-600 dark:text-blue-400 ml-2">
                      ({item.reporter_email})
                    </span>
                  )}
                </>
              ) : (
                "Unknown"
              )}
            </p>
            <p>
              <strong>Reported on:</strong>{" "}
              {item.reported_at ? formatDateTime(item.reported_at) : "N/A"}
            </p>
          </div>

          {/* 🧾 Claim Button */}
          {!isAdmin && item.status !== "claimed" && (
            <button
              onClick={() => setShowClaimForm(!showClaimForm)}
              className="mt-6 w-full bg-ubBlue text-white py-2 rounded-lg hover:opacity-90 transition"
            >
              {showClaimForm ? "Cancel" : "Claim This Item"}
            </button>
          )}

          {/* ✍️ Claim Form */}
          {showClaimForm && (
            <form
              onSubmit={handleClaimSubmit}
              className="mt-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800"
            >
              <textarea
                value={claimMessage}
                onChange={(e) => setClaimMessage(e.target.value)}
                placeholder="Add a message (optional)"
                className="w-full rounded-lg p-2 border focus:ring-2 focus:ring-ubGold dark:bg-gray-900 dark:text-gray-100"
                rows={3}
              />
              <button
                type="submit"
                className="mt-3 w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium transition"
              >
                Submit Claim
              </button>
            </form>
          )}

          {feedback && (
            <p
              className={`mt-3 text-center font-medium ${
                feedback.includes("✅")
                  ? "text-green-600"
                  : feedback.includes("⚠️")
                  ? "text-yellow-600"
                  : "text-red-600"
              }`}
            >
              {feedback}
            </p>
          )}

          {/* 🔙 Back */}
          <Link
            href="/items"
            className="mt-6 inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2 rounded-lg transition"
          >
            ← Back to Items
          </Link>
        </div>
      </div>
    </div>
  );
}
