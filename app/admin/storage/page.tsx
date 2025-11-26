"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/* ------------------------------------------------------ */
/* ------------------- TYPES ---------------------------- */
/* ------------------------------------------------------ */

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

type StorageRoom = {
  id: string;
  name: string;
  color: string;
  icon: string;
};

/* ------------------------------------------------------ */
/* ------------------- PAGE ----------------------------- */
/* ------------------------------------------------------ */

export default function StoragePage() {
  /* ---------------- STATE ---------------- */
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [rooms, setRooms] = useState<StorageRoom[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [campusFilter, setCampusFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [storageFilter, setStorageFilter] = useState("All");

  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [stats, setStats] = useState({
    storages: 0,
    totalStorageItems: 0,
  });

  // NEW STATE for creating/deleting rooms
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [showDeleteRoomModal, setShowDeleteRoomModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [selectedDeleteRoom, setSelectedDeleteRoom] = useState<StorageRoom | null>(null);

  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const PER_PAGE = 8;
  const [page, setPage] = useState(1);

  /* ------------------------------------------------------ */
  /* ------------------- FETCH ITEMS ---------------------- */
  /* ------------------------------------------------------ */

  useEffect(() => {
    fetchItems();
    fetchStorageRooms();
  }, []);

  async function fetchItems() {
    setLoading(true);

    const { data } = await supabase
      .from("items")
      .select("*")
      .order("reported_at", { ascending: false });

    if (data) {
      const found = data.filter((i) => i.status === "Found");
      setItems(found);
      setFilteredItems(found);
      calculateStats(found);
    }

    setLoading(false);
  }

  async function fetchStorageRooms() {
    const { data } = await supabase.from("storage_rooms").select("*");

    if (data) {
      setRooms(data);
    }
  }

  /* ------------------------------------------------------ */
  /* ------------------- STATS ---------------------------- */
  /* ------------------------------------------------------ */

  function calculateStats(data: Item[]) {
    const storages = new Set(data.map((i) => i.location || "N/A"));
    const total = data.length;

    setStats({
      storages: storages.size,
      totalStorageItems: total,
    });
  }

  /* ------------------------------------------------------ */
  /* ------------------- FILTERS -------------------------- */
  /* ------------------------------------------------------ */

  useEffect(() => {
    let data = [...items];

    if (campusFilter !== "All") data = data.filter((i) => i.campus === campusFilter);

    if (statusFilter !== "All") data = data.filter((i) => i.status === statusFilter);

    if (storageFilter !== "All") data = data.filter((i) => (i.location || "N/A") === storageFilter);

    if (searchTerm.trim() !== "") {
      const t = searchTerm.toLowerCase();
      data = data.filter(
        (i) =>
          i.name.toLowerCase().includes(t) ||
          (i.location || "").toLowerCase().includes(t) ||
          (i.campus || "").toLowerCase().includes(t)
      );
    }

    setFilteredItems(data);
  }, [searchTerm, campusFilter, statusFilter, storageFilter, items]);

  /* ------------------------------------------------------ */
  /* ------------------- ROOM ACTIONS --------------------- */
  /* ------------------------------------------------------ */

  async function addStorageRoom() {
    if (!newRoomName.trim()) return;

    const user = (await supabase.auth.getUser()).data.user;

    const { data, error } = await supabase
      .from("storage_rooms")
      .insert({
        name: newRoomName.trim(),
        color: "#3b82f6",
        icon: "📦",
        created_by: user?.id,
      })
      .select();

    if (!error && data) {
      setRooms([...rooms, data[0]]);
      setShowAddRoomModal(false);
      setNewRoomName("");
      showToast("Storage room added!", "success");
    }
  }

  async function deleteStorageRoom() {
    if (!selectedDeleteRoom) return;

    const { error } = await supabase
      .from("storage_rooms")
      .delete()
      .eq("id", selectedDeleteRoom.id);

    if (!error) {
      setRooms(rooms.filter((r) => r.id !== selectedDeleteRoom.id));
      setShowDeleteRoomModal(false);
      setSelectedDeleteRoom(null);
      showToast("Storage room deleted!", "success");
    }
  }

  /* ------------------------------------------------------ */
  /* ------------------- TOASTS --------------------------- */
  /* ------------------------------------------------------ */

  const showToast = (msg: string, type: string) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  /* ------------------------------------------------------ */
  /* ------------------- RENDER --------------------------- */
  /* ------------------------------------------------------ */

  const storageLocations = Array.from(
    new Set([...items.map((i) => i.location || "N/A"), ...rooms.map((r) => r.name)])
  );

  const campuses = Array.from(new Set(items.map((i) => i.campus)));

  const totalPages = Math.ceil(filteredItems.length / PER_PAGE);
  const paginated = filteredItems.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-ubGold mb-6">📦 Storage Inventory</h1>

      {/* ---------------------- STATS ---------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">

        {/* Total items */}
        <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-4 text-center shadow">
          <p className="text-2xl font-bold text-ubBlue dark:text-ubGold">{stats.totalStorageItems}</p>
          <p className="text-gray-600 dark:text-gray-400 text-sm">Total Items in Storage</p>
        </div>

        {/* Rooms */}
        <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg p-4 text-center shadow">
          <p className="text-2xl font-bold text-ubBlue dark:text-ubGold">{storageLocations.length}</p>
          <p className="text-gray-600 dark:text-gray-400 text-sm">Storage Rooms</p>
        </div>
      </div>

      {/* CSV + Add Room */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => {}}
          className="px-4 py-2 bg-ubGold text-black font-semibold rounded shadow hover:bg-yellow-400"
        >
          ⬇ Download Storage Report (CSV)
        </button>

        <button
          onClick={() => setShowAddRoomModal(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded shadow hover:bg-blue-600"
        >
          + Add Storage Room
        </button>

        <button
          onClick={() => setShowDeleteRoomModal(true)}
          className="px-4 py-2 bg-red-500 text-white rounded shadow hover:bg-red-600"
        >
          🗑 Delete Storage Room
        </button>
      </div>

      {/* ------------------- Add Room Modal ------------------- */}
      {showAddRoomModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl w-full max-w-md border border-gray-700">
            <h2 className="text-xl font-bold text-ubBlue dark:text-ubGold mb-4">
              Add New Storage Room
            </h2>

            <input
              className="w-full mb-4 px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-700 rounded"
              placeholder="Room name (e.g. Jaguar U5)"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
            />

            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 bg-gray-600 text-white rounded"
                onClick={() => setShowAddRoomModal(false)}
              >
                Cancel
              </button>

              <button
                className="px-4 py-2 bg-blue-600 text-white rounded"
                onClick={addStorageRoom}
              >
                Add Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------- Delete Room Modal ------------------- */}
      {showDeleteRoomModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl w-full max-w-md border border-gray-700">
            <h2 className="text-xl font-bold text-red-500 mb-4">Delete Storage Room</h2>

            <select
              className="w-full mb-4 px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-700 rounded"
              value={selectedDeleteRoom?.id || ""}
              onChange={(e) =>
                setSelectedDeleteRoom(rooms.find((r) => r.id === e.target.value) || null)
              }
            >
              <option value="">Select room…</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>

            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 bg-gray-600 text-white rounded"
                onClick={() => setShowDeleteRoomModal(false)}
              >
                Cancel
              </button>

              <button
                className="px-4 py-2 bg-red-600 text-white rounded"
                onClick={deleteStorageRoom}
                disabled={!selectedDeleteRoom}
              >
                Delete Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 px-4 py-2 rounded shadow-lg text-white ${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* ---------------------- FILTERS ---------------------- */}
      <div className="grid sm:grid-cols-4 gap-4 mb-6">

        {/* Search */}
        <input
          type="text"
          placeholder="Search items…"
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-700 rounded text-black dark:text-white"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        {/* Campus */}
        <select
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-700 rounded text-black dark:text-white"
          value={campusFilter}
          onChange={(e) => setCampusFilter(e.target.value)}
        >
          <option>All</option>
          {campuses.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>

        {/* Status */}
        <select
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-700 rounded text-black dark:text-white"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option>All</option>
          <option>Found</option>
          <option>Claimed</option>
        </select>

        {/* Storage Room */}
        <select
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-700 rounded text-black dark:text-white"
          value={storageFilter}
          onChange={(e) => setStorageFilter(e.target.value)}
        >
          <option>All</option>
          {storageLocations.map((loc) => (
            <option key={loc}>{loc}</option>
          ))}
        </select>
      </div>

      {/* --------------------- ITEM GRID ---------------------- */}
      {loading ? (
        <p className="text-gray-500 text-center py-20">Loading storage…</p>
      ) : filteredItems.length === 0 ? (
        <p className="text-gray-500 text-center">No storage items.</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginated.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-gray-900 border border-gray-700 rounded-lg p-4 shadow hover:border-ubGold cursor-pointer"
              onClick={() => {
                setSelectedItem(item);
                setShowModal(true);
              }}
            >
              {item.image && (
                <img
                  src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/item-photos/${item.image}`}
                  className="w-full h-40 object-cover rounded mb-3"
                />
              )}

              <h2 className="text-lg font-bold text-ubBlue dark:text-ubGold">{item.name}</h2>

              <p className="text-gray-600 dark:text-gray-400 text-sm">{item.category}</p>

              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Drop-Off: <span>{item.dropoff_location || "N/A"}</span>
              </p>

              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                Stored At: <span>{item.location || "N/A"}</span>
              </p>

              <span
                className={`inline-block mt-2 px-2 py-1 rounded text-xs font-semibold ${
                  item.status === "Claimed"
                    ? "bg-green-600 text-white"
                    : "bg-blue-600 text-white"
                }`}
              >
                {item.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ------------------ PAGINATION ---------------------- */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              className={`px-3 py-1 rounded ${
                page === i + 1
                  ? "bg-ubGold text-black"
                  : "bg-gray-700 text-white"
              }`}
              onClick={() => setPage(i + 1)}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
