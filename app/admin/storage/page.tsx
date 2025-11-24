"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Item = {
  id: string;
  name: string;
  category: string | null;
  campus: string | null;
  location: string | null;
  status: string;
  description?: string;
  image?: string;
  reported_at?: string;
  reporter_name?: string;
  dropoff_location?: string;
};

export default function StoragePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [campusFilter, setCampusFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [storageFilter, setStorageFilter] = useState("All");

  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [newStorage, setNewStorage] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(
    null
  );

  const [page, setPage] = useState(1);
  const PER_PAGE = 8;

  const [stats, setStats] = useState({
    storages: 0,
    totalStorageItems: 0,
  });

  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    setLoading(true);

    const { data, error } = await supabase
      .from("items")
      .select("*")
      .order("reported_at", { ascending: false });

    if (!error && data) {
      setItems(data);
      setFilteredItems(data);
      calculateStats(data);
    }

    setLoading(false);
  }

  function calculateStats(data: Item[]) {
    const storages = new Set(data.map((i) => i.location || "N/A"));
    const total = data.length;

    setStats({
      storages: storages.size,
      totalStorageItems: total,
    });
  }

  // Filters
  useEffect(() => {
    let data = [...items];

    if (campusFilter !== "All")
      data = data.filter((i) => i.campus === campusFilter);

    if (statusFilter !== "All")
      data = data.filter((i) => i.status === statusFilter);

    if (storageFilter !== "All")
      data = data.filter((i) => (i.location || "N/A") === storageFilter);

    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      data = data.filter(
        (i) =>
          i.name.toLowerCase().includes(term) ||
          (i.location || "").toLowerCase().includes(term) ||
          (i.campus || "").toLowerCase().includes(term)
      );
    }

    setFilteredItems(data);
  }, [searchTerm, campusFilter, statusFilter, storageFilter, items]);

  async function updateStorage() {
    if (!selectedItem) return;

    const user = (await supabase.auth.getUser()).data.user;

    const { error } = await supabase
      .from("items")
      .update({ location: newStorage })
      .eq("id", selectedItem.id);

    if (!error) {
      await supabase.from("logs").insert({
        action: "storage_updated",
        item_id: selectedItem.id,
        performed_by: user?.id || null,
      });

      showToast("Storage updated!", "success");
      setShowModal(false);
      fetchItems();
    } else {
      showToast("Failed to update storage!", "error");
    }
  }

  async function markAsClaimed(id: string) {
    const user = (await supabase.auth.getUser()).data.user;

    const { error } = await supabase
      .from("items")
      .update({ status: "Claimed" })
      .eq("id", id);

    if (!error) {
      await supabase.from("logs").insert({
        action: "item_claimed",
        item_id: id,
        performed_by: user?.id,
      });

      showToast("Item marked as claimed!", "success");
      fetchItems();
    } else {
      showToast("Update failed!", "error");
    }
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this item?")) return;

    const user = (await supabase.auth.getUser()).data.user;

    const { error } = await supabase.from("items").delete().eq("id", id);

    if (!error) {
      await supabase.from("logs").insert({
        action: "item_deleted",
        item_id: id,
        performed_by: user?.id,
      });

      showToast("Item deleted!", "success");
      fetchItems();
    } else {
      showToast("Delete failed!", "error");
    }
  }

  const storageLocations = Array.from(
    new Set(items.map((i) => i.location || "N/A"))
  );

  const campuses = Array.from(new Set(items.map((i) => i.campus)));

  const showToast = (msg: string, type: string) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const totalPages = Math.ceil(filteredItems.length / PER_PAGE);

  const paginatedItems = filteredItems.slice(
    (page - 1) * PER_PAGE,
    page * PER_PAGE
  );

  function downloadCSV() {
    const headers = ["ID,Name,Category,Campus,Storage,Status,Reported_At"];
    const rows = items.map(
      (item) =>
        `${item.id},"${item.name}",${item.category || ""},${
          item.campus || ""
        },${item.location || "N/A"},${item.status},${item.reported_at || ""}`
    );
    const csvContent = [...headers, ...rows].join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "storage_report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-ubGold mb-6">
        📦 Storage Inventory
      </h1>

      {/* NEW STATS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-4 text-center shadow">
          <p className="text-2xl font-bold text-ubBlue dark:text-ubGold">
            {stats.totalStorageItems}
          </p>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Total Items in Storage
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-4 text-center shadow">
          <p className="text-2xl font-bold text-ubBlue dark:text-ubGold">
            {stats.storages}
          </p>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Storage Rooms
          </p>
        </div>
      </div>

      {/* CSV BUTTON */}
      <button
        onClick={downloadCSV}
        className="mb-6 px-4 py-2 bg-ubGold text-black font-semibold rounded shadow hover:bg-yellow-400"
      >
        ⬇ Download Storage Report (CSV)
      </button>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 px-4 py-2 rounded shadow-lg text-white ${
            toast.type === "success"
              ? "bg-green-600"
              : "bg-red-600"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Filters */}
      <div className="grid sm:grid-cols-4 gap-4 mb-6">
        <input
          type="text"
          placeholder="Search items…"
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-400 dark:border-gray-700 rounded-lg text-black dark:text-white"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <select
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-400 dark:border-gray-700 rounded-lg text-black dark:text-white"
          value={campusFilter}
          onChange={(e) => setCampusFilter(e.target.value)}
        >
          <option>All</option>
          {campuses.map((camp) => (
            <option key={camp}>{camp}</option>
          ))}
        </select>

        <select
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-400 dark:border-gray-700 rounded-lg text-black dark:text-white"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option>All</option>
          <option>Lost</option>
          <option>Found</option>
          <option>Claimed</option>
        </select>

        <select
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-400 dark:border-gray-700 rounded-lg text-black dark:text-white"
          value={storageFilter}
          onChange={(e) => setStorageFilter(e.target.value)}
        >
          <option>All</option>
          {storageLocations.map((loc) => (
            <option key={loc}>{loc}</option>
          ))}
        </select>
      </div>

      {/* Items grid */}
      {loading ? (
        <p className="text-gray-500 dark:text-gray-300 text-center py-20">
          Loading storage…
        </p>
      ) : paginatedItems.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400 text-center">
          No items found.
        </p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedItems.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-4 shadow hover:border-ubGold cursor-pointer"
              onClick={() => {
                setSelectedItem(item);
                setNewStorage(item.location || "");
                setShowModal(true);
              }}
            >
              {item.image && (
                <img
                  src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/item-photos/${item.image}`}
                  className="w-full h-40 object-cover rounded mb-3"
                />
              )}

              <h2 className="text-lg font-bold text-ubBlue dark:text-ubGold">
                {item.name}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {item.category}
              </p>

              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Drop-Off:{" "}
                <span className="text-gray-700 dark:text-gray-300">
                  {item.dropoff_location || "N/A"}
                </span>
              </p>

              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                Stored At:{" "}
                <span className="text-gray-700 dark:text-gray-300">
                  {item.location || "N/A"}
                </span>
              </p>

              <span
                className={`inline-block mt-2 px-2 py-1 rounded text-xs font-semibold ${
                  item.status === "Claimed"
                    ? "bg-green-600 text-white"
                    : item.status === "Lost"
                    ? "bg-yellow-600 text-white"
                    : "bg-blue-600 text-white"
                }`}
              >
                {item.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              className={`px-3 py-1 rounded ${
                page === i + 1
                  ? "bg-ubGold text-black"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700"
              }`}
              onClick={() => setPage(i + 1)}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && selectedItem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center px-4 z-50">
          <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-6 max-w-lg w-full relative">
            <button
              className="absolute top-3 right-3 text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white"
              onClick={() => setShowModal(false)}
            >
              ✕
            </button>

            <h2 className="text-2xl font-bold text-ubBlue dark:text-ubGold mb-1">
              {selectedItem.name}
            </h2>

            <p className="text-gray-700 dark:text-gray-400 mb-4">
              Category: {selectedItem.category || "Unknown"} • Campus:{" "}
              {selectedItem.campus || "Unknown"}
            </p>

            <p className="text-gray-800 dark:text-gray-300 mb-1">
              Drop-Off Location:
            </p>
            <input
              className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-gray-900 dark:text-gray-300"
              value={selectedItem.dropoff_location || "N/A"}
              disabled
            />

            <p className="mt-4 mb-1 text-gray-800 dark:text-gray-300">
              Current Storage:
            </p>
            <input
              className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-gray-900 dark:text-gray-300"
              value={selectedItem.location || "N/A"}
              disabled
            />

            <p className="mt-4 mb-1 text-gray-800 dark:text-gray-300">
              New Storage Location:
            </p>

            <select
              className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-gray-900 dark:text-gray-300"
              value={newStorage}
              onChange={(e) => setNewStorage(e.target.value)}
            >
              {storageLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>

            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={updateStorage}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
              >
                Update Storage
              </button>

              <button
                onClick={() => markAsClaimed(selectedItem.id)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
              >
                Mark as Claimed
              </button>

              <button
                onClick={() => deleteItem(selectedItem.id)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
