"use client";
import { useEffect, useState } from "react";
import { toast, Toaster } from "react-hot-toast";

export default function AdminClaimsPage() {
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadClaims() {
      try {
        const res = await fetch("/api/claims", {
          credentials: "include", // ✅ Send Supabase cookies with the request
        });
        const data = await res.json();

        if (res.ok && data.success) setClaims(data.claims);
        else console.error("Failed to load claims:", data.error);
      } catch (err) {
        console.error("Error loading claims:", err);
      } finally {
        setLoading(false);
      }
    }

    loadClaims();
  }, []);

  async function handleAction(id: string, action: "Approved" | "Rejected") {
    try {
      const res = await fetch(`/api/claims/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // ✅ also include cookies here
        body: JSON.stringify({ status: action }),
      });

      const result = await res.json();

      if (res.ok && result.success) {
        toast.success(`Claim ${action}`);
        setClaims((prev) =>
          prev.map((c) => (c.id === id ? { ...c, status: action } : c))
        );
      } else {
        toast.error(result.error || "Action failed");
      }
    } catch (err) {
      console.error("Error updating claim:", err);
      toast.error("Network error");
    }
  }

  if (loading)
    return <div className="text-center text-blue-600 mt-10">Loading claims...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <Toaster position="bottom-right" />
      <h1 className="text-3xl font-bold text-ubBlue dark:text-ubGold mb-6 text-center">
        Claim Management Panel
      </h1>

      <table className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
        <thead className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
          <tr>
            <th className="p-3 text-left">Item ID</th>
            <th className="p-3 text-left">Claimed By</th>
            <th className="p-3 text-left">Message</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {claims.map((c) => (
            <tr key={c.id} className="border-t dark:border-gray-700">
              <td className="p-3">{c.item_id}</td>
              <td className="p-3">{c.claimed_by}</td>
              <td className="p-3">{c.message}</td>
              <td className="p-3 font-semibold">{c.status}</td>
              <td className="p-3 flex gap-2">
                <button
                  onClick={() => handleAction(c.id, "Approved")}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleAction(c.id, "Rejected")}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                >
                  Reject
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
