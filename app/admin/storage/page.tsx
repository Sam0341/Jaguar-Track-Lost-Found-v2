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

  // NEW FIELDS
  claimed_at?: string;
  pickup_by?: string;
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
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const [page, setPage] = useState(1);
  const PER_PAGE = 8;

  const [stats, setStats] = useState({
    storages: 0,
    totalStorageItems: 0,
  });

  // ---------------------------------------------------------
  // Fetch items
  // ---------------------------------------------------------
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
      const foundItems = data.filter(
        (i) => i.status === "Found" || i.status === "Claimed"
      );

      setItems(foundItems);
      setFilteredItems(foundItems);
      calculateStats(foundItems);
    }

    setLoading(false);
  }

  // ---------------------------------------------------------
  // Stats
  // ---------------------------------------------------------
  function calculateStats(data: Item[]) {
    const storages = new Set(data.map((i) => i.location || "N/A"));
    setStats({
      storages: storages.size,
      totalStorageItems: data.length,
    });
  }

  // ---------------------------------------------------------
  // Filters
  // ---------------------------------------------------------
  useEffect(() => {
    let data = [...items];

    if (campusFilter !== "All")
      data = data.filter((i) => i.campus === campusFilter);

    if (statusFilter !== "All")
      data = data.filter((i) => i.status === statusFilter);

    if (storageFilter !== "All")
      data = data.filter((i) => (i.location || "N/A") === storageFilter);

    if (searchTerm.trim()) {
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

  // ---------------------------------------------------------
  // Update Storage Location
  // ---------------------------------------------------------
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
      showToast("Failed to update storage!", "error");
    }
  }

  // ---------------------------------------------------------
  // Mark Item as Claimed (FIXED VERSION)
  // ---------------------------------------------------------
  async function markAsClaimed(id: string) {
    const user = (await supabase.auth.getUser()).data.user;

    // Get claim and join profile full name
    const { data: claim, error: claimError } = await supabase
      .from("claims")
      .select("claimed_by, profiles(full_name)")
      .eq("item_id", id)
      .single();

    if (claimError || !claim) {
      showToast("No claim found for this item!", "error");
      return;
    }

    const claimerId = claim.claimed_by;
    const claimerName = claim.profiles?.[0]?.full_name || "Unknown";

    const { error } = await supabase
      .from("items")
      .update({
        status: "Claimed",
        claimed_by: claimerId,
        claimed_at: new Date().toISOString(),
        pickup_by: claimerName,
      })
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
      showToast("Failed to update!", "error");
    }
  }

  // ---------------------------------------------------------
  // Delete Item
  // ---------------------------------------------------------
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

  // ---------------------------------------------------------
  // CSV Export (updated)
  // ---------------------------------------------------------
  function downloadCSV() {
    const headers = [
      "ID",
      "Name",
      "Dropoff_By",
      "Pickup_By",
      "Category",
      "Campus",
      "Storage",
      "Status",
      "Reported_At",
      "Claimed_At",
    ].join(",");

    const rows = items.map((i) =>
      [
        i.id,
        `"${i.name}"`,
        `"${i.reporter_name || "N/A"}"`,
        `"${i.pickup_by || "N/A"}"`,
        i.category || "",
        i.campus || "",
        i.location || "N/A",
        i.status,
        i.reported_at || "",
        i.claimed_at || "",
      ].join(",")
    );

    const csv = [headers, ...rows].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "storage_report.csv";
    a.click();

    URL.revokeObjectURL(url);
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

  // ---------------------------------------------------------
  // Render Page
  // ---------------------------------------------------------
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-ubGold mb-6">📦 Storage Inventory</h1>

      {/* CSV Button */}
      <button
        onClick={downloadCSV}
        className="mb-6 px-4 py-2 bg-ubGold text-black font-semibold rounded shadow hover:bg-yellow-400"
      >
        ⬇ Download Storage CSV
      </button>

      {/* Item Grid */}
      {loading ? (
        <p className="text-gray-300 text-center py-10">Loading...</p>
      ) : filteredItems.length === 0 ? (
        <p className="text-gray-400 text-center">No items found.</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedItems.map((item) => (
            <div
              key={item.id}
              className="p-4 bg-white dark:bg-gray-900 shadow rounded cursor-pointer hover:border-ubGold border"
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

              <h2 className="font-bold text-lg text-ubBlue dark:text-ubGold">{item.name}</h2>

              <p className="text-sm text-gray-400">{item.category}</p>

              <p className="text-sm text-gray-300">Drop-Off: {item.dropoff_location || "N/A"}</p>

              {item.pickup_by && (
                <p className="text-sm text-gray-300">Pickup By: {item.pickup_by}</p>
              )}

              <p className="text-sm text-gray-300">Storage: {item.location || "N/A"}</p>

              <span
                className={`inline-block mt-2 px-2 py-1 text-xs rounded ${
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`px-3 py-1 rounded ${
                page === i + 1
                  ? "bg-ubGold text-black"
                  : "bg-gray-800 text-gray-300"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && selectedItem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg max-w-lg w-full relative border border-gray-700">
            <button
              className="absolute right-4 top-3 text-gray-400 hover:text-white"
              onClick={() => setShowModal(false)}
            >
              ✕
            </button>

            <h2 className="text-2xl font-bold text-ubBlue dark:text-ubGold">{selectedItem.name}</h2>

            <p className="text-gray-300 mb-2">
              Category: {selectedItem.category} | Campus: {selectedItem.campus}
            </p>

            <p className="text-gray-300 mb-1">Drop-Off Location:</p>
            <input
              disabled
              value={selectedItem.dropoff_location || "N/A"}
              className="w-full px-3 py-2 border rounded bg-gray-800 text-gray-200"
            />

            {selectedItem.pickup_by && (
              <>
                <p className="mt-3 mb-1 text-gray-300">Pickup By:</p>
                <input
                  disabled
                  value={selectedItem.pickup_by}
                  className="w-full px-3 py-2 border rounded bg-gray-800 text-gray-200"
                />
              </>
            )}

            <p className="mt-4 mb-1 text-gray-300">Current Storage:</p>
            <input
              disabled
              value={selectedItem.location || "N/A"}
              className="w-full px-3 py-2 border rounded bg-gray-800 text-gray-200"
            />

            <p className="mt-4 mb-1 text-gray-300">New Storage Location:</p>
            <select
              className="w-full px-3 py-2 border rounded bg-gray-800 text-gray-200"
              value={newStorage}
              onChange={(e) => setNewStorage(e.target.value)}
            >
              {storageLocations.map((loc) => (
                <option key={loc}>{loc}</option>
              ))}
            </select>

            <div className="flex gap-3 justify-end mt-6">
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
                Mark Claimed
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

      {toast && (
        <div
          className={`fixed top-4 right-4 px-4 py-2 rounded shadow ${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          } text-white`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
