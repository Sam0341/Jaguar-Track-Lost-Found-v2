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
  const [previewOpen, setPreviewOpen] = useState(false);

  const router = useRouter();
  const BUCKET = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/item-photos`;

  /* -----------------------------------------------------------
   * LOAD ITEM + USER
   * ----------------------------------------------------------- */
  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;

      setUser(session?.user || null);
      if (session?.user?.user_metadata?.role === "admin") setIsAdmin(true);

      /* ITEM BASE DATA */
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

      if (error || !data) return;

      /* CAMPUS */
      let campusName = "Unknown Campus";
      if (data.campus_id) {
        const { data: campus } = await supabase
          .from("campuses")
          .select("name")
          .eq("id", data.campus_id)
          .maybeSingle();
        if (campus) campusName = campus.name;
      }

      /* CATEGORY */
      let categoryName = "Other";
      if (data.category_id) {
        const { data: cat } = await supabase
          .from("categories")
          .select("name")
          .eq("id", data.category_id)
          .maybeSingle();
        if (cat) categoryName = cat.name;
      }

      /* REPORTER */
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

      /* LOAD REPORT (expiration, storage, etc.) */
      const { data: reportData } = await supabase
        .from("reports")
        .select("expiration_date, created_at, storage_location")
        .eq("item_id", params.id)
        .maybeSingle();

      setItem({
        ...data,
        campus: campusName,
        category: categoryName,
        reporter_name: reporterName,
        reporter_email: reporterEmail,
        image_url: data.image
          ? `${BUCKET}/${data.image}`
          : "https://placehold.co/600x400?text=No+Image",
        expiration_date: reportData?.expiration_date || null,
      });

      /* CLAIM STATUS (user’s own claim) */
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

      /* SOMEONE ELSE PENDING */
      const { data: pending } = await supabase
        .from("claims")
        .select("id, claimed_by, status")
        .eq("item_id", params.id)
        .eq("status", "pending");

      if (pending && pending.length > 0) {
        if (!session?.user || pending[0].claimed_by !== session?.user?.id) {
          setSomeoneElsePending(true);
        }
      }
    }

    load();
  }, [params.id]);

  /* ------------------------------------------
   * DATE HELPERS
   * ------------------------------------------ */
  const formatDate = (ts: string) =>
    new Date(ts).toLocaleDateString("en-BZ", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleTimeString("en-BZ", {
      hour: "2-digit",
      minute: "2-digit",
    });

  /* Expiration color */
  function expirationColor(exp?: string | null) {
    if (!exp) return "text-gray-400";

    const today = new Date().setHours(0, 0, 0, 0);
    const date = new Date(exp).setHours(0, 0, 0, 0);
    const diff = date - today;

    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (days <= 0) return "text-red-600 font-semibold";
    if (days <= 3) return "text-yellow-600 font-semibold";
    return "text-green-600 font-semibold";
  }

  /* ------------------------------------------
   * SUBMIT CLAIM
   * ------------------------------------------ */
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
      setShowClaimForm(false);
      setFeedback("✔ Claim submitted!");
    } else {
      setFeedback(`❌ ${result.error || "Failed to submit claim."}`);
    }
  };

  if (!item) {
    return (
      <div className="text-center mt-10 text-gray-500 dark:text-gray-300">
        Loading item…
      </div>
    );
  }

  const itemClaimed = item.status?.toLowerCase() === "claimed";

  return (
    <div className="container mx-auto p-6 pb-20 relative">
      {/* FULLSCREEN IMAGE PREVIEW */}
      {previewOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 animate-fadeIn"
          onClick={() => setPreviewOpen(false)}
        >
          <img
            src={item.image_url}
            className="max-w-[95%] max-h-[95%] rounded-lg shadow-xl"
          />
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        {/* IMAGE */}
        <div
          className="bg-gray-200 dark:bg-gray-800 rounded-xl overflow-hidden shadow h-[360px] flex items-center justify-center cursor-pointer"
          onClick={() => setPreviewOpen(true)}
        >
          <img src={item.image_url} className="w-full h-full object-cover" />
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
              <strong>Reported at:</strong>{" "}
              {formatDate(item.reported_at)} — {formatTime(item.reported_at)}
            </p>

            <p>
              <strong>Location:</strong> {item.location}
            </p>

            {item.dropoff_location && (
              <p>
                <strong>Drop-off:</strong> {item.dropoff_location}
              </p>
            )}

            {/* ⭐ EXPIRATION DATE */}
            <p>
              <strong>Expiration:</strong>{" "}
              <span className={expirationColor(item.expiration_date)}>
                {item.expiration_date
                  ? formatDate(item.expiration_date)
                  : "—"}
              </span>
            </p>
          </div>

          {/* CLAIM STATUSES */}
          {itemClaimed && (
            <p className="text-red-500 font-medium mb-3">
              ❌ This item has already been claimed.
            </p>
          )}

          {someoneElsePending && !claimStatus && !itemClaimed && (
            <p className="text-yellow-400 font-medium mb-3">
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
              ✔ Your claim was approved!
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
