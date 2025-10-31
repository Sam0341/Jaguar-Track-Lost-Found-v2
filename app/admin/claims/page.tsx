"use client";

import { useEffect, useState } from "react";

export default function AdminClaimsPage() {
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchClaims() {
      try {
        const res = await fetch("/api/admin/claims");
        if (!res.ok) throw new Error("Failed to fetch claims");
        const data = await res.json();
        setClaims(data.claims || []);
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchClaims();
  }, []);

  if (loading) {
    return <div className="text-center py-10 text-gray-400">Loading claims...</div>;
  }

  if (claims.length === 0) {
    return <div className="text-center py-10 text-gray-400">No claims found.</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-ubGold mb-6">Claims Management</h1>
      <div className="overflow-x-auto rounded-lg shadow border border-gray-700">
        <table className="min-w-full text-sm text-gray-200">
          <thead className="bg-gray-800 text-gray-100 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Item</th>
              <th className="px-4 py-3 text-left">Claimed By</th>
              <th className="px-4 py-3 text-left">Message</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Date</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((claim) => (
              <tr
                key={claim.id}
                className="border-b border-gray-700 hover:bg-gray-800/50 transition"
              >
                <td className="px-4 py-3">{claim.items?.name || "Unknown"}</td>
                <td className="px-4 py-3">{claim.profiles?.email || "N/A"}</td>
                <td className="px-4 py-3 max-w-xs truncate">{claim.message}</td>
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
                    {claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {new Date(claim.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
