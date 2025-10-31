"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AdminDashboard() {
  const [tab, setTab] = useState<"items" | "claims">("items");
  const [items, setItems] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingClaims, setLoadingClaims] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  // 🔑 Fetch current admin
  useEffect(() => {
    async function fetchAdmin() {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user) {
        setAdminEmail(data.user.email ?? null);
      }
    }
    fetchAdmin();
  }, []);

  // 🧩 Fetch Items directly from Supabase
  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    setLoadingItems(true);
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .order("reported_at", { ascending: false });
    if (!error) setItems(data || []);
    setLoadingItems(false);
  }

  // 🧾 Fetch Claims via API route
  useEffect(() => {
    async function fetchClaims() {
      try {
        const res = await fetch("/api/claims");
        if (!res.ok) throw new Error("Failed to fetch claims");

        const data = await res.json();
        setClaims(data || []);
      } catch (err) {
        console.error("❌ Fetch error:", err);
      } finally {
        setLoadingClaims(false);
      }
    }

    fetchClaims();
  }, []);

  // 📅 Format date
  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("en-BZ", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  // ⚙️ Handle Status Update
  async function handleUpdateStatus(status: string) {
    if (!selectedItem) return;
    setActionLoading(true);

    const { error: updateError } = await supabase
      .from("items")
      .update({ status })
      .eq("id", selectedItem.id);

    if (updateError) {
      alert("Error updating status: " + updateError.message);
      setActionLoading(false);
      return;
    }

    // ✅ Auto-create a claim when marked as Claimed
    if (status === "Claimed" && adminEmail) {
      await handleAutoClaim(selectedItem.id);
    }

    alert(`Item marked as ${status}!`);
    setSelectedItem({ ...selectedItem, status });
    fetchItems();
    setActionLoading(false);
  }

  // 🧠 Auto Claim creation
  async function handleAutoClaim(itemId: string) {
    try {
      const { data: existingClaims, error: checkError } = await supabase
        .from("claims")
        .select("id")
        .eq("item_id", itemId);

      if (checkError) {
        console.warn("Claim check error:", checkError);
        return;
      }

      if (existingClaims && existingClaims.length > 0) {
        console.log("Claim already exists for item:", itemId);
        return;
      }

      const { data: adminUser } = await supabase.auth.getUser();
      const adminId = adminUser?.user?.id || null;

      const { error: insertError } = await supabase.from("claims").insert([
        {
          item_id: itemId,
          message: "Automatically created by admin marking this item as claimed.",
          status: "Approved",
          claimed_by: adminId,
        },
      ]);

      if (insertError) {
        console.error("Error creating claim:", insertError);
      } else {
        console.log("✅ Auto claim created for item:", itemId);
      }
    } catch (err) {
      console.error("Auto claim creation failed:", err);
    }
  }

  // 🗑️ Handle Delete
  async function handleDelete() {
    if (!selectedItem) return;
    if (!confirm("Are you sure you want to delete this report?")) return;

    setActionLoading(true);
    const { error } = await supabase
      .from("items")
      .delete()
      .eq("id", selectedItem.id);

    if (error) alert("Error deleting item: " + error.message);
    else {
      alert("Item deleted successfully!");
      setSelectedItem(null);
      fetchItems();
    }
    setActionLoading(false);
  }

  // ⌨️ Close modal with Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedItem(null);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-ubGold mb-6">Admin Dashboard</h1>

      {/* 🧭 Tabs */}
      <div className="flex gap-3 mb-8">
        <button
          onClick={() => setTab("items")}
          className={`px-4 py-2 rounded-md font-semibold transition ${
            tab === "items"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
          }`}
        >
          📦 Reported Items
        </button>
        <button
          onClick={() => setTab("claims")}
          className={`px-4 py-2 rounded-md font-semibold transition ${
            tab === "claims"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
          }`}
        >
          🧾 Claims Management
        </button>
      </div>

      {/* 🧱 Tab Content */}
      {tab === "items" ? (
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
            Reported Items ({items.length})
          </h2>

          {loadingItems ? (
            <p className="text-gray-500">Loading reported items...</p>
          ) : items.length === 0 ? (
            <p className="text-gray-400">No reported items found.</p>
          ) : (
            <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow-md">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Campus</th>
                    <th className="px-4 py-3">Reporter</th>
                    <th className="px-4 py-3">Reported At</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className="cursor-pointer border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                    >
                      <td className="px-4 py-3 font-medium">{item.name}</td>
                      <td className="px-4 py-3">{item.status}</td>
                      <td className="px-4 py-3">{item.campus}</td>
                      <td className="px-4 py-3">{item.reporter_name || "N/A"}</td>
                      <td className="px-4 py-3">
                        {item.reported_at ? formatDate(item.reported_at) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section>
          <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
            Claims Management ({claims.length})
          </h2>

          {loadingClaims ? (
            <p className="text-gray-500">Loading claims...</p>
          ) : claims.length === 0 ? (
            <p className="text-gray-400">No claims found yet.</p>
          ) : (
            <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow-md">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                  <tr>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">Campus</th>
                    <th className="px-4 py-3">Claimed By</th>
                    <th className="px-4 py-3">Message</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((claim) => (
                    <tr
                      key={claim.id}
                      className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <td className="px-4 py-3 font-medium">
                        {claim.items?.name || "N/A"}
                      </td>
                      <td className="px-4 py-3">{claim.items?.campus || "—"}</td>
                      <td className="px-4 py-3">
                        {claim.claimed_by?.email || "Unknown"}
                      </td>
                      <td className="px-4 py-3">{claim.message || "—"}</td>
                      <td className="px-4 py-3 font-semibold">{claim.status}</td>
                      <td className="px-4 py-3">
                        {formatDate(claim.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* 🪟 Report Detail Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/60 z-50"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 w-full max-w-lg relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ✖ Close button */}
            <button
              onClick={() => setSelectedItem(null)}
              className="absolute top-2 right-3 text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 text-lg"
            >
              ✕
            </button>

            <h3 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
              Report Details
            </h3>

            <div className="space-y-2 text-gray-700 dark:text-gray-300">
              <p>
                <strong>Item Name:</strong> {selectedItem.name}
              </p>
              <p>
                <strong>Status:</strong> {selectedItem.status}
              </p>
              <p>
                <strong>Category:</strong> {selectedItem.category || "—"}
              </p>
              <p>
                <strong>Campus:</strong> {selectedItem.campus}
              </p>
              <p>
                <strong>Location:</strong> {selectedItem.location || "—"}
              </p>
              <p>
                <strong>Reporter Name:</strong>{" "}
                {selectedItem.reporter_name || "—"}
              </p>
              <p>
                <strong>Reporter Email:</strong>{" "}
                {selectedItem.reporter_email || "—"}
              </p>
              <p>
                <strong>Description:</strong>{" "}
                {selectedItem.description || "—"}
              </p>
              <p>
                <strong>Reported On:</strong>{" "}
                {selectedItem.reported_at
                  ? new Date(selectedItem.reported_at).toLocaleString("en-BZ")
                  : "—"}
              </p>
            </div>

            {/* 🧭 Action Buttons */}
            <div className="mt-6 flex flex-wrap gap-3 justify-between">
              <button
                onClick={() => handleUpdateStatus("Claimed")}
                disabled={actionLoading}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition disabled:opacity-50"
              >
                Mark as Claimed
              </button>

              <button
                onClick={() => handleUpdateStatus("Found")}
                disabled={actionLoading}
                className="bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600 transition disabled:opacity-50"
              >
                Mark as Found
              </button>

              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition disabled:opacity-50"
              >
                Delete
              </button>
            </div>

            {/* 🟦 Bottom Close Button */}
            <div className="mt-6 text-right">
              <button
                onClick={() => setSelectedItem(null)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
