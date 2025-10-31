"use client";

import { useEffect, useState } from "react";

export default function AdminClaimsPage() {
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // 🧩 Fetch all claims
  async function fetchClaims() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/claims", {
        method: "GET",
        credentials: "include", // ✅ Send Supabase session cookies
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch claims (${res.status})`);
      }

      const data = await res.json();
      setClaims(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("❌ Fetch error:", err);
      setError(err.message || "Failed to load claims");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchClaims();
  }, []);

  // 🧠 Approve or reject claim
  async function handleStatusChange(claimId: string, status: string) {
    try {
      setRefreshing(true);
      const res = await fetch("/api/claims", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim_id: claimId, status }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update claim");

      alert(data.message || `Claim ${status} successfully!`);
      await fetchClaims(); // refresh table
    } catch (err: any) {
      alert("⚠️ " + err.message);
    } finally {
      setRefreshing(false);
    }
  }

  // 🗓️ Format date
  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("en-BZ", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  // 🔄 Loading state
  if (loading) {
    return (
      <div className="text-center py-10 text-gray-400">
        Loading claims...
      </div>
    );
  }

  // ⚠️ Error state
  if (error) {
    return (
      <div className="text-center py-10 text-red-400">
        {error}
        <button
          onClick={fetchClaims}
          className="block mx-auto mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
        >
          Retry
        </button>
      </div>
    );
  }

  // 🧾 No data
  if (claims.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        No claims found.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-ubGold mb-6">
        Claims Management
      </h1>

      <div className="overflow-x-auto rounded-lg shadow border border-gray-700 bg-gray-900">
        <table className="min-w-full text-sm text-gray-200">
          <thead className="bg-gray-800 text-gray-100 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Item</th>
              <th className="px-4 py-3 text-left">Campus</th>
              <th className="px-4 py-3 text-left">Claimed By</th>
              <th className="px-4 py-3 text-left">Message</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((claim) => (
              <tr
                key={claim.id}
                className="border-b border-gray-700 hover:bg-gray-800/50 transition"
              >
                <td className="px-4 py-3 font-semibold">
                  {claim.items?.name || "Unknown"}
                </td>
                <td className="px-4 py-3">{claim.items?.campus || "—"}</td>
                <td className="px-4 py-3">
                  {claim.claimed_by?.email || "N/A"}
                </td>
                <td className="px-4 py-3 max-w-xs truncate">
                  {claim.message || "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      claim.status === "approved"
                        ? "bg-green-700 text-green-100"
                        : claim.status === "rejected"
                        ? "bg-red-700 text-red-100"
                        : "bg-yellow-600 text-yellow-100"
                    }`}
                  >
                    {claim.status.charAt(0).toUpperCase() +
                      claim.status.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {formatDate(claim.created_at)}
                </td>
                <td className="px-4 py-3 text-center">
                  {claim.status === "pending" ? (
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => handleStatusChange(claim.id, "approved")}
                        disabled={refreshing}
                        className="bg-green-600 hover:bg-green-700 px-3 py-1 text-xs rounded text-white"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleStatusChange(claim.id, "rejected")}
                        disabled={refreshing}
                        className="bg-red-600 hover:bg-red-700 px-3 py-1 text-xs rounded text-white"
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {refreshing && (
        <p className="text-center text-gray-400 mt-3 text-sm animate-pulse">
          Updating claim...
        </p>
      )}
    </div>
  );
}
