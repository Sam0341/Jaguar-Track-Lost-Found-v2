"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner"; // optional if you’re already using toast

interface Claim {
  id: string;
  item_id: string;
  item_name: string;
  claimer_name: string;
  claimer_email: string;
  message: string;
  status: string;
  created_at: string;
}

export default function AdminClaimsPanel() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClaims();
  }, []);

  async function fetchClaims() {
    setLoading(true);
    const { data, error } = await supabase
      .from("claims")
      .select(`
        id,
        item_id,
        message,
        status,
        created_at,
        items ( name ),
        profiles!claims_claimed_by_fkey ( full_name, email )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching claims:", error);
    } else {
      const formatted = data.map((c: any) => ({
        id: c.id,
        item_id: c.item_id,
        item_name: c.items?.name || "Unknown Item",
        claimer_name: c.profiles?.full_name || "Unknown User",
        claimer_email: c.profiles?.email || "Hidden",
        message: c.message || "",
        status: c.status,
        created_at: c.created_at,
      }));
      setClaims(formatted);
    }
    setLoading(false);
  }

  async function updateClaimStatus(id: string, newStatus: string, item_id: string) {
    const { error } = await supabase
      .from("claims")
      .update({ status: newStatus })
      .eq("id", id);

    if (error) {
      console.error("Update error:", error);
      toast?.error("Failed to update claim status");
      return;
    }

    // If approved, mark item as claimed
    if (newStatus === "Approved") {
      await supabase
        .from("items")
        .update({ status: "claimed" })
        .eq("id", item_id);
    }

    toast?.success(`Claim marked as ${newStatus}`);
    fetchClaims();
  }

  async function deleteClaim(id: string) {
    const { error } = await supabase.from("claims").delete().eq("id", id);
    if (error) {
      console.error("Delete error:", error);
      toast?.error("Failed to delete claim");
    } else {
      toast?.success("Claim deleted");
      setClaims((prev) => prev.filter((c) => c.id !== id));
    }
  }

  const filteredClaims = claims.filter(
    (claim) =>
      claim.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      claim.claimer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      claim.claimer_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-center mb-4 text-blue-700 dark:text-ubGold">
        Admin Claims Panel
      </h1>

      <input
        type="text"
        placeholder="Search by item name, claimer name, or email..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full p-3 border rounded-lg mb-6 focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-white"
      />

      {loading ? (
        <p className="text-center text-gray-500 dark:text-gray-400">Loading claims...</p>
      ) : filteredClaims.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400">No claims found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300 dark:border-gray-700 rounded-lg">
            <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200">
              <tr>
                <th className="p-3 text-left">Item</th>
                <th className="p-3 text-left">Claimer</th>
                <th className="p-3 text-left">Email</th>
                <th className="p-3 text-left">Message</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClaims.map((claim) => (
                <tr
                  key={claim.id}
                  className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <td className="p-3 font-medium">{claim.item_name}</td>
                  <td className="p-3">{claim.claimer_name}</td>
                  <td className="p-3 text-blue-600 dark:text-blue-400">
                    {claim.claimer_email}
                  </td>
                  <td className="p-3 text-sm">{claim.message || "-"}</td>
                  <td
                    className={`p-3 font-medium ${
                      claim.status === "Approved"
                        ? "text-green-600"
                        : claim.status === "Rejected"
                        ? "text-red-600"
                        : "text-yellow-600"
                    }`}
                  >
                    {claim.status}
                  </td>
                  <td className="p-3 text-sm text-gray-500">
                    {new Date(claim.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-center space-x-2">
                    {claim.status === "Pending" && (
                      <>
                        <button
                          onClick={() =>
                            updateClaimStatus(claim.id, "Approved", claim.item_id)
                          }
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() =>
                            updateClaimStatus(claim.id, "Rejected", claim.item_id)
                          }
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => deleteClaim(claim.id)}
                      className="text-red-500 hover:text-red-700 text-sm font-semibold"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
