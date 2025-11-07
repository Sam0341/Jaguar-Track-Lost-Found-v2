"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ItemData = {
  id: string;
  name: string;
  campus: string;
  description: string;
  image?: string | null;
  reporter_email?: string | null;
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
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const shouldSendDevHeader = () =>
    typeof window !== "undefined" &&
    window.location.hostname.includes("localhost");

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

      const res = await fetch("/api/claims", {
        method: "GET",
        credentials: "include",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(shouldSendDevHeader() ? { "x-dev-admin": "true" } : {}),
        },
      });

      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      await res.json();

      const { data, error } = await supabase
        .from("claims")
        .select(`
          id,
          message,
          status,
          created_at,
          item_id,
          claimed_by,
          items:item_id (
            id,
            name,
            campus,
            description,
            image,
            reporter_email
          ),
          profiles:claimed_by (
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

  // 🟢 Approve / Reject claim + show animated toast
  async function updateClaimStatus(
    claimId: string,
    status: "approved" | "rejected"
  ) {
    setActionLoading(claimId);
    setErrorMsg(null);
    setToastMsg(null);

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

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || `${res.statusText}`);

      setClaims((prev) =>
        prev.map((c) => (c.id === claimId ? { ...c, status } : c))
      );

      const msg = result.message?.includes("Email sent")
        ? `📧 Claim ${status.toUpperCase()} — Email successfully sent!`
        : `✅ Claim ${status.toUpperCase()} — Updated successfully.`;

      showToastMessage(msg, result.message?.includes("Email") ? "success" : "info");

      if (selectedClaim?.id === claimId)
        setSelectedClaim({ ...selectedClaim, status });
    } catch (err: any) {
      console.error("Update error:", err);
      showToastMessage("❌ Failed to update claim: " + err.message, "error");
    } finally {
      setActionLoading(null);
    }
  }

  // ✨ Toast Animation Handler
  function showToastMessage(msg: string, type: "success" | "error" | "info" = "info") {
    setToastMsg(msg);
    setShowToast(true);

    // Auto-hide after 4 seconds
    setTimeout(() => setShowToast(false), 4000);
  }

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
    <div className="p-6 max-w-7xl mx-auto relative">
      <h1 className="text-3xl font-bold text-ubGold mb-6">Claims Management</h1>

      {/* ✨ Toast Notification */}
      <div
        className={`fixed top-6 right-6 z-[9999] transition-all duration-500 transform ${
          showToast
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-10 pointer-events-none"
        }`}
      >
        {toastMsg && (
          <div
            className={`px-5 py-3 rounded-lg shadow-lg font-medium text-sm ${
              toastMsg.includes("❌")
                ? "bg-red-600 text-white"
                : toastMsg.includes("📧") || toastMsg.includes("✅")
                ? "bg-green-600 text-white"
                : "bg-blue-600 text-white"
            }`}
          >
            {toastMsg}
          </div>
        )}
      </div>

      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-700">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-700 text-left text-gray-800 dark:text-gray-200">
            <tr>
              <th className="px-5 py-3 font-semibold">Item</th>
              <th className="px-5 py-3 font-semibold">Campus</th>
              <th className="px-5 py-3 font-semibold">Claimant</th>
              <th className="px-5 py-3 font-semibold">Claimant Email</th>
              <th className="px-5 py-3 font-semibold">Reporter Email</th>
              <th className="px-5 py-3 font-semibold">Message</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold">Date</th>
              <th className="px-5 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr
                key={c.id}
                onClick={() => setSelectedClaim(c)}
                className="border-b dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition"
              >
                <td className="px-5 py-3 font-semibold text-ubGold">
                  {c.items?.name ?? "—"}
                </td>
                <td className="px-5 py-3 text-gray-400">{c.items?.campus ?? "—"}</td>
                <td className="px-5 py-3">{c.profiles?.full_name ?? "—"}</td>
                <td className="px-5 py-3">{c.profiles?.email ?? "—"}</td>
                <td className="px-5 py-3 text-gray-300">
                  {c.items?.reporter_email ?? "—"}
                </td>
                <td className="px-5 py-3 max-w-xs truncate text-gray-300">
                  {c.message ?? "—"}
                </td>
                <td className="px-5 py-3">
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
                <td className="px-5 py-3 text-gray-400">
                  {c.created_at
                    ? new Date(c.created_at).toLocaleString("en-BZ")
                    : "—"}
                </td>
                <td className="px-5 py-3 space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateClaimStatus(c.id, "approved");
                    }}
                    disabled={actionLoading !== null}
                    className="px-3 py-1 rounded-md bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50 transition"
                  >
                    Approve
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateClaimStatus(c.id, "rejected");
                    }}
                    disabled={actionLoading !== null}
                    className="px-3 py-1 rounded-md bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 transition"
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 🔍 Zoomed Image */}
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
