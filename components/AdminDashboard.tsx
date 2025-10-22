"use client";

import { useEffect, useState } from "react";

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  useEffect(() => {
    async function fetchAdminData() {
      try {
        const res = await fetch("/api/admin/items");
        const json = await res.json();
        if (!json.success) throw new Error(json.error || "Failed to load data");
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchAdminData();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    try {
      const res = await fetch(`/api/admin/items/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        alert("✅ Item deleted successfully");
        setData((prev: any) => ({
          ...prev,
          items: prev.items.filter((i: any) => i.id !== id),
        }));
      } else alert("❌ Delete failed: " + json.error);
    } catch {
      alert("Something went wrong while deleting.");
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/items/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        setData((prev: any) => ({
          ...prev,
          items: prev.items.map((i: any) =>
            i.id === id ? { ...i, status: newStatus } : i
          ),
        }));
      } else {
        alert("❌ Failed to update status");
      }
    } catch {
      alert("Error updating status");
    }
  };

  if (loading) return <div className="p-6 text-center">Loading dashboard...</div>;
  if (error) return <div className="text-red-500 text-center">{error}</div>;

  const { items = [] } = data;

  return (
    <div className="relative max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-ubBlue dark:text-ubGold">
          Admin Dashboard
        </h1>
        <span className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 shadow-sm">
          ⭐ Admin Mode Active
        </span>
      </div>

      {/* Items Table */}
      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-3">
          📦 Reported Items ({items.length})
        </h2>

        <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700">
          <table className="w-full border-collapse">
            <thead className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
              <tr>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Campus</th>
                <th className="p-3 text-left">Reporter</th>
                <th className="p-3 text-left">Reported At</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => (
                <tr
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className="border-t dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-900 cursor-pointer transition"
                >
                  <td className="p-3">{item.name}</td>

                  {/* Status Dropdown */}
                  <td className="p-3">
                    <select
                      value={item.status}
                      onChange={(e) =>
                        handleStatusChange(item.id, e.target.value)
                      }
                      className="bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-400"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="Lost">Lost</option>
                      <option value="Found">Found</option>
                      <option value="Claimed">Claimed</option>
                    </select>
                  </td>

                  <td className="p-3">{item.campus}</td>
                  <td className="p-3">
                    {item.reporter_name || item.reporter_email}
                  </td>
                  <td className="p-3">
                    {new Date(item.reported_at).toLocaleDateString()}
                  </td>

                  <td className="p-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id);
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 🧾 Report Details Card */}
      {selectedItem && (
        <div className="fixed inset-0 flex items-center justify-center z-[2100]">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedItem(null)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl p-6 w-[90%] max-w-md shadow-2xl z-[2200]">
            <h3 className="text-xl font-semibold border-b border-gray-200 dark:border-gray-700 pb-2 mb-3">
              🧾 Report Details
            </h3>
            <div className="space-y-2 text-sm sm:text-base">
              <p><strong>Item Name:</strong> {selectedItem.name}</p>
              <p><strong>Status:</strong> {selectedItem.status}</p>
              <p><strong>Category:</strong> {selectedItem.category || "N/A"}</p>
              <p><strong>Campus:</strong> {selectedItem.campus}</p>
              <p><strong>Location:</strong> {selectedItem.location || "N/A"}</p>
              <p><strong>Reporter Name:</strong> {selectedItem.reporter_name || "N/A"}</p>
              <p><strong>Reporter Email:</strong> {selectedItem.reporter_email || "N/A"}</p>
              <p><strong>Description:</strong> {selectedItem.description || "No description"}</p>
              <p><strong>Reported On:</strong> {new Date(selectedItem.reported_at).toLocaleString()}</p>
            </div>
            <button
              onClick={() => setSelectedItem(null)}
              className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
