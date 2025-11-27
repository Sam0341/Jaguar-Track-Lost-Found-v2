"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Item = {
  id: string;
  name: string;
  description?: string;
  image?: string;

  status: string;
  location: string | null;

  reported_at?: string;
  claimed_at?: string;

  dropoff_location?: string;

  category_id?: string;
  campus_id?: string;

  category_name?: string;
  campus_name?: string;

  dropper?: { full_name: string | null } | null; // profiles!dropoff_by
  picker?: { full_name: string | null } | null;  // profiles!pickup_by
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

  // ----------------------------------------
  // FETCH STORAGE ITEMS
  // ----------------------------------------
  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    setLoading(true);

    const { data, error } = await supabase
      .from("items")
      .select(`
        *,
        categories:category_id(name),
        campuses:campus_id(name),
        dropper:profiles!dropoff_by(full_name),
        picker:profiles!pickup_by(full_name)
      `)
      .order("reported_at", { ascending: false });

    if (error) {
      console.error("Fetch error:", error);
      setLoading(false);
      return;
    }

    const stored = (data || []).filter(
      (i: any) => i.status === "Found" || i.status === "Claimed"
    );

    const mapped = stored.map((i: any) => ({
      ...i,
      category_name: i.categories?.name || null,
      campus_name: i.campuses?.name || null,
    }));

    setItems(mapped);
    setFilteredItems(mapped);
    setLoading(false);
  }

  // ----------------------------------------
  // FILTERING
  // ----------------------------------------
  useEffect(() => {
    let data = [...items];

    if (campusFilter !== "All") {
      data = data.filter((i) => i.campus_name === campusFilter);
    }

    if (statusFilter !== "All") {
      data = data.filter((i) => i.status === statusFilter);
    }

    if (storageFilter !== "All") {
      data = data.filter((i) => (i.location || "N/A") === storageFilter);
    }

    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      data = data.filter(
        (i) =>
          i.name.toLowerCase().includes(t) ||
          (i.category_name || "").toLowerCase().includes(t) ||
          (i.campus_name || "").toLowerCase().includes(t) ||
          (i.location || "").toLowerCase().includes(t)
      );
    }

    setFilteredItems(data);
  }, [items, searchTerm, campusFilter, statusFilter, storageFilter]);

  // ----------------------------------------
  // MARK AS CLAIMED
  // ----------------------------------------
  async function markAsClaimed(id: string) {
    const user = (await supabase.auth.getUser()).data.user;

    const { data: claim } = await supabase
      .from("claims")
      .select("claimed_by")
      .eq("item_id", id)
      .maybeSingle();

    if (!claim) {
      showToast("No claim exists for this item!", "error");
      return;
    }

    const claimerId = claim.claimed_by;

    const { error } = await supabase
      .from("items")
      .update({
        status: "Claimed",
        pickup_by: claimerId,
        claimed_by: claimerId,
        claimed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      showToast("Failed to update claim!", "error");
      return;
    }

    showToast("Marked as claimed!", "success");
    fetchItems();
  }

  // ----------------------------------------
  // UPDATE STORAGE
  // ----------------------------------------
  async function updateStorage() {
    if (!selectedItem) return;

    const { error } = await supabase
      .from("items")
      .update({ location: newStorage })
      .eq("id", selectedItem.id);

    if (error) {
      showToast("Failed to update storage!", "error");
    } else {
      showToast("Storage updated!", "success");
      fetchItems();
    }

    setShowModal(false);
  }

  // ----------------------------------------
  // DELETE
  // ----------------------------------------
  async function deleteItem(id: string) {
    if (!confirm("Delete this item?")) return;

    const { error } = await supabase.from("items").delete().eq("id", id);

    if (error) showToast("Delete failed!", "error");
    else {
      showToast("Deleted!", "success");
      fetchItems();
    }
  }

  // ----------------------------------------
  // CSV EXPORT
  // ----------------------------------------
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
        `"${i.dropper?.full_name || "N/A"}"`,
        `"${i.picker?.full_name || "N/A"}"`,
        i.category_name || "",
        i.campus_name || "",
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

  // ----------------------------------------
  const storageLocations = Array.from(
    new Set(items.map((i) => i.location || "N/A"))
  );
  const campuses = Array.from(new Set(items.map((i) => i.campus_name)));

  const showToast = (msg: string, type: string) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const totalPages = Math.ceil(filteredItems.length / PER_PAGE);
  const paginatedItems = filteredItems.slice(
    (page - 1) * PER_PAGE,
    page * PER_PAGE
  );

  // ----------------------------------------
  // UI
  // ----------------------------------------
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-ubGold mb-6">📦 Storage Inventory</h1>

      <button
        onClick={downloadCSV}
        className="mb-6 px-4 py-2 bg-ubGold text-black font-semibold rounded shadow hover:bg-yellow-400"
      >
        ⬇ Download Storage CSV
      </button>

      {loading ? (
        <p className="text-gray-300 text-center py-10">Loading...</p>
      ) : filteredItems.length === 0 ? (
        <p className="text-gray-400 text-center">No storage items found.</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedItems.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                setSelectedItem(item);
                setNewStorage(item.location || "");
                setShowModal(true);
              }}
              className="p-4 bg-white dark:bg-gray-900 shadow rounded cursor-pointer hover:border-ubGold border"
            >
              {item.image && (
                <img
                  src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/item-photos/${item.image}`}
                  className="w-full h-40 object-cover rounded mb-3"
                />
              )}

              <h2 className="font-bold text-lg text-ubBlue dark:text-ubGold">
                {item.name}
              </h2>

              <p className="text-sm text-gray-400">{item.category_name}</p>

              <p className="text-sm text-gray-300">
                Campus: {item.campus_name || "N/A"}
              </p>

              <p className="text-sm text-gray-300">
                Dropoff By: {item.dropper?.full_name || "N/A"}
              </p>

              <p className="text-sm text-gray-300">
                Pickup By: {item.picker?.full_name || "N/A"}
              </p>

              <p className="text-sm text-gray-300">
                Storage: {item.location || "N/A"}
              </p>

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

      {/* PAGINATION */}
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

      {/* MODAL */}
      {showModal && selectedItem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg max-w-lg w-full relative border border-gray-700">

            <button
              onClick={() => setShowModal(false)}
              className="absolute top-3 right-4 text-gray-400 hover:text-white"
            >
              ✕
            </button>

            <h2 className="text-2xl font-bold text-ubBlue dark:text-ubGold">
              {selectedItem.name}
            </h2>

            <p className="text-gray-300 mb-2">
              Category: {selectedItem.category_name} | Campus:{" "}
              {selectedItem.campus_name}
            </p>

            <p className="text-gray-300 mb-1">Drop-Off Location:</p>
            <input
              disabled
              value={selectedItem.dropoff_location || "N/A"}
              className="w-full px-3 py-2 border rounded bg-gray-800 text-gray-200"
            />

            <p className="mt-3 mb-1 text-gray-300">
              Drop-Off By: {selectedItem.dropper?.full_name || "N/A"}
            </p>

            <p className="mt-3 mb-1 text-gray-300">
              Pickup By: {selectedItem.picker?.full_name || "N/A"}
            </p>

            <p className="mt-4 mb-1 text-gray-300">Current Storage:</p>
            <input
              disabled
              value={selectedItem.location || "N/A"}
              className="w-full px-3 py-2 border rounded bg-gray-800 text-gray-200"
            />

            <p className="mt-4 mb-1 text-gray-300">New Storage Location:</p>
            <select
              value={newStorage}
              onChange={(e) => setNewStorage(e.target.value)}
              className="w-full px-3 py-2 border rounded bg-gray-800 text-gray-200"
            >
              {storageLocations.map((loc) => (
                <option key={loc}>{loc}</option>
              ))}
            </select>

            <div className="flex justify-end gap-3 mt-6">
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

      {/* TOAST */}
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
