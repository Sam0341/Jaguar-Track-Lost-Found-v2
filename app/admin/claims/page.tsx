"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ClaimRaw = {
  id: string;
  item_id: string;
  claimed_by?: string | null;
  message?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type ClaimView = ClaimRaw & {
  itemName?: string | null;
  itemCampus?: string | null;
  itemImage?: string | null;
  itemDesc?: string | null;
  claimantEmail?: string | null;
  claimantName?: string | null;
  claimantPhone?: string | null;
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
    fetchAndHydrateClaims();
  }, []);

  // 🧠 Fetch all claims and hydrate
  async function fetchAndHydrateClaims() {
    setLoading(true);
    setErrorMsg(null);

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;

      const res = await fetch("/api/claims", {
        method: "GET",
        credentials: "include",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(shouldSendDevHeader() ? { "x-dev-admin": "true" } : {}),
        },
      });

      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const rawData = await res.json();
      const rawClaims: ClaimRaw[] =
        Array.isArray(rawData) ? rawData : rawData?.claims || rawData?.data || [];

      const hydrated = await Promise.all(
        rawClaims.map(async (c) => {
          const view: ClaimView = { ...c };

          // 📦 Item details
          if (c.item_id) {
            const { data: item, error: itemErr } = await supabase
              .from("items")
              .select("name, campus, image_url, description")
              .eq("id", c.item_id)
              .single();

            if (!itemErr && item) {
              view.itemName = item.name;
              view.itemCampus = item.campus;
              view.itemImage = item.image_url;
              view.itemDesc = item.description;
            }
          }

          // 👤 Claimant details
          if (c.claimed_by) {
            const { data: profile, error: profileErr } = await supabase
              .from("profiles")
              .select("full_name, email, phone")
              .eq("id", c.claimed_by)
              .single();

            if (!profileErr && profile) {
              view.claimantEmail = profile.email;
              view.claimantName = profile.full_name;
              view.claimantPhone = profile.phone;
            }
          }

          return view;
        })
      );

      setClaims(hydrated);
    } catch (err: any) {
      console.error("Fetch claims error:", err);
      setErrorMsg(err.message || "Failed to fetch claims");
    } finally {
      setLoading(false);
    }
  }

  // 🟢 Update claim status
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

      // Update UI
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

  // 💨 ESC to close modals
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

  if (loading) return <div className="text-center py-16 text-gray-400">Loading claims...</div>;

  if (errorMsg)
    return (
      <div className="text-center py-16 text-red-400">
        Failed to load claims: {errorMsg}
        <br />
        <button
          onClick={fetchAndHydrateClaims}
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
                  {c.itemName ?? "—"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {c.itemCampus ?? "—"}
                </td>
                <td className="px-4 py-3 text-sm">
                  {c.claimantName
                    ? `${c.claimantName} (${c.claimantEmail})`
                    : c.claimantEmail ?? "—"}
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

      {/* 🪟 Claim Details Modal */}
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

            <h2 className="text-xl font-bold mb-4 text-ubGold">
              Claim Details
            </h2>

            {selectedClaim.itemImage && (
              <img
                src={selectedClaim.itemImage}
                alt="Item Image"
                onClick={() => setZoomImage(selectedClaim.itemImage!)}
                className="w-full h-48 object-cover rounded-lg mb-4 cursor-zoom-in hover:opacity-90 transition"
              />
            )}

            <div className="space-y-2 text-gray-700 dark:text-gray-300">
              <p>
                <strong>Item:</strong> {selectedClaim.itemName ?? "—"}
              </p>
              <p>
                <strong>Campus:</strong> {selectedClaim.itemCampus ?? "—"}
              </p>
              <p>
                <strong>Description:</strong> {selectedClaim.itemDesc ?? "—"}
              </p>
              <hr className="my-2 border-gray-600" />
              <p>
                <strong>Claimant:</strong>{" "}
                {selectedClaim.claimantName ?? "—"}
              </p>
              <p>
                <strong>Email:</strong> {selectedClaim.claimantEmail ?? "—"}
              </p>
              <p>
                <strong>Phone:</strong> {selectedClaim.claimantPhone ?? "—"}
              </p>
              <p>
                <strong>Message:</strong> {selectedClaim.message ?? "—"}
              </p>
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

      {/* 🔍 Image Lightbox */}
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
