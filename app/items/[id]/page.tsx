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

  // Load item + user + claim info
  useEffect(() => {
    async function loadAll() {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);

      if (session?.user?.user_metadata?.role === "admin") {
        setIsAdmin(true);
      }

      // Load item
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

      if (error) console.log(error);

      if (data) {
        setItem({
          ...data,
          campus: data.campus?.[0]?.name || "Unknown Campus",
          category: data.category?.[0]?.name || "Other",
          reporter_name: data.reporter?.[0]?.full_name || "Unknown",
          reporter_email: data.reporter?.[0]?.email || "",
          image_url: data.image
            ? (data.image.startsWith("http") ? data.image : `${PUBLIC_BUCKET}/${data.image}`)
            : null,
        });
      }

      // Load claim status for user
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

    loadAll();
  }, [params.id]);

  // Format date
  const formatDate = (timestamp: string) =>
    new Date(timestamp).toLocaleString("en-US", {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  // Submit claim
  const handleClaimSubmit = async (e: any) => {
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
      setFeedback("✅ Claim submitted!");
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

  const isClaimed = item.status?.toLowerCase() === "claimed";

  return (
    <div className="container mx-auto p-6">
      <div className="grid md:grid-cols-2 gap-6">

        {/* IMAGE */}
        <div className="rounded-xl overflow-hidden bg-gray-200">
          <img
            src={item.image_url || "https://placehold.co/600x400?text=No+Image"}
            className="w-full h-80 object-cover"
          />
        </div>

        {/* DETAILS */}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow border border-gray-700">

          <h1 className="text-2xl font-bold mb-2 dark:text-white">{item.name}</h1>

          <p className="text-gray-700 dark:text-gray-300">{item.description}</p>

          {/* TAGS */}
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="px-3 py-1 bg-gray-700 text-white rounded-full text-sm">
              {item.category}
            </span>

            <span className="px-3 py-1 bg-blue-700 text-white rounded-full text-sm">
              {item.campus}
            </span>

            <span className={`px-3 py-1 rounded-full text-sm ${
              item.status === "found"
                ? "bg-green-700 text-white"
                : "bg-yellow-500 text-black"
            }`}>
              {item.status.toUpperCase()}
            </span>
          </div>

          {/* REPORTER */}
          <div className="mt-5 text-sm dark:text-gray-300 space-y-1">
            <p>
              <strong className="text-gray-500 dark:text-gray-400">
                Reported by:
              </strong>{" "}
              {item.reporter_name}
            </p>

            {isAdmin && (
              <p>
                <strong className="text-gray-500 dark:text-gray-400">
                  Reporter Email:
                </strong>{" "}
                {item.reporter_email}
              </p>
            )}

            <p>
              <strong className="text-gray-500 dark:text-gray-400">
                Reported At:
              </strong>{" "}
              {item.reported_at ? formatDate(item.reported_at) : "Unknown"}
            </p>

            <p>
              <strong className="text-gray-500 dark:text-gray-400">
                Location:
              </strong>{" "}
              {item.location || "Not Provided"}
            </p>
          </div>

          {/* CLAIM SECTION */}
          {!isClaimed && user && (
            <>
              {claimStatus === "Pending" && (
                <p className="mt-4 text-yellow-600 dark:text-yellow-400">
                  🕒 Your claim is pending admin approval.
                </p>
              )}

              {claimStatus === "Approved" && (
                <p className="mt-4 text-green-600">
                  ✅ Your claim was approved!
                </p>
              )}

              {!claimStatus && (
                <button
                  className="mt-6 w-full bg-ubBlue text-white py-2 rounded-lg hover:opacity-80"
                  onClick={() => setShowClaimForm(!showClaimForm)}
                >
                  Claim This Item
                </button>
              )}

              {showClaimForm && (
                <form onSubmit={handleClaimSubmit} className="mt-4">
                  <textarea
                    className="w-full p-2 border rounded dark:bg-gray-800 dark:text-white"
                    rows={3}
                    placeholder="Optional message"
                    value={claimMessage}
                    onChange={(e) => setClaimMessage(e.target.value)}
                  />

                  <button
                    type="submit"
                    className="mt-3 w-full bg-green-700 text-white py-2 rounded-lg"
                  >
                    Submit Claim
                  </button>
                </form>
              )}
            </>
          )}

          {feedback && (
            <p className="mt-3 text-center dark:text-white">{feedback}</p>
          )}

          {/* CHAT BUTTON */}
          {claimId && (
            <Link
              href={`/user/chat/${claimId}`}
              className="mt-4 block text-center px-4 py-2 bg-ubGold rounded-lg font-bold"
            >
              💬 Chat with Admin
            </Link>
          )}

          <Link href="/items" className="mt-6 inline-block text-blue-500">
            ← Back to Items
          </Link>
        </div>
      </div>
    </div>
  );
}
