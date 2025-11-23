"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// ------------------- ITEM TYPE -------------------
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
  dropoff_location?: string | null;   // ⭐ ADDED
};

export default function StoragePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [campusFilter, setCampusFilter] = useState("All");
  const [storageFilter, setStorageFilter] = useState("All");

  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [newStorage, setNewStorage] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const PER_PAGE = 8;

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    found: 0,
    campuses: 0,
    storages: 0,
  });

  // Preset UB Storage Rooms
  const UB_STORAGE_ROOMS = [
    "Security Storage Room",
    "Campus Storage A",
    "Campus Storage B",
    "Administration Office Shelf",
  ];

  useEffect(() => {
    fetchItems();
  }, []);

  // ------------------- FETCH ITEMS -------------------
  async function fetchItems() {
    setLoading(true);

    const { data, error } = await supabase
      .from("items")
      .select("*")
      .eq("status", "Found") // ⭐ ONLY SHOW FOUND ITEMS
      .order("reported_at", { ascending: false });

    if (!error && data) {
      setItems(data);
      setFilteredItems(data);
      calculateStats(data);
    }

    setLoading(false);
  }

  // ------------------- STATS -------------------
  function calculateStats(data: Item[]) {
    const campuses = new Set(data.map((i) => i.campus));
    const storages = new Set(data.map((i) => i.location || "N/A"));

    setStats({
      total: data.length,
      found: data.length,
      campuses: campuses.size,
      storages: storages.size,
    });
  }

  // ------------------- FILTERS -------------------
  useEffect(() => {
    let data = [...items];

    if (campusFilter !== "All")
      data = data.filter((i) => i.campus === campusFilter);

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
  }, [searchTerm, campusFilter, storageFilter, items]);

  // ------------------- STORAGE UPDATE -------------------
  async function updateStorage() {
    if (!selectedItem) return;

    const finalStorage =
      newStorage === "__custom" ? "" : newStorage; // empty until user types custom

    if (!finalStorage.trim()) {
      showToast("Please choose or enter a storage room.", "error");
      return;
    }

    const { error } = await supabase
      .from("items")
      .update({ location: finalStorage })
      .eq("id", selectedItem.id);

    if (!error) {
      showToast("Storage updated!", "success");
      setShowModal(false);
      fetchItems();
    } else {
      showToast("Failed to update storage!", "error");
    }
  }

  // ------------------- MARK AS CLAIMED -------------------
  async function markAsClaimed(id: string) {
    const { error } = await supabase
      .from("items")
      .update({ status: "Claimed" })
      .eq("id", id);

    if (!error) {
      showToast("Marked as claimed!", "success");
      fetchItems();
    } else {
      showToast("Update failed!", "error");
    }
  }

  // ------------------- DELETE -------------------
  async function deleteItem(id: string) {
    const yes = confirm("Delete this item?");
    if (!yes) return;

    const { error } = await supabase.from("items").delete().eq("id", id);

    if (!error) {
      showToast("Item deleted!", "success");
      fetchItems();
    } else {
      showToast("Delete failed!", "error");
    }
  }

  // ------------------- UTIL -------------------
  const campuses = Array.from(new Set(items.map((i) => i.campus)));
  const storageLocations = Array.from(
    new Set(items.map((i) => i.location || "N/A"))
  );

  const showToast = (msg: string, type: string) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / PER_PAGE);
  const paginatedItems = filteredItems.slice(
    (page - 1) * PER_PAGE,
    page * PER_PAGE
  );

  // ------------------- CSV DOWNLOAD -------------------
  function downloadCSV() {
    const headers = [
      "ID,Name,Category,Campus,Dropoff,Storage,Status,Reported_At",
    ];

    const rows = items.map(
      (item) =>
        `${item.id},"${item.name}",${item.category || ""},${item.campus || ""},"${
          item.dropoff_location || ""
        }",${item.location || "N/A"},${item.status},${item.reported_at || ""}`
    );

    const csvContent = [...headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "storage_report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ------------------- UI -------------------
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-ubGold mb-6">📦 Storage Inventory</h1>

      {/* Stats */}
      <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Found Items", value: stats.found },
          { label: "Campuses", value: stats.campuses },
          { label: "Storage Rooms", value: stats.storages },
          { label: "Total Records", value: stats.total },
        ].map((box, i) => (
          <div
            key={i}
            className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-center shadow"
          >
            <p className="text-2xl font-bold text-ubGold">{box.value}</p>
            <p className="text-gray-400 text-sm">{box.label}</p>
          </div>
        ))}
      </div>

      <button
        onClick={downloadCSV}
        className="mb-6 px-4 py-2 bg-ubGold text-black font-semibold rounded shadow hover:bg-yellow-400"
      >
        ⬇ Download Storage Report (CSV)
      </button>

      {toast && (
        <div
          className={`fixed top-5 right-5 px-4 py-2 rounded shadow-lg text-white ${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Filters */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <input
          type="text"
          placeholder="Search items…"
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <select
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
          value={campusFilter}
          onChange={(e) => setCampusFilter(e.target.value)}
        >
          <option>All</option>
          {campuses.map((camp) => (
            <option key={camp}>{camp}</option>
          ))}
        </select>

        <select
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
          value={storageFilter}
          onChange={(e) => setStorageFilter(e.target.value)}
        >
          <option>All</option>
          {storageLocations.map((loc) => (
            <option key={loc}>{loc}</option>
          ))}
        </select>
      </div>

      {/* Item Grid */}
      {loading ? (
        <p className="text-gray-500 text-center py-20">Loading storage…</p>
      ) : paginatedItems.length === 0 ? (
        <p className="text-gray-400 text-center">No found items yet.</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedItems.map((item) => (
            <div
              key={item.id}
              className="bg-gray-900 border border-gray-700 rounded-lg p-4 shadow hover:border-ubGold cursor-pointer"
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

              <h2 className="text-lg font-bold text-ubGold">{item.name}</h2>
              <p className="text-gray-400 text-sm">{item.category}</p>

              <p className="text-gray-500 text-sm mt-1">
                Campus: <span className="text-gray-300">{item.campus}</span>
              </p>

              <p className="text-gray-500 text-sm">
                Drop-Off:{" "}
                <span className="text-gray-300">
                  {item.dropoff_location || "N/A"}
                </span>
              </p>

              <p className="text-gray-500 text-sm">
                Stored At:{" "}
                <span className="text-gray-300">{item.location || "N/A"}</span>
              </p>
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
                  : "bg-gray-800 text-gray-300"
              }`}
              onClick={() => setPage(i + 1)}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* ------------------- MODAL ------------------- */}
      {showModal && selectedItem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center px-4 z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-lg w-full relative">
            
            {/* Close */}
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-white"
              onClick={() => setShowModal(false)}
            >
              ✕
            </button>

            {/* Header */}
            <h2 className="text-2xl font-bold text-ubGold mb-1">
              {selectedItem.name}
            </h2>

            <p className="text-gray-400 text-sm mb-4">
              Category: {selectedItem.category || "Unknown"} • Campus:{" "}
              {selectedItem.campus || "Unknown"}
            </p>

            {/* Drop-Off Location */}
            <p className="text-gray-300 font-semibold mb-1">
              Drop-Off Location:
            </p>
            <div className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-200 mb-4">
              {selectedItem.dropoff_location || "Not provided"}
            </div>

            {/* Current Storage */}
            <p className="text-gray-300 font-semibold mb-1">
              Current Storage:
            </p>
            <div className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white mb-4">
              {selectedItem.location || "N/A"}
            </div>

            {/* New Storage */}
            <p className="text-gray-300 font-semibold mb-1">
              New Storage Location:
            </p>

            <select
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white mb-3"
              value={newStorage}
              onChange={(e) => setNewStorage(e.target.value)}
            >
              <option value="">Select storage room…</option>

              {UB_STORAGE_ROOMS.map((room) => (
                <option key={room} value={room}>
                  {room}
                </option>
              ))}

              <option value="__custom">➕ Add Custom Storage Room…</option>
            </select>

            {/* Custom Storage */}
            {newStorage === "__custom" && (
              <input
                type="text"
                placeholder="Enter custom storage room…"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white mb-3"
                onChange={(e) => setNewStorage(e.target.value)}
              />
            )}

            {/* Buttons */}
            <div className="flex justify-end gap-3 mt-5">

              <button
                onClick={updateStorage}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
              >
                Update Storage
              </button>

              <button
                onClick={() => markAsClaimed(selectedItem.id)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white"
              >
                Mark as Claimed
              </button>

              <button
                onClick={() => deleteItem(selectedItem.id)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white"
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
