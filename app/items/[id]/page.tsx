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
  const router = useRouter();

  const PUBLIC_BUCKET =
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/item-photos`;

  // Load item + user + claims
  useEffect(() => {
    async function loadData() {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      setUser(session?.user || null);

      if (session?.user?.user_metadata?.role === "admin") {
        setIsAdmin(true);
      }

      // Load the item
      const { data, error } = await supabase
        .from("items")
        .select(`
          id,
          name,
          description,
          location,
          image,
          status,
          reported_at,

          campus:campus_id ( id, name ),
          category:category_id ( id, name ),
          reporter:reported_by ( id, full_name, email )
        `)
        .eq("id", params.id)
        .maybeSingle();

      if (!error && data) {
        const campusObj = Array.isArray(data.campus) ? data.campus[0] : data.campus;
        const categoryObj = Array.isArray(data.category) ? data.category[0] : data.category;
        const reporterObj = Array.isArray(data.reporter) ? data.reporter[0] : data.reporter;

        setItem({
          ...data,
          campus: campusObj?.name || "Unknown Campus",
          category: categoryObj?.name || "Other",
          reporter_name: reporterObj?.full_name || "Unknown",
          reporter_email: reporterObj?.email || "",
          image_url: data.image
            ? (data.image.startsWith("http")
                ? data.image
                : `${PUBLIC_BUCKET}/${data.image}`)
            : null,
        });
      }

      // Load user's claim status
      if (session?.user) {
        const { data: claim } = await supabase
          .from("claims")
          .select("id, status")
          .eq("item_id", params.id)
          .eq("claimed_by", session.user.id)
          .maybeSingle();

        if (claim) {
          setClaimId(claim.id);
          setClaimStatus(claim.status);
        }
      }
    }

    loadData();
  }, [params.id]);

  const formatDate = (ts: string) =>
    new Date(ts).toLocaleString("en-US", {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const submitClaim = async (e: any) => {
    e.preventDefault();
    if (!user) return router.push("/login");

    setFeedback("Submitting claim...");

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
      setClaimStatus("Pending");
      setClaimId(result.claim_id);
      setFeedback("✔ Claim submitted!");
      setShowClaimForm(false);
    } else {
      setFeedback("❌ Failed to submit claim.");
    }
  };

  if (!item) {
    return (
      <div className="text-center mt-10 text-gray-500 dark:text-gray-400">
        Loading item details…
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 pb-20">
      <div className="grid md:grid-cols-2 gap-8">

        {/* IMAGE SECTION */}
        <div className="bg-gray-200 dark:bg-gray-800 rounded-xl overflow-hidden shadow">
          <img
            src={item.image_url || "https://placehold.co/600x400?text=No+Image"}
            className="w-full h-[360px] object-cover rounded-xl"
          />
        </div>

        {/* DETAILS */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow border border-gray-200 dark:border-gray-700">

          <h1 className="text-3xl font-bold dark:text-white mb-2">{item.name}</h1>
          <p className="text-gray-600 dark:text-gray-300">{item.description}</p>

          {/* TAGS */}
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="badge bg-gray-700 text-white">{item.category}</span>
            <span className="badge bg-blue-700 text-white">{item.campus}</span>

            <span
              className={`badge ${
                item.status === "found"
                  ? "bg-green-600 text-white"
                  : "bg-yellow-500 text-black"
              }`}
            >
              {item.status.toUpperCase()}
            </span>
          </div>

          {/* REPORTER INFO */}
          <div className="mt-5 text-sm dark:text-gray-300 space-y-1">
            <p><strong className="text-gray-500">Reported by:</strong> {item.reporter_name}</p>

            {isAdmin && (
              <p>
                <strong className="text-gray-500">Reporter Email:</strong> {item.reporter_email}
              </p>
            )}

            <p>
              <strong className="text-gray-500">Reported At:</strong>{" "}
              {item.reported_at ? formatDate(item.reported_at) : "Unknown"}
            </p>

            <p>
              <strong className="text-gray-500">Location:</strong> {item.location || "Not provided"}
            </p>
          </div>

          {/* CLAIM SECTION */}
          {!claimStatus && (
            <button
              onClick={() => setShowClaimForm(!showClaimForm)}
              className="mt-6 w-full bg-ubBlue text-white py-2 rounded-lg hover:opacity-80"
            >
              Claim This Item
            </button>
          )}

          {claimStatus === "Pending" && (
            <p className="mt-4 text-yellow-500">🕒 Your claim is pending approval.</p>
          )}

          {claimStatus === "Approved" && (
            <p className="mt-4 text-green-500">✔ Your claim was approved!</p>
          )}

          {showClaimForm && (
            <form onSubmit={submitClaim} className="mt-4">
              <textarea
                rows={3}
                placeholder="Optional message to admin"
                value={claimMessage}
                onChange={(e) => setClaimMessage(e.target.value)}
                className="w-full p-3 rounded-lg border dark:bg-gray-800 dark:text-white"
              />
              <button
                type="submit"
                className="mt-3 w-full bg-green-700 text-white py-2 rounded-lg hover:opacity-90"
              >
                Submit Claim
              </button>
            </form>
          )}

          {feedback && (
            <p className="mt-3 text-center dark:text-white">{feedback}</p>
          )}

          {/* CHAT BUTTON */}
          {claimId && (
            <Link
              href={`/user/chat/${claimId}`}
              className="mt-4 block text-center bg-ubGold py-2 rounded-lg font-bold hover:opacity-90"
            >
              💬 Chat with Admin
            </Link>
          )}

          <Link href="/items" className="mt-6 inline-block text-blue-600 dark:text-blue-400">
            ← Back to Items
          </Link>
        </div>
      </div>
    </div>
  );
}
