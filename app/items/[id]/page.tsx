"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function ItemDetails({ params }: { params: { id: string } }) {
  const [item, setItem] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [claimMessage, setClaimMessage] = useState("");
  const [feedback, setFeedback] = useState("");
  const [claimStatus, setClaimStatus] = useState<string | null>(null);
  const [claimId, setClaimId] = useState<string | null>(null);

  const router = useRouter();

  // 🔥 Fetch user + item
  useEffect(() => {
    async function load() {
      // USER
      const { data: userData } = await supabase.auth.getUser();
      const u = userData?.user || null;
      setUser(u);

      if (u?.user_metadata?.role === "admin") setIsAdmin(true);

      // ITEM (🔥 FIXED QUERY FOR NEW DB)
      const { data, error } = await supabase
        .from("items")
        .select(`
          id,
          name,
          description,
          status,
          image,
          reported_at,
          category:category_id ( name ),
          campus:campus_id ( name ),
          reporter:reported_by ( full_name, email )
        `)
        .eq("id", params.id)
        .maybeSingle();

      if (!data) return;

      // 🔄 Map DB → UI expected fields
      const mapped = {
        ...data,
        category: data.category?.name || "Other",
        campus: data.campus?.name || "Unknown Campus",
        reporter_name: data.reporter?.full_name || "Unknown",
        reporter_email: data.reporter?.email || "Unknown",
        image_url: data.image
          ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/item-photos/${data.image}`
          : null,
      };

      setItem(mapped);

      // CHECK CLAIM FOR THIS ITEM
      if (u) {
        const { data: claim } = await supabase
          .from("claims")
          .select("id, status")
          .eq("item_id", params.id)
          .eq("claimed_by", u.id)
          .maybeSingle();

        if (claim) {
          setClaimStatus(claim.status);
          setClaimId(claim.id);
        }
      }
    }

    load();
  }, [params.id]);

  // 📤 Submit claim
  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return router.push("/login");

    setFeedback("Submitting your claim...");

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

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

    const json = await res.json();

    if (res.ok && json.success) {
      setFeedback("✅ Claim submitted! Awaiting admin approval.");
      setClaimStatus("Pending");
      setShowClaimForm(false);
      setClaimId(json.claim_id);
    } else {
      setFeedback("❌ Failed to submit claim.");
    }
  };

  // 🖼 IMAGE FIX
  const imgSrc =
    item?.image_url ||
    "https://placehold.co/600x400?text=No+Image+Available";

  const formatDate = (ts: string) =>
    new Date(ts).toLocaleString("en-US", {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  if (!item)
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        Loading item details...
      </div>
    );

  const isClaimed = item.status?.toLowerCase() === "claimed";

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* 🖼 IMAGE */}
        <div className="rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800">
          <img
            src={imgSrc}
            alt={item.name}
            className="w-full h-80 object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "https://placehold.co/600x400?text=Image+Unavailable";
            }}
          />
        </div>

        {/* 📄 DETAILS */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow border">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {item.name}
          </h1>

          <p className="text-gray-700 dark:text-gray-400 mt-2">
            {item.description}
          </p>

          {/* TAGS */}
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="bg-blue-100 dark:bg-blue-900 px-3 py-1 rounded-full text-sm">
              {item.category}
            </span>

            <span className="bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full text-sm">
              {item.campus}
            </span>

            <span
              className={`px-3 py-1 rounded-full text-sm ${
                item.status === "found"
                  ? "bg-green-200 text-green-800"
                  : item.status === "claimed"
                  ? "bg-yellow-200 text-yellow-800"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {item.status?.toUpperCase()}
            </span>
          </div>

          {/* REPORTER */}
          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            <p>
              <strong>Reported by:</strong> {item.reporter_name}
            </p>
            <p>
              <strong>Reported on:</strong>{" "}
              {item.reported_at ? formatDate(item.reported_at) : "Unknown"}
            </p>
          </div>

          {/* CLAIM BUTTONS */}
          {isClaimed ? (
            <div className="mt-6 p-3 rounded-lg bg-yellow-100 text-center text-yellow-900">
              ⚠️ This item has already been claimed.
            </div>
          ) : !isAdmin ? (
            <>
              {claimStatus === "Pending" ? (
                <p className="mt-6 text-yellow-600 text-center">
                  🕒 Your claim is pending.
                </p>
              ) : (
                <>
                  <button
                    onClick={() => setShowClaimForm(!showClaimForm)}
                    className="mt-6 w-full bg-ubBlue text-white py-2 rounded-lg"
                  >
                    {showClaimForm ? "Cancel" : "Claim This Item"}
                  </button>

                  {showClaimForm && (
                    <form
                      onSubmit={handleClaimSubmit}
                      className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 border rounded-lg"
                    >
                      <textarea
                        value={claimMessage}
                        onChange={(e) => setClaimMessage(e.target.value)}
                        className="w-full p-2 border rounded-lg dark:bg-gray-900 dark:text-gray-100"
                        rows={3}
                        placeholder="Add a message (optional)"
                      />
                      <button className="mt-3 w-full bg-green-600 text-white py-2 rounded-lg">
                        Submit Claim
                      </button>
                    </form>
                  )}
                </>
              )}
            </>
          ) : null}

          {/* FEEDBACK */}
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

          {/* CHAT BUTTON */}
          {claimId && (
            <div className="mt-5 text-center">
              <Link
                href={`/user/chat/${claimId}`}
                className="px-4 py-2 bg-ubGold text-black rounded-lg"
              >
                💬 Chat with Admin
              </Link>
            </div>
          )}

          {/* BACK TO ITEMS */}
          <Link
            href="/items"
            className="mt-6 inline-block bg-blue-600 text-white px-5 py-2 rounded-lg"
          >
            ← Back to Items
          </Link>
        </div>
      </div>
    </div>
  );
}
