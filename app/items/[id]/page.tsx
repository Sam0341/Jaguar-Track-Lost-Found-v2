"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ItemDetails({ params }: { params: { id: string } }) {
  const [item, setItem] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [claimStatus, setClaimStatus] = useState<string | null>(null);
  const [claimId, setClaimId] = useState<string | null>(null);
  const [claimMessage, setClaimMessage] = useState("");
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [feedback, setFeedback] = useState("");
  const router = useRouter();

  const PUBLIC_BUCKET =
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/item-photos`;

  // Load item + user + claim status
  useEffect(() => {
    async function load() {
      // Load user
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);

      // Load item with relations
      const { data, error } = await supabase
        .from("items")
        .select(`
          id,
          name,
          description,
          image,
          status,
          reported_at,
          campus:campus_id ( id, name ),
          category:category_id ( id, name ),
          reporter:reported_by ( id, full_name, email )
        `)
        .eq("id", params.id)
        .maybeSingle();

      if (error) console.error(error);

      if (data) {
        setItem({
          ...data,
          campus: data.campus?.[0]?.name || "Unknown Campus",
          category: data.category?.[0]?.name || "Other",
          reporter_name: data.reporter?.[0]?.full_name || "Unknown",
          reporter_email: data.reporter?.[0]?.email || "",
          image_url: data.image
            ? data.image.startsWith("http")
              ? data.image
              : `${PUBLIC_BUCKET}/${data.image}`
            : null,
        });
      }

      // Check if user claimed this item
      if (session?.user) {
        const { data: claim } = await supabase
          .from("claims")
          .select("id, status")
          .eq("item_id", params.id)
          .eq("claimed_by", session.user.id)
          .maybeSingle();

        if (claim) {
          setClaimStatus(claim.status);
          setClaimId(claim.id);
        }
      }
    }

    load();
  }, [params.id]);

  // Handle claim submit
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

  if (!item)
    return (
      <div className="p-6 text-center text-gray-500">Loading item…</div>
    );

  const isClaimed = item.status?.toLowerCase() === "claimed";

  return (
    <div className="container mx-auto p-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* IMAGE */}
        <div className="rounded-xl overflow-hidden bg-gray-200">
          <img
            src={
              item.image_url ||
              "https://placehold.co/600x400?text=No+Image"
            }
            className="w-full h-80 object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "https://placehold.co/600x400?text=Image+Unavailable";
            }}
          />
        </div>

        {/* DETAILS */}
        <div className="p-6 bg-white dark:bg-gray-900 rounded-xl shadow-md">
          <h1 className="text-2xl font-bold mb-2">{item.name}</h1>
          <p className="text-gray-600 dark:text-gray-300">{item.description}</p>

          <div className="flex gap-2 mt-4">
            <span className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-sm">
              {item.category}
            </span>
            <span className="px-3 py-1 bg-blue-200 dark:bg-blue-700 rounded-full text-sm">
              {item.campus}
            </span>
            <span
              className={`px-3 py-1 rounded-full text-sm ${
                item.status === "found"
                  ? "bg-green-200 text-green-800"
                  : "bg-yellow-300 text-yellow-900"
              }`}
            >
              {item.status?.toUpperCase()}
            </span>
          </div>

          {/* REPORTER */}
          <div className="mt-4 text-sm text-gray-500">
            <p><strong>Reported by:</strong> {item.reporter_name}</p>
            <p><strong>Email:</strong> {item.reporter_email}</p>
          </div>

          {/* CLAIM UI */}
          {!isClaimed && user && (
            <>
              {claimStatus === "Pending" && (
                <p className="mt-4 text-yellow-600">
                  🕒 Your claim is pending admin approval.
                </p>
              )}

              {claimStatus === "Approved" && (
                <p className="mt-4 text-green-600">
                  ✅ Your claim was approved!
                </p>
              )}

              {claimStatus === "Rejected" && (
                <p className="mt-4 text-red-600">
                  ❌ Your claim was rejected.
                </p>
              )}

              {!claimStatus && (
                <button
                  className="mt-4 w-full bg-ubBlue text-white py-2 rounded-lg"
                  onClick={() => setShowClaimForm(!showClaimForm)}
                >
                  Claim This Item
                </button>
              )}

              {showClaimForm && (
                <form className="mt-4" onSubmit={handleClaimSubmit}>
                  <textarea
                    value={claimMessage}
                    onChange={(e) => setClaimMessage(e.target.value)}
                    placeholder="Message (optional)"
                    className="w-full p-2 border rounded"
                  />

                  <button
                    type="submit"
                    className="mt-3 w-full bg-green-600 text-white py-2 rounded-lg"
                  >
                    Submit Claim
                  </button>
                </form>
              )}
            </>
          )}

          {feedback && <p className="mt-3 text-center">{feedback}</p>}

          {claimId && (
            <Link
              href={`/user/chat/${claimId}`}
              className="mt-4 block text-center px-4 py-2 bg-ubGold rounded-lg font-bold"
            >
              💬 Chat with Admin
            </Link>
          )}

          <Link
            href="/items"
            className="mt-4 inline-block text-blue-600"
          >
            ← Back to Items
          </Link>
        </div>
      </div>
    </div>
  );
}
