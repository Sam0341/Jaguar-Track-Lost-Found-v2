"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { addLog } from "@/lib/logs";
import { generateItemPDF } from "@/components/pdf/ItemReportPDF";

/* ============================================================
   TYPES
============================================================ */
type Item = {
  id: string;
  name: string;
  status: string;
  description?: string;
  image?: string;
  reporter_name?: string;
  reporter_email?: string;
  reported_at?: string;
  dropoff_location?: string;
  location?: string;

  category_name?: string;
  campus_name?: string;

  report?: {
    report_type: string;
    storage_location: string;
    expiration_date: string | null;
    created_at: string;
    handled_by: string | null;
    handled_by_name?: string | null;
  } | null;
};

/* ============================================================
   MAIN COMPONENT
============================================================ */
export default function AdminDashboard() {
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [campusFilter, setCampusFilter] = useState("All");

  const [editingExpiration, setEditingExpiration] = useState(false);
  const [newExpiration, setNewExpiration] = useState("");

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  /* ============================================================
     FETCH ITEMS
  ============================================================ */
  useEffect(() => {
    fetchItems();
  }, []);

  async function fetchItems() {
    setLoading(true);

    const { data, error } = await supabase
      .from("items")
      .select(`
        *,
        categories:category_id ( name ),
        campuses:campus_id ( name ),
        report:reports (
          report_type,
          storage_location,
          expiration_date,
          created_at,
          handled_by
        )
      `)
      .order("reported_at", { ascending: false });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const itemsWithNames = await Promise.all(
      data.map(async (item: any) => {
        let handled_by_name = null;

        if (item.report?.handled_by) {
          const { data: p } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", item.report.handled_by)
            .single();
          handled_by_name = p?.full_name || "Unknown Admin";
        }

        return {
          ...item,
          category_name: item.categories?.name,
          campus_name: item.campuses?.name,
          report: item.report ? { ...item.report, handled_by_name } : null,
        };
      })
    );

    setItems(itemsWithNames);
    setFilteredItems(itemsWithNames);
    setLoading(false);
  }

  /* ============================================================
     FILTERING LOGIC
  ============================================================ */
  useEffect(() => {
    let filtered = [...items];

    if (statusFilter !== "All")
      filtered = filtered.filter((i) => i.status === statusFilter);

    if (campusFilter !== "All")
      filtered = filtered.filter((i) => i.campus_name === campusFilter);

    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.name.toLowerCase().includes(t) ||
          (i.reporter_name || "").toLowerCase().includes(t) ||
          (i.reporter_email || "").toLowerCase().includes(t)
      );
    }

    setFilteredItems(filtered);
  }, [items, searchTerm, statusFilter, campusFilter]);

  /* ============================================================
     HELPERS
  ============================================================ */
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-BZ", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleTimeString("en-BZ", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  function getExpirationColor(exp?: string | null) {
    if (!exp) return "text-gray-400";

    const today = new Date();
    const date = new Date(exp);
    const diff = date.getTime() - today.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (days <= 0) return "text-red-600 font-semibold";
    if (days <= 3) return "text-yellow-600 font-semibold";
    return "text-green-600 font-semibold";
  }

  function showToast(msg: string, type: "success" | "error") {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  /* ============================================================
     SAVE EXPIRATION
  ============================================================ */
  async function saveExpiration() {
    if (!selectedItem?.report) return;

    const { error } = await supabase
      .from("reports")
      .update({ expiration_date: newExpiration })
      .eq("item_id", selectedItem.id);

    if (error) return showToast("Failed to update expiration.", "error");

    showToast("Expiration updated!", "success");
    setEditingExpiration(false);
    fetchItems();
  }

  /* ============================================================
     CLAIM / DELETE
  ============================================================ */
  async function markAsClaimed(id: string) {
    if (!confirm("Mark this item as claimed?")) return;

    const { data: auth } = await supabase.auth.getUser();
    const admin = auth?.user;

    await supabase.from("items").update({ status: "Claimed" }).eq("id", id);
    await addLog("item_claimed", id, admin?.id || "unknown");

    fetchItems();
    setShowModal(false);
    showToast("Item marked as claimed!", "success");
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this item?")) return;

    const { data: auth } = await supabase.auth.getUser();
    const admin = auth?.user;

    await supabase.from("items").delete().eq("id", id);
    await addLog("item_deleted", id, admin?.id || "unknown");

    fetchItems();
    setShowModal(false);
    showToast("Item deleted!", "success");
  }

  /* ============================================================
     COUNTERS
  ============================================================ */
  const uniqueStorageRooms = Array.from(
    new Set(items.map((i) => i.location).filter(Boolean))
  ).length;

  const uniqueCampuses = Array.from(
    new Set(items.map((i) => i.campus_name))
  ).length;

  /* ============================================================
     RENDER
  ============================================================ */
  return (
    <div className="p-6 max-w-7xl mx-auto min-h-screen bg-gray-100 dark:bg-gray-900">

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 px-4 py-2 rounded shadow-lg text-white z-50 ${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toast.message}
        </div>
      )}

      <h1 className="text-3xl font-bold text-ubGold mb-6">
        Admin Dashboard
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard label="Total Items" value={items.length} />
        <StatCard
          label="Lost"
          value={items.filter((i) => i.status === "Lost").length}
        />
        <StatCard
          label="Found"
          value={items.filter((i) => i.status === "Found").length}
        />
        <StatCard
          label="Claimed"
          value={items.filter((i) => i.status === "Claimed").length}
        />
        <StatCard label="Campuses" value={uniqueCampuses} />
        <StatCard label="Storage Rooms" value={uniqueStorageRooms} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search..."
          className="px-4 py-2 bg-white dark:bg-gray-800 border rounded flex-1"
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <select
          className="px-4 py-2 bg-white dark:bg-gray-800 border rounded"
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option>All</option>
          <option>Lost</option>
          <option>Found</option>
          <option>Claimed</option>
        </select>

        <select
          className="px-4 py-2 bg-white dark:bg-gray-800 border rounded"
          onChange={(e) => setCampusFilter(e.target.value)}
        >
          <option>All</option>
          {Array.from(new Set(items.map((i) => i.campus_name))).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {!loading && filteredItems.length > 0 && (
        <div className="overflow-auto rounded border bg-white dark:bg-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-200 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 border-b">Name</th>
                <th className="px-4 py-3 border-b">Category</th>
                <th className="px-4 py-3 border-b">Campus</th>
                <th className="px-4 py-3 border-b">Status</th>
                <th className="px-4 py-3 border-b text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredItems.map((item) => (
                <tr
                  key={item.id}
                  className="border-b hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => {
                    setSelectedItem(item);
                    setEditingExpiration(false);
                    setShowModal(true);
                  }}
                >
                  <td className="px-4 py-3 text-ubGold">{item.name}</td>
                  <td className="px-4 py-3">{item.category_name}</td>
                  <td className="px-4 py-3">{item.campus_name}</td>

                  <td className="px-4 py-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs text-white ${
                        item.status === "Claimed"
                          ? "bg-green-600"
                          : item.status === "Lost"
                          ? "bg-yellow-600"
                          : "bg-blue-600"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-right">
                    <button className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ============================================================
         MODAL (NEW 2-COLUMN MODAL – WIDE & CLEAN)
      ============================================================ */}
      {showModal && selectedItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 border rounded-xl w-full max-w-4xl p-6 relative shadow-2xl">
            
            {/* Close Button */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white text-xl"
            >
              ✕
            </button>

            {/* HEADER */}
            <div className="flex gap-6">
              {/* IMAGE */}
              {selectedItem.image && (
                <img
                  src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/item-photos/${selectedItem.image}`}
                  className="w-1/2 h-64 object-cover rounded-lg shadow-md"
                />
              )}

              {/* TITLE + META */}
              <div className="w-1/2 flex flex-col justify-center">
                <h2 className="text-3xl font-bold text-ubGold">
                  {selectedItem.name}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mt-2 text-lg">
                  {selectedItem.category_name} • {selectedItem.campus_name}
                </p>

                <p className="text-md text-gray-400 mt-3">
                  Reported: {formatDate(selectedItem.reported_at)} —{" "}
                  {formatTime(selectedItem.reported_at)}
                </p>
              </div>
            </div>

            {/* 2-COLUMN LAYOUT */}
            <div className="grid grid-cols-2 gap-6 mt-8">

              {/* ITEM INFO */}
              <div className="bg-gray-100 dark:bg-gray-800 border rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-2">Item Information</h3>

                <p className="text-sm">
                  <strong>Status:</strong>{" "}
                  <span
                    className={`px-2 py-1 rounded text-xs text-white ${
                      selectedItem.status === "Claimed"
                        ? "bg-green-600"
                        : selectedItem.status === "Lost"
                        ? "bg-yellow-600"
                        : "bg-blue-600"
                    }`}
                  >
                    {selectedItem.status}
                  </span>
                </p>

                <p className="text-sm mt-2">
                  <strong>Drop-Off:</strong>{" "}
                  {selectedItem.dropoff_location || "N/A"}
                </p>

                <p className="text-sm">
                  <strong>Storage:</strong> {selectedItem.location || "N/A"}
                </p>

                {selectedItem.description && (
                  <p className="text-sm mt-2">
                    <strong>Description:</strong> {selectedItem.description}
                  </p>
                )}
              </div>

              {/* REPORTER INFO */}
              <div className="bg-gray-100 dark:bg-gray-800 border rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-2">
                  Reporter Information
                </h3>

                <p className="text-sm">
                  <strong>Name:</strong>{" "}
                  {selectedItem.reporter_name || "Unknown"}
                </p>

                <p className="text-sm mt-1">
                  <strong>Email:</strong>{" "}
                  <a
                    href={`mailto:${selectedItem.reporter_email}`}
                    className="text-blue-500 underline"
                  >
                    {selectedItem.reporter_email || "N/A"}
                  </a>
                </p>
              </div>

              {/* EXPIRATION */}
              <div className="bg-gray-100 dark:bg-gray-800 border rounded-lg p-4 col-span-2">
                <h3 className="font-semibold text-lg mb-2">Expiration</h3>

                {!editingExpiration ? (
                  <p className="text-sm flex items-center gap-2">
                    <strong>Date:</strong>
                    <span
                      className={getExpirationColor(
                        selectedItem.report?.expiration_date
                      )}
                    >
                      {selectedItem.report?.expiration_date
                        ? formatDate(selectedItem.report.expiration_date)
                        : "—"}
                    </span>

                    <button
                      onClick={() => {
                        setEditingExpiration(true);
                        setNewExpiration(
                          selectedItem.report?.expiration_date
                            ? selectedItem.report.expiration_date.split("T")[0]
                            : ""
                        );
                      }}
                      className="text-blue-500 underline text-sm"
                    >
                      Edit
                    </button>
                  </p>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={newExpiration}
                      onChange={(e) => setNewExpiration(e.target.value)}
                      className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white"
                    />
                    <button
                      onClick={saveExpiration}
                      className="px-3 py-1 bg-green-600 rounded text-white text-sm"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingExpiration(false)}
                      className="px-3 py-1 bg-gray-600 rounded text-white text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* FOOTER BUTTONS */}
            <div className="flex justify-between mt-6">
              <button
                onClick={() => generateItemPDF(selectedItem)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
              >
                Download PDF
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => markAsClaimed(selectedItem.id)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
                >
                  Mark Claimed
                </button>

                <button
                  onClick={() => deleteItem(selectedItem.id)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
                >
                  Delete
                </button>

                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   STAT CARD
============================================================ */
function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 text-center shadow-sm">
      <p className="text-3xl font-bold text-ubGold">{value}</p>
      <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{label}</p>
    </div>
  );
}
