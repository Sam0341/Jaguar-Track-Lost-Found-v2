"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/* ----------------------------------------------------------
   TYPES
-----------------------------------------------------------*/
type Item = {
  id: string;
  name: string;
  category: string | null;
  campus: string | null;
  location: string | null; // STORAGE ROOM
  status: string;
  description?: string;
  image?: string;
  reported_at?: string;
  reporter_name?: string;
  dropoff_location?: string; // WHERE IT WAS DROPPED OFF
};

/* ----------------------------------------------------------
   MAIN COMPONENT
-----------------------------------------------------------*/
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

  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const PER_PAGE = 8;
  const [page, setPage] = useState(1);

  const [stats, setStats] = useState({
    totalStorageItems: 0,
    storages: 0,
  });

  /* ----------------------------------------------------------
     FETCH STORAGE ITEMS ONLY
     Must be:
     - status = Found
     - dropoff_location != null
     - location != null (assigned to storage)
  -----------------------------------------------------------*/
  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    setLoading(true);

    const { data, error } = await supabase
      .from("items")
      .select("*")
      .eq("status", "Found")
      .not("dropoff_location", "is", null)
      .not("location", "is", null)
      .order("reported_at", { ascending: false });

    if (!error && data) {
      setItems(data);
      setFilteredItems(data);
      updateStats(data);
    }

    setLoading(false);
  }

  /* ----------------------------------------------------------
     UPDATE STATS
-----------------------------------------------------------*/
  function updateStats(list: Item[]) {
    const storageRooms = new Set(
      list.filter((i) => i.location !== null).map((i) => i.location as string)
    );

    setStats({
      totalStorageItems: list.length,
      storages: storageRooms.size,
    });
  }

  /* ----------------------------------------------------------
     FILTER SYSTEM
-----------------------------------------------------------*/
  useEffect(() => {
    let data = [...items];

    if (campusFilter !== "All")
      data = data.filter((i) => i.campus === campusFilter);

    if (statusFilter !== "All")
      data = data.filter((i) => i.status === statusFilter);

    if (storageFilter !== "All")
      data = data.filter((i) => i.location === storageFilter);

    if (searchTerm.trim() !== "") {
      const s = searchTerm.toLowerCase();
      data = data.filter(
        (i) =>
          i.name.toLowerCase().includes(s) ||
          (i.location || "").toLowerCase().includes(s) ||
          (i.campus || "").toLowerCase().includes(s)
      );
    }

    setFilteredItems(data);
  }, [searchTerm, campusFilter, statusFilter, storageFilter, items]);

  /* ----------------------------------------------------------
     ADMIN ACTIONS
-----------------------------------------------------------*/
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
        performed_by: user?.id,
      });

      showToast("Storage updated!", "success");
      setShowModal(false);
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

  /* ----------------------------------------------------------
     CSV DOWNLOAD
-----------------------------------------------------------*/
  function downloadCSV() {
    const headers = ["ID,Name,Category,Campus,Storage,Status,Reported_At"];
    const rows = items.map(
      (item) =>
        `${item.id},"${item.name}",${item.category || ""},${
          item.campus || ""
        },${item.location},${item.status},${item.reported_at || ""}`
    );

    const blob = new Blob([headers.join("\n") + "\n" + rows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "storage_report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ----------------------------------------------------------
     HELPERS
-----------------------------------------------------------*/
  const storageLocations = Array.from(
    new Set(items.map((i) => i.location || "N/A"))
  );
  const campuses = Array.from(new Set(items.map((i) => i.campus)));

  function showToast(msg: string, type: string) {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  const totalPages = Math.ceil(filteredItems.length / PER_PAGE);
  const paginatedItems = filteredItems.slice(
    (page - 1) * PER_PAGE,
    page * PER_PAGE
  );

  /* ----------------------------------------------------------
     UI
-----------------------------------------------------------*/
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-ubGold mb-6">
        📦 Storage Inventory
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="stat-card">
          <p className="stat-number">{stats.totalStorageItems}</p>
          <p className="stat-label">Total Items in Storage</p>
        </div>

        <div className="stat-card">
          <p className="stat-number">{stats.storages}</p>
          <p className="stat-label">Storage Rooms</p>
        </div>
      </div>

      <button
        onClick={downloadCSV}
        className="mb-6 px-4 py-2 bg-ubGold text-black font-semibold rounded shadow hover:bg-yellow-400"
      >
        ⬇ Download Storage Report (CSV)
      </button>

      {toast && (
        <div
          className={`fixed top-5 right-5 px-4 py-2 rounded text-white ${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Filters */}
      <div className="grid sm:grid-cols-4 gap-4 mb-6">
        <input
          placeholder="Search items…"
          className="input-filter"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <select
          className="input-filter"
          value={campusFilter}
          onChange={(e) => setCampusFilter(e.target.value)}
        >
          <option>All</option>
          {campuses.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>

        <select
          className="input-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option>All</option>
          <option>Found</option>
          <option>Claimed</option>
        </select>

        <select
          className="input-filter"
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
        <p className="text-center text-gray-400 py-20">Loading storage…</p>
      ) : paginatedItems.length === 0 ? (
        <p className="text-center text-gray-400">No storage items.</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedItems.map((item) => (
            <div
              key={item.id}
              className="storage-card"
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

              <h2 className="text-lg font-bold">{item.name}</h2>
              <p className="text-sm text-gray-400">{item.category}</p>

              <p className="text-gray-500 text-sm">
                Drop-Off:{" "}
                <span className="text-gray-300">
                  {item.dropoff_location || "N/A"}
                </span>
              </p>

              <p className="text-gray-500 text-sm">
                Stored At:{" "}
                <span className="text-gray-300">{item.location}</span>
              </p>

              <span className="badge">{item.status}</span>
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
              className={`page-btn ${page === i + 1 ? "active" : ""}`}
              onClick={() => setPage(i + 1)}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && selectedItem && (
        <div className="modal-bg">
          <div className="modal-box">
            <button className="modal-close" onClick={() => setShowModal(false)}>
              ✕
            </button>

            <h2 className="modal-title">{selectedItem.name}</h2>

            <p className="modal-info">
              Category: {selectedItem.category} • Campus: {selectedItem.campus}
            </p>

            <label className="modal-label">Drop-Off Location:</label>
            <input
              className="modal-input"
              value={selectedItem.dropoff_location || "N/A"}
              disabled
            />

            <label className="modal-label mt-3">Current Storage:</label>
            <input
              className="modal-input"
              value={selectedItem.location || "N/A"}
              disabled
            />

            <label className="modal-label mt-3">New Storage:</label>
            <select
              className="modal-input"
              value={newStorage}
              onChange={(e) => setNewStorage(e.target.value)}
            >
              {storageLocations.map((loc) => (
                <option key={loc}>{loc}</option>
              ))}
            </select>

            <div className="modal-buttons">
              <button className="btn blue" onClick={updateStorage}>
                Update Storage
              </button>

              <button className="btn red" onClick={() => deleteItem(selectedItem.id)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
