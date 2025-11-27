"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Item = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  status: string;
  image?: string;

  // JOINED FIELDS
  category: { name: string } | null;
  campus: { name: string } | null;
  dropoff_by: { full_name: string | null } | null;
  pickup_by: { full_name: string | null } | null;

  reported_at?: string;
  claimed_at?: string;
};

export default function StoragePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [filtered, setFiltered] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [newStorage, setNewStorage] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [campusFilter, setCampusFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [storageFilter, setStorageFilter] = useState("All");

  const PER_PAGE = 8;
  const [page, setPage] = useState(1);

  // ---------------------------------------------------------
  // Fetch Items
  // ---------------------------------------------------------
  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    setLoading(true);

    const { data, error } = await supabase
      .from("items")
      .select(`
        id,
        name,
        description,
        status,
        location,
        image,
        reported_at,
        claimed_at,

        category:category_id ( name ),
        campus:campus_id ( name ),
        dropoff_by:reported_by ( full_name ),
        pickup_by ( full_name )
      `)
      .order("reported_at", { ascending: false });

    if (error) {
      console.log("Fetch error:", error);
      setItems([]);
      setFiltered([]);
      setLoading(false);
      return;
    }

    const normalized = (data as any[]).map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      status: d.status,
      location: d.location,
      image: d.image,
      reported_at: d.reported_at,
      claimed_at: d.claimed_at,
      // Supabase sometimes returns joined rows as single-element arrays; normalize to the expected object|null shape
      category: Array.isArray(d.category) ? d.category[0] ?? null : d.category ?? null,
      campus: Array.isArray(d.campus) ? d.campus[0] ?? null : d.campus ?? null,
      dropoff_by: Array.isArray(d.dropoff_by) ? d.dropoff_by[0] ?? null : d.dropoff_by ?? null,
      pickup_by: Array.isArray(d.pickup_by) ? d.pickup_by[0] ?? null : d.pickup_by ?? null,
    })) as Item[];

    const onlyStorage = normalized.filter(
      (i) => i.status === "Found" || i.status === "Claimed"
    );

    setItems(onlyStorage);
    setFiltered(onlyStorage);
    setLoading(false);
  }

  // ---------------------------------------------------------
  // Filtering Logic
  // ---------------------------------------------------------
  useEffect(() => {
    let data = [...items];

    if (campusFilter !== "All")
      data = data.filter((i) => i.campus?.name === campusFilter);

    if (statusFilter !== "All")
      data = data.filter((i) => i.status === statusFilter);

    if (storageFilter !== "All")
      data = data.filter((i) => (i.location || "N/A") === storageFilter);

    if (search.trim()) {
      const s = search.toLowerCase();
      data = data.filter(
        (i) =>
          i.name.toLowerCase().includes(s) ||
          (i.location || "").toLowerCase().includes(s) ||
          (i.campus?.name || "").toLowerCase().includes(s)
      );
    }

    setFiltered(data);
  }, [items, search, campusFilter, statusFilter, storageFilter]);

  // ---------------------------------------------------------
  // Update Storage
  // ---------------------------------------------------------
  async function updateStorage() {
    if (!selectedItem) return;

    const user = (await supabase.auth.getUser()).data.user;

    const { error } = await supabase
      .from("items")
      .update({ location: newStorage })
      .eq("id", selectedItem.id);

    if (error) return toastMsg("Failed to update storage!", "error");

    await supabase.from("logs").insert({
      action: "storage_updated",
      item_id: selectedItem.id,
      performed_by: user?.id,
    });

    toastMsg("Storage updated!", "success");
    setShowModal(false);
    fetchItems();
  }

  // ---------------------------------------------------------
  // Mark Claimed
  // ---------------------------------------------------------
  async function markAsClaimed(id: string) {
    const user = (await supabase.auth.getUser()).data.user;

    const { data: claim, error: claimErr } = await supabase
      .from("claims")
      .select("claimed_by, profiles!claims_claimed_by_fkey(full_name)")
      .eq("item_id", id)
      .single();

    if (claimErr || !claim) return toastMsg("No claim found!", "error");

    type Profile = { full_name: string | null };
    type ClaimWithProfile = {
      claimed_by: string;
      profiles?: Profile | Profile[] | null;
    };

    const typedClaim = claim as ClaimWithProfile;

    const claimerId = typedClaim.claimed_by;
    const claimerName = Array.isArray(typedClaim.profiles)
      ? (typedClaim.profiles[0]?.full_name ?? null)
      : (typedClaim.profiles?.full_name ?? null);

    const { error } = await supabase
      .from("items")
      .update({
        status: "Claimed",
        claimed_at: new Date().toISOString(),
        pickup_by: claimerId,
      })
      .eq("id", id);

    if (error) return toastMsg("Failed to update item!", "error");

    await supabase.from("logs").insert({
      action: "item_claimed",
      item_id: id,
      performed_by: user?.id,
    });

    toastMsg("Item marked as claimed!", "success");
    fetchItems();
  }

  // ---------------------------------------------------------
  // Delete Item
  // ---------------------------------------------------------
  async function deleteItem(id: string) {
    if (!confirm("Delete this item?")) return;

    const user = (await supabase.auth.getUser()).data.user;

    const { error } = await supabase.from("items").delete().eq("id", id);

    if (error) return toastMsg("Delete failed!", "error");

    await supabase.from("logs").insert({
      action: "item_deleted",
      item_id: id,
      performed_by: user?.id,
    });

    toastMsg("Item deleted!", "success");
    fetchItems();
  }

  // ---------------------------------------------------------
  // CSV Export
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

    const rows = filtered.map((i) =>
      [
        i.id,
        `"${i.name}"`,
        `"${i.dropoff_by?.full_name || "N/A"}"`,
        `"${i.pickup_by?.full_name || "N/A"}"`,
        i.category?.name || "",
        i.campus?.name || "",
        i.location || "N/A",
        i.status,
        i.reported_at || "",
        i.claimed_at || "",
      ].join(",")
    );

    const csv = [headers, ...rows].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "storage_report.csv";
    a.click();
  }

  const storageList = Array.from(new Set(items.map((i) => i.location || "N/A")));
  const campusList = Array.from(new Set(items.map((i) => i.campus?.name || "N/A")));

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function toastMsg(msg: string, type: string) {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  // ---------------------------------------------------------
  // JSX
  // ---------------------------------------------------------
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-ubGold mb-6 flex items-center gap-2">
        📦 Storage Inventory
      </h1>

      <button
        onClick={downloadCSV}
        className="mb-6 px-4 py-2 bg-ubGold text-black font-semibold rounded shadow hover:bg-yellow-400"
      >
        ⬇ Download Storage CSV
      </button>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400">No storage items found.</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginated.map((item) => (
            <div
              key={item.id}
              className="p-4 bg-white dark:bg-gray-900 shadow rounded hover:border-ubGold border cursor-pointer"
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

              <h2 className="font-bold text-lg text-ubBlue dark:text-ubGold">
                {item.name}
              </h2>

              <p className="text-gray-300 text-sm">{item.category?.name}</p>
              <p className="text-gray-300 text-sm">Campus: {item.campus?.name}</p>

              <p className="text-gray-300 text-sm">
                Dropoff By: {item.dropoff_by?.full_name || "N/A"}
              </p>

              {item.pickup_by && (
                <p className="text-gray-300 text-sm">
                  Pickup By: {item.pickup_by.full_name}
                </p>
              )}

              <p className="text-gray-300 text-sm">
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

      {toast && (
        <div
          className={`fixed top-4 right-4 px-4 py-2 rounded shadow ${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          } text-white`}
        >
          {toast.msg}
        </div>
      )}

      {showModal && selectedItem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg max-w-lg w-full border border-gray-700 relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute right-4 top-3 text-gray-400 hover:text-white"
            >
              ✕
            </button>

            <h2 className="text-2xl font-bold mb-2 text-ubGold">
              {selectedItem.name}
            </h2>

            <p className="text-gray-300">
              Category: {selectedItem.category?.name}
            </p>
            <p className="text-gray-300">
              Campus: {selectedItem.campus?.name}
            </p>

            <p className="mt-3 text-gray-300">Dropoff By</p>
            <input
              disabled
              className="w-full bg-gray-800 text-gray-200 rounded px-3 py-2 border"
              value={selectedItem.dropoff_by?.full_name || "N/A"}
            />

            {selectedItem.pickup_by && (
              <>
                <p className="mt-3 text-gray-300">Pickup By</p>
                <input
                  disabled
                  className="w-full bg-gray-800 text-gray-200 rounded px-3 py-2 border"
                  value={selectedItem.pickup_by.full_name || ""}
                />
              </>
            )}

            <p className="mt-4 text-gray-300">Current Storage</p>
            <input
              disabled
              className="w-full bg-gray-800 text-gray-200 rounded px-3 py-2 border"
              value={selectedItem.location || "N/A"}
            />

            <p className="mt-4 text-gray-300">New Storage Location</p>
            <select
              value={newStorage}
              onChange={(e) => setNewStorage(e.target.value)}
              className="w-full bg-gray-800 text-gray-200 rounded px-3 py-2 border"
            >
              {storageList.map((loc) => (
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
    </div>
  );
}
