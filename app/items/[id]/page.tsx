"use client";

import { useEffect, useState } from "react";
import { getItemById, type Item } from "@/lib/items";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function ItemDetails({ params }: { params: { id: string } }) {
  const [item, setItem] = useState<Item | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [claimMessage, setClaimMessage] = useState("");
  const [feedback, setFeedback] = useState("");
  const [claimStatus, setClaimStatus] = useState<string | null>(null);
  const [claimId, setClaimId] = useState<string | null>(null);
  const router = useRouter();

  // 🧠 Fetch item + user + claim status
  useEffect(() => {
    async function fetchItemData() {
      const { data: userData } = await supabase.auth.getUser();
      const currentUser = userData?.user;
      setUser(currentUser);

      if (currentUser?.user_metadata?.role === "admin") setIsAdmin(true);

      // 📦 Fetch item details
      const data = await getItemById(params.id);
      setItem(data);

      // 🔍 Check if this user already made a claim for this item
      if (currentUser) {
        const { data: existingClaim, error } = await supabase
          .from("claims")
          .select("id, status")
          .eq("item_id", params.id)
          .eq("claimed_by", currentUser.id)
          .maybeSingle();

        if (!error && existingClaim) {
          setClaimStatus(existingClaim.status);
          setClaimId(existingClaim.id);
        }
      }
    }

    fetchItemData();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener?.subscription.unsubscribe();
  }, [params.id]);

  // 📨 Handle claim submission
  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      router.push("/login");
      return;
    }

    setFeedback("Submitting your claim...");

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        setFeedback("❌ No valid session found. Please log in again.");
        return;
      }

      const token = sessionData.session.access_token;

      const res = await fetch("/api/claims", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          item_id: item?.id,
          message: claimMessage,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setFeedback("✅ Claim submitted successfully! Awaiting admin approval.");
        setClaimStatus("Pending");
        setShowClaimForm(false);
        if (data.claim_id) setClaimId(data.claim_id);
      } else {
        setFeedback(`❌ ${data.error || "Failed to submit claim."}`);
      }
    } catch (err) {
      console.error("Claim error:", err);
      setFeedback("❌ Failed to submit claim. Please try again.");
    }
  };

  // 🖼️ Image
  const SUPABASE_URL =
    "https://npudlbublntelxzmzlmu.supabase.co/storage/v1/object/public/item-photos";
  const imageSrc = item?.image
    ? item.image.startsWith("http")
      ? item.image
      : `${SUPABASE_URL}/${item.image}`
    : "https://placehold.co/600x400?text=No+Image+Available";

  const formatDateTime = (timestamp: string) =>
    new Date(timestamp).toLocaleString("en-US", {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  if (!item)
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        Loading item details...
      </div>
    );

  const isClaimed =
    item.status && item.status.toLowerCase() === "claimed";

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* 🖼️ Image */}
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

        {/* 🧾 Details */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow border border-gray-200 dark:border-gray-700">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {item.name}
          </h1>
          <p className="text-gray-700 dark:text-gray-400 mt-2">{item.description}</p>

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
                  : item.status?.toLowerCase() === "claimed"
                  ? "bg-yellow-200 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-200"
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
              <strong>Reported by:</strong> {item.reporter_name || "Unknown"}
            </p>
            <p>
              <strong>Reported on:</strong>{" "}
              {item.reported_at ? formatDateTime(item.reported_at) : "N/A"}
            </p>
          </div>

          {/* 🚫 Disable claim if already claimed */}
          {isClaimed ? (
            <div className="mt-6 p-3 rounded-lg bg-yellow-100 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100 text-center font-medium">
              ⚠️ This item has already been claimed.
            </div>
          ) : (
            !isAdmin && (
              <>
                {claimStatus === "Pending" ? (
                  <p className="mt-6 text-yellow-600 font-medium text-center">
                    🕒 Your claim is pending admin approval.
                  </p>
                ) : claimStatus === "Approved" ? (
                  <p className="mt-6 text-green-600 font-medium text-center">
                    ✅ Your claim has been approved! Please collect it from the secretary.
                  </p>
                ) : claimStatus === "Rejected" ? (
                  <p className="mt-6 text-red-600 font-medium text-center">
                    ❌ Your claim was rejected. Please contact the secretary for details.
                  </p>
                ) : (
                  <button
                    onClick={() => setShowClaimForm(!showClaimForm)}
                    className="mt-6 w-full bg-ubBlue text-white py-2 rounded-lg hover:opacity-90 transition"
                  >
                    {showClaimForm ? "Cancel" : "Claim This Item"}
                  </button>
                )}

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
              </>
            )
          )}

          {/* 🗨️ Feedback */}
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

          {/* 💬 Chat Button */}
          {claimId && (
            <div className="mt-5 flex justify-center">
              <Link
                href={`/user/chat/${claimId}`}
                className="px-4 py-2 bg-ubGold text-black font-semibold rounded-lg hover:bg-yellow-400 transition"
              >
                💬 Chat with Admin
              </Link>
            </div>
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
