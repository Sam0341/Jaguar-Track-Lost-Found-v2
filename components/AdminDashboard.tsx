"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { addLog } from "@/lib/logs";

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
   COMPONENT
============================================================ */
export default function AdminDashboard() {
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [campusFilter, setCampusFilter] = useState("All");

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Expiration Editing
  const [editingExpiration, setEditingExpiration] = useState(false);
  const [newExpiration, setNewExpiration] = useState("");

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
          report: item.report
            ? {
                ...item.report,
                handled_by_name,
              }
            : null,
        };
      })
    );

    setItems(itemsWithNames);
    setFilteredItems(itemsWithNames);
    setLoading(false);
  }

  /* ============================================================
     FILTER
  ============================================================ */
  useEffect(() => {
    let filtered = [...items];

    if (statusFilter !== "All") filtered = filtered.filter((i) => i.status === statusFilter);
    if (campusFilter !== "All") filtered = filtered.filter((i) => i.campus_name === campusFilter);

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

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-BZ", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  /** Days left calculation */
  function getDaysLeft(exp?: string | null) {
    if (!exp) return null;
    const today = new Date();
    const target = new Date(exp);
    const diff = target.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /** Toast */
  function showToast(msg: string, type: "success" | "error") {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3500);
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
     CLAIM & DELETE
  ============================================================ */
  async function markAsClaimed(id: string) {
    if (!confirm("Mark as claimed?")) return;

    const { data: auth } = await supabase.auth.getUser();
    const admin = auth?.user;

    const { error } = await supabase.from("items").update({ status: "Claimed" }).eq("id", id);

    if (error) return showToast("Error updating item", "error");

    await addLog("item_claimed", id, admin?.id || "unknown");
    fetchItems();
    setShowModal(false);
    showToast("Item marked as claimed!", "success");
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this?")) return;

    const { data: auth } = await supabase.auth.getUser();
    const admin = auth?.user;

    const { error } = await supabase.from("items").delete().eq("id", id);
    if (error) return showToast("Delete failed", "error");

    await addLog("item_deleted", id, admin?.id || "unknown");
    fetchItems();
    setShowModal(false);
    showToast("Item deleted!", "success");
  }

  /* ============================================================
     COUNTERS
  ============================================================ */
  const uniqueStorageRooms = Array.from(new Set(items.map((i) => i.location).filter(Boolean))).length;
  const uniqueCampuses = Array.from(new Set(items.map((i) => i.campus_name))).length;

  /* ============================================================
     RENDER
  ============================================================ */
  return (
    <div className="p-6 max-w-7xl mx-auto bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-gray-200 min-h-screen">

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

      <h1 className="text-3xl font-bold text-ubGold mb-6">Admin Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard label="Total Items" value={items.length} />
        <StatCard label="Lost" value={items.filter((i) => i.status === "Lost").length} />
        <StatCard label="Found" value={items.filter((i) => i.status === "Found").length} />
        <StatCard label="Claimed" value={items.filter((i) => i.status === "Claimed").length} />
        <StatCard label="Campuses" value={uniqueCampuses} />
        <StatCard label="Storage Rooms" value={uniqueStorageRooms} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search..."
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-gray-900 dark:text-gray-200 flex-1"
        />

        <select
          className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-gray-900 dark:text-gray-200"
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option>All</option>
          <option>Lost</option>
          <option>Found</option>
          <option>Claimed</option>
        </select>

        <select
          className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-gray-900 dark:text-gray-200"
          onChange={(e) => setCampusFilter(e.target.value)}
        >
          <option>All</option>
          {Array.from(new Set(items.map((i) => i.campus_name))).map((campus) => (
            <option key={campus}>{campus}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {!loading && filteredItems.length === 0 && (
        <p className="text-center text-gray-500">No items found.</p>
      )}

      {!loading && filteredItems.length > 0 && (
        <div className="overflow-auto rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              <tr>
                <th className="px-4 py-3 border-b dark:border-gray-700">Name</th>
                <th className="px-4 py-3 border-b dark:border-gray-700">Category</th>
                <th className="px-4 py-3 border-b dark:border-gray-700">Campus</th>
                <th className="px-4 py-3 border-b dark:border-gray-700">Status</th>
                <th className="px-4 py-3 border-b dark:border-gray-700 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredItems.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => {
                    setSelectedItem(item);
                    setEditingExpiration(false);
                    setReportOpen(false);
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
                    <button className="px-3 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-gray-900 dark:text-gray-200">
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
         MODAL
      ============================================================ */}
      {showModal && selectedItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl max-w-lg w-full p-6 relative shadow-2xl text-gray-900 dark:text-gray-100">

            <button
              onClick={() => setShowModal(false)}
              className="absolute top-3 right-4 text-gray-500 dark:text-gray-300 hover:text-black"
            >
              ✕
            </button>

            {selectedItem.image && (
              <img
                src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/item-photos/${selectedItem.image}`}
                className="w-full h-56 object-cover rounded-lg mb-5 border border-gray-300 dark:border-gray-700"
              />
            )}

            <h2 className="text-2xl font-bold text-ubGold">{selectedItem.name}</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {selectedItem.category_name} • {selectedItem.campus_name}
            </p>

            {/* Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Item Info */}
              <div className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3">Item Information</h3>

                <p className="text-sm">
                  <strong>Status:</strong>
                  <span
                    className={`ml-2 px-2 py-1 rounded text-xs text-white ${
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

                <p className="text-sm mt-2"><strong>Drop-Off:</strong> {selectedItem.dropoff_location || "N/A"}</p>
                <p className="text-sm mt-1"><strong>Storage:</strong> {selectedItem.location || "N/A"}</p>
                <p className="text-sm mt-1"><strong>Reported:</strong> {formatDate(selectedItem.reported_at)}</p>

                {selectedItem.description && (
                  <p className="text-sm mt-2"><strong>Description:</strong> {selectedItem.description}</p>
                )}
              </div>

              {/* Reporter Info */}
              <div className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3">Reporter Information</h3>

                <p className="text-sm"><strong>Name:</strong> {selectedItem.reporter_name || "Unknown"}</p>

                <p className="text-sm mt-1">
                  <strong>Email:</strong>{" "}
                  <a href={`mailto:${selectedItem.reporter_email}`} className="text-blue-600 dark:text-blue-400 underline">
                    {selectedItem.reporter_email || "N/A"}
                  </a>
                </p>
              </div>

            </div>

            {/* REPORT DETAILS */}
            {selectedItem.report && (
              <div className="mt-6">

                <button
                  className="w-full flex justify-between items-center bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 p-3 rounded-lg"
                  onClick={() => setReportOpen(!reportOpen)}
                >
                  <span className="font-medium">📄 Report Details</span>
                  <span className={`transition-transform ${reportOpen ? "rotate-90" : ""}`}>▶</span>
                </button>

                {reportOpen && (
                  <div className="mt-3 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-4 text-sm space-y-3">

                    <p><strong>Type:</strong> {selectedItem.report.report_type}</p>

                    {/* ===== EXPIRATION EDITABLE ===== */}
                    <div className="mt-2">
  <strong>Expiration:</strong>{" "}

  {!editingExpiration ? (
    <span className="ml-1">
      {selectedItem.report?.expiration_date
        ? formatDate(selectedItem.report.expiration_date)
        : "—"}
      <button
        onClick={() => {
          setEditingExpiration(true);
          setNewExpiration(
            selectedItem.report?.expiration_date
              ? selectedItem.report.expiration_date.split("T")[0]
              : ""
          );
        }}
        className="ml-3 text-blue-400 hover:text-blue-200 underline text-sm"
      >
        Edit
      </button>
    </span>
  ) : (
    <span className="ml-2 flex items-center gap-2">
      <input
        type="date"
        value={newExpiration}
        onChange={(e) => setNewExpiration(e.target.value)}
        className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-white"
      />
      <button
        onClick={saveExpiration}
        className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-white text-sm"
      >
        Save
      </button>
      <button
        onClick={() => setEditingExpiration(false)}
        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
      >
        Cancel
      </button>
    </span>
  )}
</div>

                    <p><strong>Created:</strong> {formatDate(selectedItem.report.created_at)}</p>
                    <p><strong>Handled By:</strong> {selectedItem.report.handled_by_name || "System"}</p>

                  </div>
                )}
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-300 dark:border-gray-700">
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

              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-400 dark:bg-gray-700 hover:bg-gray-500 rounded text-black dark:text-white"
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

/* ============================================================
   STAT CARD
============================================================ */
function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-4 text-center shadow-sm">
      <p className="text-3xl font-bold text-ubGold">{value}</p>
      <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{label}</p>
    </div>
  );
}
