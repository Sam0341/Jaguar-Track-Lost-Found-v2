"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ItemData = {
  id: string;
  name: string;
  campus: string;
  description: string;
  image?: string | null;
  reporter_email?: string | null; // ✅ added
};

type ProfileData = {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
};

type ClaimView = {
  id: string;
  message: string | null;
  status: string | null;
  created_at: string | null;
  items: ItemData | null;
  profiles: ProfileData | null;
};

export default function AdminClaimsPage() {
  const [claims, setClaims] = useState<ClaimView[]>([]);
  const [selectedClaim, setSelectedClaim] = useState<ClaimView | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const shouldSendDevHeader = () =>
    typeof window !== "undefined" && window.location.hostname.includes("localhost");

  useEffect(() => {
    fetchClaims();
  }, []);

  // 🧠 Fetch all claims joined with items + profiles
  async function fetchClaims() {
    setLoading(true);
    setErrorMsg(null);

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;

      // optional API call for auth validation
      const res = await fetch("/api/claims", {
        method: "GET",
        credentials: "include",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(shouldSendDevHeader() ? { "x-dev-admin": "true" } : {}),
        },
      });

      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      await res.json(); // verify auth response

      // ✅ Explicitly reference correct foreign key relationships
      const { data, error } = await supabase
        .from("claims")
        .select(`
          id,
          message,
          status,
          created_at,
          items:claims_item_id_fkey (
            id,
            name,
            campus,
            description,
            image,
            reporter_email
          ),
          profiles:fk_claims_claimed_by (
            id,
            full_name,
            email,
            phone
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setClaims((data as any) || []);
    } catch (err: any) {
      console.error("Fetch claims error:", err);
      setErrorMsg(err.message || "Failed to fetch claims");
    } finally {
      setLoading(false);
    }
  }

  // 🟢 Approve / Reject claim
  async function updateClaimStatus(claimId: string, status: "approved" | "rejected") {
    setActionLoading(claimId);
    setErrorMsg(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch("/api/claims", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ claim_id: claimId, status }),
      });

      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

      setClaims((prev) =>
        prev.map((c) => (c.id === claimId ? { ...c, status } : c))
      );
      if (selectedClaim?.id === claimId)
        setSelectedClaim({ ...selectedClaim, status });
    } catch (err: any) {
      console.error("Update error:", err);
      setErrorMsg(err.message || "Failed to update claim");
    } finally {
      setActionLoading(null);
    }
  }

  // 💨 ESC closes modals
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedClaim(null);
        setZoomImage(null);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  if (loading)
    return <div className="text-center py-16 text-gray-400">Loading claims...</div>;

  if (errorMsg)
    return (
      <div className="text-center py-16 text-red-400">
        Failed to load claims: {errorMsg}
        <br />
        <button
          onClick={fetchClaims}
          className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-md"
        >
          Retry
        </button>
      </div>
    );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Claims Management</h1>

      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-700 text-left">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Campus</th>
              <th className="px-4 py-3">Claimed By</th>
              <th className="px-4 py-3">Message</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr
                key={c.id}
                onClick={() => setSelectedClaim(c)}
                className="border-b dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
              >
                <td className="px-4 py-3 font-semibold text-ubGold">
                  {c.items?.name ?? "—"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {c.items?.campus ?? "—"}
                </td>
                <td className="px-4 py-3 text-sm">
                  {c.profiles?.full_name
                    ? `${c.profiles.full_name} (${c.profiles.email})`
                    : c.profiles?.email ?? "—"}
                </td>
                <td className="px-4 py-3 max-w-xs truncate">{c.message ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      c.status?.toLowerCase() === "approved"
                        ? "bg-green-600 text-white"
                        : c.status?.toLowerCase() === "rejected"
                        ? "bg-red-600 text-white"
                        : "bg-yellow-500 text-white"
                    }`}
                  >
                    {c.status
                      ? c.status.charAt(0).toUpperCase() + c.status.slice(1)
                      : "Pending"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {c.created_at
                    ? new Date(c.created_at).toLocaleString("en-BZ")
                    : "—"}
                </td>
                <td className="px-4 py-3 space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateClaimStatus(c.id, "approved");
                    }}
                    disabled={actionLoading !== null}
                    className="px-3 py-1 rounded bg-green-600 text-white disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateClaimStatus(c.id, "rejected");
                    }}
                    disabled={actionLoading !== null}
                    className="px-3 py-1 rounded bg-red-600 text-white disabled:opacity-50"
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 🪟 Modal */}
      {selectedClaim && (
        <div
          onClick={() => setSelectedClaim(null)}
          className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 w-full max-w-lg relative"
          >
            <button
              onClick={() => setSelectedClaim(null)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-100 text-lg"
            >
              ✕
            </button>

            <h2 className="text-xl font-bold mb-4 text-ubGold">Claim Details</h2>

            {selectedClaim.items?.image && (
              <img
                src={`https://npudlbublntelxzmzlmu.supabase.co/storage/v1/object/public/item-photos/${selectedClaim.items.image}`}
                alt="Item"
                onClick={() =>
                  setZoomImage(
                    `https://npudlbublntelxzmzlmu.supabase.co/storage/v1/object/public/item-photos/${selectedClaim.items?.image}`
                  )
                }
                className="w-full h-48 object-cover rounded-lg mb-4 cursor-zoom-in hover:opacity-90 transition"
              />
            )}

            <div className="space-y-2 text-gray-700 dark:text-gray-300">
              <p><strong>Item:</strong> {selectedClaim.items?.name ?? "—"}</p>
              <p><strong>Campus:</strong> {selectedClaim.items?.campus ?? "—"}</p>
              <p><strong>Description:</strong> {selectedClaim.items?.description ?? "—"}</p>
              <hr className="my-2 border-gray-600" />
              <p><strong>Claimant:</strong> {selectedClaim.profiles?.full_name ?? "—"}</p>
              <p><strong>Claimant Email:</strong> {selectedClaim.profiles?.email ?? "—"}</p>
              <p><strong>Reporter Email:</strong> {selectedClaim.items?.reporter_email ?? "—"}</p>
              <p><strong>Phone:</strong> {selectedClaim.profiles?.phone ?? "—"}</p>
              <p><strong>Message:</strong> {selectedClaim.message ?? "—"}</p>
              <p>
                <strong>Status:</strong>{" "}
                {selectedClaim.status
                  ? selectedClaim.status.charAt(0).toUpperCase() +
                    selectedClaim.status.slice(1)
                  : "Pending"}
              </p>
              <p>
                <strong>Date:</strong>{" "}
                {selectedClaim.created_at
                  ? new Date(selectedClaim.created_at).toLocaleString("en-BZ")
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      {zoomImage && (
        <div
          onClick={() => setZoomImage(null)}
          className="fixed inset-0 bg-black/90 z-[9999] flex justify-center items-center"
        >
          <img
            src={zoomImage}
            alt="Zoomed Item"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-lg cursor-zoom-out"
          />
        </div>
      )}
    </div>
  );
}
