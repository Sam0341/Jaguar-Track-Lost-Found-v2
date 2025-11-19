"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ItemDetails({ params }: { params: { id: string } }) {
  const [item, setItem] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [claimStatus, setClaimStatus] = useState<string | null>(null);
  const [claimId, setClaimId] = useState<string | null>(null);

  const [claimMessage, setClaimMessage] = useState("");
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [feedback, setFeedback] = useState("");

  const [someoneElsePending, setSomeoneElsePending] = useState(false);

  const router = useRouter();

  const BUCKET = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/item-photos`;

  /* -----------------------------------------------------------
   * LOAD ITEM + USER SESSION
   * ----------------------------------------------------------- */
  useEffect(() => {
    async function load() {
      /* -------- LOAD USER SESSION -------- */
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      setUser(session?.user || null);

      if (session?.user?.user_metadata?.role === "admin") {
        setIsAdmin(true);
      }

      /* -------- LOAD ITEM (INCLUDING NEW DROPOFF LOCATION) -------- */
      const { data, error } = await supabase
        .from("items")
        .select(
          `
            id,
            name,
            description,
            location,
            dropoff_location,
            image,
            status,
            reported_at,
            campus_id,
            category_id,
            reported_by
          `
        )
        .eq("id", params.id)
        .maybeSingle();

      if (error) {
        console.error("❌ Item fetch error:", error);
        return;
      }

      if (data) {
        /* ---------- LOAD CAMPUS NAME ---------- */
        let campusName = "Unknown Campus";
        if (data.campus_id) {
          const { data: campus } = await supabase
            .from("campuses")
            .select("name")
            .eq("id", data.campus_id)
            .maybeSingle();
          if (campus) campusName = campus.name;
        }

        /* ---------- LOAD CATEGORY NAME ---------- */
        let categoryName = "Other";
        if (data.category_id) {
          const { data: category } = await supabase
            .from("categories")
            .select("name")
            .eq("id", data.category_id)
            .maybeSingle();
          if (category) categoryName = category.name;
        }

        /* ---------- LOAD REPORTER PROFILE ---------- */
        let reporterName = "Unknown";
        let reporterEmail = "";

        if (data.reported_by) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", data.reported_by)
            .maybeSingle();

          if (profile) {
            reporterName = profile.full_name || "Unknown";
            reporterEmail = profile.email || "";
          }
        }

        setItem({
          ...data,
          campus: campusName,
          category: categoryName,
          reporter_name: reporterName,
          reporter_email: reporterEmail,
          image_url: data.image
            ? data.image.startsWith("http")
              ? data.image
              : `${BUCKET}/${data.image}`
            : null,
        });
      }

      /* -----------------------------------------------------------
       * CHECK USER CLAIM STATUS
       * ----------------------------------------------------------- */
      if (session?.user) {
        const { data: myClaim } = await supabase
          .from("claims")
          .select("id, status")
          .eq("item_id", params.id)
          .eq("claimed_by", session.user.id)
          .maybeSingle();

        if (myClaim) {
          setClaimId(myClaim.id);
          setClaimStatus(myClaim.status);
        }
      }

      /* -----------------------------------------------------------
       * CHECK IF SOMEONE ELSE HAS A PENDING CLAIM
       * ----------------------------------------------------------- */
      const { data: pendingCheck } = await supabase
        .from("claims")
        .select("id, claimed_by, status")
        .eq("item_id", params.id)
        .eq("status", "pending");

      if (Array.isArray(pendingCheck) && pendingCheck.length > 0) {
        const pending = pendingCheck[0];

        if (!session?.user || pending.claimed_by !== session.user.id) {
          setSomeoneElsePending(true);
        }
      }
    }

    load();
  }, [params.id]);

  /* -----------------------------------------------------------
   * DATE FORMATTER
   * ----------------------------------------------------------- */
  const formatDate = (ts: string) =>
    new Date(ts).toLocaleString("en-US", {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  /* -----------------------------------------------------------
   * SUBMIT CLAIM
   * ----------------------------------------------------------- */
  const submitClaim = async (e: any) => {
    e.preventDefault();
    if (!user) return router.push("/login");

    setFeedback("Submitting claim…");

    const token = (await supabase.auth.getSession()).data.session?.access_token;

    const res = await fetch("/api/claims", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        item_id: item.id,
        message: claimMessage,
      }),
    });

    const result = await res.json();

    if (result.success) {
      setClaimStatus("pending");
      setFeedback("✔ Claim submitted!");
      setShowClaimForm(false);
    } else {
      setFeedback(`❌ ${result.error || "Failed to submit claim."}`);
    }
  };

  /* -----------------------------------------------------------
   * UI RENDER
   * ----------------------------------------------------------- */
  if (!item) {
    return (
      <div className="text-center mt-10 text-gray-500 dark:text-gray-300">
        Loading item…
      </div>
    );
  }

  const itemClaimed = item.status?.toLowerCase() === "claimed";

  return (
    <div className="container mx-auto p-6 pb-20">
      <div className="grid md:grid-cols-2 gap-8">
        {/* IMAGE */}
        <div className="bg-gray-200 dark:bg-gray-800 rounded-xl overflow-hidden shadow">
          <img
            src={item.image_url || "https://placehold.co/600x400?text=No+Image"}
            className="w-full h-[360px] object-cover"
          />
        </div>

        {/* DETAILS */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow border dark:border-gray-700">
          <h1 className="text-3xl font-bold dark:text-white mb-2">{item.name}</h1>

          <p className="text-gray-600 dark:text-gray-300 mb-3">{item.description}</p>

          {/* TAGS */}
          <div className="flex flex-wrap gap-2 mb-5">
            <span className="badge bg-gray-700 text-white">{item.category}</span>
            <span className="badge bg-blue-700 text-white">{item.campus}</span>
            <span className="badge bg-yellow-500 text-black">
              {item.status.toUpperCase()}
            </span>
          </div>

          {/* REPORT INFO */}
          <div className="text-sm dark:text-gray-300 space-y-1 mb-6">
            <p>
              <strong>Reported by:</strong> {item.reporter_name}
            </p>
            {isAdmin && (
              <p>
                <strong>Email:</strong> {item.reporter_email}
              </p>
            )}
            <p>
              <strong>Reported at:</strong> {formatDate(item.reported_at)}
            </p>
            <p>
              <strong>Location:</strong> {item.location}
            </p>

            {/* ⭐ ADMIN-ONLY DROPOFF LOCATION */}
            {isAdmin && item.dropoff_location && (
              <p>
                <strong>Drop-off Location:</strong> {item.dropoff_location}
              </p>
            )}
          </div>

          {/* CLAIM MESSAGES */}
          {itemClaimed && (
            <p className="text-red-500 font-medium mb-3">
              ❌ This item has already been fully claimed.
            </p>
          )}

          {someoneElsePending && !claimStatus && !itemClaimed && (
            <p className="text-yellow-500 font-medium mb-3">
              ⚠ Someone else is currently claiming this item.
            </p>
          )}

          {claimStatus === "pending" && (
            <p className="text-yellow-400 font-medium mb-3">
              🕒 Your claim is pending admin approval.
            </p>
          )}

          {claimStatus === "approved" && (
            <p className="text-green-500 font-medium mb-3">
              ✔ Your claim has been approved!
            </p>
          )}

          {/* CLAIM BUTTON */}
          {!claimStatus && !itemClaimed && !someoneElsePending && (
            <button
              onClick={() => setShowClaimForm(!showClaimForm)}
              className="w-full bg-ubBlue text-white py-2 rounded-lg hover:opacity-80"
            >
              Claim This Item
            </button>
          )}

          {/* CLAIM FORM */}
          {showClaimForm && (
            <form onSubmit={submitClaim} className="mt-4">
              <textarea
                rows={3}
                placeholder="Optional message"
                value={claimMessage}
                onChange={(e) => setClaimMessage(e.target.value)}
                className="w-full p-3 rounded-lg border dark:bg-gray-800 dark:text-white"
              />
              <button
                type="submit"
                className="mt-3 w-full bg-green-700 text-white py-2 rounded-lg"
              >
                Submit Claim
              </button>
            </form>
          )}

          {feedback && <p className="mt-3 text-center">{feedback}</p>}

          {/* CHAT BUTTON */}
          {(claimStatus === null || claimStatus === "rejected") && claimId && (
            <Link
              href={`/user/chat/${claimId}`}
              className="mt-4 block text-center bg-ubGold py-2 rounded-lg font-bold"
            >
              💬 Chat with Admin
            </Link>
          )}

          <Link href="/items" className="block mt-6 text-blue-500">
            ← Back to Items
          </Link>
        </div>
      </div>
    </div>
  );
}
