"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { addLog } from "@/lib/logs"; // ✅ log helper

type Item = {
  id: string;
  name: string;
  status: string;
  campus: string;
  description?: string;
  image?: string;
  reporter_name?: string;
  reporter_email?: string;
  reported_at?: string;
};

export default function AdminDashboard() {
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [campusFilter, setCampusFilter] = useState("All");
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  useEffect(() => {
    fetchItems();
  }, []);

  // 🧠 Fetch all items
  async function fetchItems() {
    setLoading(true);
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .order("reported_at", { ascending: false });

    if (error) {
      console.error("Error fetching items:", error);
    } else {
      setItems(data || []);
      setFilteredItems(data || []);
    }
    setLoading(false);
  }

  // 🔍 Filter + Search
  useEffect(() => {
    let filtered = [...items];

    if (statusFilter !== "All") {
      filtered = filtered.filter((item) => item.status === statusFilter);
    }

    if (campusFilter !== "All") {
      filtered = filtered.filter((item) => item.campus === campusFilter);
    }

    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(term) ||
          (item.reporter_name?.toLowerCase() || "").includes(term) ||
          (item.reporter_email?.toLowerCase() || "").includes(term)
      );
    }

    setFilteredItems(filtered);
  }, [searchTerm, statusFilter, campusFilter, items]);

  const formatDate = (date?: string) =>
    date
      ? new Date(date).toLocaleDateString("en-BZ", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "—";

  // 🟢 Mark as Claimed + log
  async function markAsClaimed(itemId: string) {
    const confirmed = window.confirm("Mark this item as claimed?");
    if (!confirmed) return;

    // who did it?
    const { data: authData } = await supabase.auth.getUser();
    const admin = authData?.user;

    const { error } = await supabase
      .from("items")
      .update({ status: "Claimed" })
      .eq("id", itemId);

    if (error) {
      showToast("Failed to update item", "error");
    } else {
      // 🔥 write log entry
      await addLog("item_claimed", itemId, admin?.id || "unknown");

      showToast("✅ Item marked as claimed!", "success");
      setShowModal(false);
      fetchItems();
    }
  }

  // 🔴 Delete item + log
  async function deleteItem(itemId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this item?"
    );
    if (!confirmed) return;

    // who did it?
    const { data: authData } = await supabase.auth.getUser();
    const admin = authData?.user;

    const { error } = await supabase.from("items").delete().eq("id", itemId);

    if (error) {
      showToast("❌ Failed to delete item", "error");
    } else {
      // 🔥 write log entry
      await addLog("item_deleted", itemId, admin?.id || "unknown");

      showToast("🗑️ Item deleted successfully!", "success");
      setShowModal(false);
      fetchItems();
    }
  }

  // 🌈 Toast message
  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto relative">
      <h1 className="text-3xl font-bold text-ubGold mb-6 text-center sm:text-left">
        Admin Dashboard
      </h1>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-lg shadow-lg text-white ${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          } animate-fade-in`}
        >
          {toast.message}
        </div>
      )}

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by name or reporter..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-ubGold"
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
        >
          <option>All</option>
          <option>Lost</option>
          <option>Found</option>
          <option>Claimed</option>
        </select>

        <select
          value={campusFilter}
          onChange={(e) => setCampusFilter(e.target.value)}
          className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
        >
          <option>All</option>
          <option>Belmopan (Central Campus)</option>
          <option>Central Farm</option>
          <option>Punta Gorda</option>
          <option>Belize City Campus</option>
        </select>
      </div>

      {/* Responsive Table / Cards */}
      {loading ? (
        <p className="text-gray-500 text-center">Loading items...</p>
      ) : filteredItems.length === 0 ? (
        <p className="text-gray-400 text-center">
          No items match your search.
        </p>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden sm:block overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Campus</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Reporter</th>
                  <th className="px-4 py-3">Reported At</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => {
                      setSelectedItem(item);
                      setShowModal(true);
                    }}
                  >
                    <td className="px-4 py-3 font-medium text-ubGold">
                      {item.name}
                    </td>
                    <td className="px-4 py-3">{item.campus}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          item.status === "Claimed"
                            ? "bg-green-600 text-white"
                            : item.status === "Lost"
                            ? "bg-yellow-500 text-white"
                            : "bg-blue-600 text-white"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {item.reporter_name || "Unknown"}
                    </td>
                    <td className="px-4 py-3">{formatDate(item.reported_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="px-3 py-1 rounded-md bg-gray-700 text-white hover:bg-gray-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItem(item);
                          setShowModal(true);
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="sm:hidden space-y-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setSelectedItem(item);
                  setShowModal(true);
                }}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-4"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-ubGold">
                    {item.name}
                  </h3>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      item.status === "Claimed"
                        ? "bg-green-600 text-white"
                        : item.status === "Lost"
                        ? "bg-yellow-500 text-white"
                        : "bg-blue-600 text-white"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-1">{item.campus}</p>
                <p className="text-sm mt-1">
                  Reporter:{" "}
                  <span className="text-gray-300">
                    {item.reporter_name || "Unknown"}
                  </span>
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  {formatDate(item.reported_at)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 🪟 ITEM DETAILS MODAL */}
      {showModal && selectedItem && (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 px-4">
          <div className="bg-gray-900 text-white rounded-lg max-w-lg w-full shadow-lg border border-gray-700 p-6 relative animate-fade-in">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-3 right-4 text-gray-400 hover:text-white text-xl"
            >
              ✕
            </button>

            {selectedItem.image && (
              <img
                src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/item-photos/${selectedItem.image}`}
                alt={selectedItem.name}
                className="w-full h-56 object-cover rounded-lg mb-4 border border-gray-700"
              />
            )}

            <h2 className="text-2xl font-semibold text-ubGold mb-2">
              {selectedItem.name}
            </h2>
            <p className="text-sm text-gray-400 mb-1">
              <strong>Campus:</strong> {selectedItem.campus}
            </p>
            <p className="text-sm text-gray-400 mb-1">
              <strong>Status:</strong> {selectedItem.status}
            </p>
            <p className="text-sm text-gray-400 mb-1">
              <strong>Reporter:</strong>{" "}
              {selectedItem.reporter_name || "Unknown"}
            </p>
            <p className="text-sm text-gray-400 mb-1">
              <strong>Email:</strong> {selectedItem.reporter_email || "N/A"}
            </p>
            <p className="text-sm text-gray-400 mb-1">
              <strong>Reported At:</strong>{" "}
              {formatDate(selectedItem.reported_at)}
            </p>
            {selectedItem.description && (
              <p className="text-sm text-gray-300 mt-2 border-t border-gray-700 pt-2">
                <strong>Description:</strong> {selectedItem.description}
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-3 mt-5">
              <button
                onClick={() => markAsClaimed(selectedItem.id)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white"
              >
                Mark as Claimed
              </button>
              <button
                onClick={() => deleteItem(selectedItem.id)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white"
              >
                Delete
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg text-white"
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
