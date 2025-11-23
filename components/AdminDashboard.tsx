"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { addLog } from "@/lib/logs";

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
    description: string;
    storage_location: string;
    expiration_date: string | null;
    created_at: string;
    handled_by: string | null;
    handled_by_name?: string | null;
  } | null;
};

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
          description,
          storage_location,
          expiration_date,
          created_at,
          handled_by
        )
      `)
      .order("reported_at", { ascending: false });

    if (error) {
      console.error("Error:", error);
      setLoading(false);
      return;
    }

    const itemsWithHandledBy = await Promise.all(
      (data || []).map(async (item: any) => {
        let handled_by_name = null;

        if (item.report?.handled_by) {
          const { data: handler } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", item.report.handled_by)
            .single();

          handled_by_name = handler?.full_name || "Unknown Admin";
        }

        return {
          ...item,
          category_name: item.categories?.name || "Unknown",
          campus_name: item.campuses?.name || "Unknown",
          report: item.report
            ? {
                ...item.report,
                handled_by_name,
              }
            : null,
        };
      })
    );

    setItems(itemsWithHandledBy);
    setFilteredItems(itemsWithHandledBy);
    setLoading(false);
  }

  useEffect(() => {
    let filtered = [...items];

    if (statusFilter !== "All") filtered = filtered.filter((item) => item.status === statusFilter);
    if (campusFilter !== "All") filtered = filtered.filter((item) => item.campus_name === campusFilter);

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

  const formatDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString("en-BZ", { month: "short", day: "numeric", year: "numeric" }) : "—";

  async function markAsClaimed(id: string) {
    if (!confirm("Mark this item as claimed?")) return;

    const { data: authData } = await supabase.auth.getUser();
    const admin = authData?.user;

    const { error } = await supabase.from("items").update({ status: "Claimed" }).eq("id", id);

    if (!error) {
      await addLog("item_claimed", id, admin?.id || "unknown");
      showToast("Item marked as claimed!", "success");
      setShowModal(false);
      fetchItems();
    } else showToast("Error updating item", "error");
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this item?")) return;

    const { data: authData } = await supabase.auth.getUser();
    const admin = authData?.user;

    const { error } = await supabase.from("items").delete().eq("id", id);

    if (!error) {
      await addLog("item_deleted", id, admin?.id || "unknown");
      showToast("Item deleted!", "success");
      setShowModal(false);
      fetchItems();
    } else showToast("Delete failed", "error");
  }

  function showToast(msg: string, type: "success" | "error") {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // Count unique storage rooms
  const uniqueStorageRooms = Array.from(new Set(items.map((i) => i.location).filter(Boolean))).length;

  // Count campuses
  const uniqueCampuses = Array.from(new Set(items.map((i) => i.campus_name))).length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-ubGold mb-6">Admin Dashboard</h1>

      {toast && (
        <div
          className={`fixed top-5 right-5 px-4 py-2 rounded shadow-lg text-white ${
            toast.type === "success" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* ======= TOP STATS ROW (C1) ======= */}
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
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white flex-1"
          placeholder="Search by name or reporter..."
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <select
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white"
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option>All</option>
          <option>Lost</option>
          <option>Found</option>
          <option>Claimed</option>
        </select>

        <select
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white"
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
        <p className="text-center text-gray-400">No items found.</p>
      )}

      {!loading && filteredItems.length > 0 && (
        <div className="overflow-auto rounded border border-gray-700">
          <table className="w-full text-sm text-gray-300">
            <thead className="bg-gray-800 text-gray-200">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Campus</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredItems.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-gray-700 hover:bg-gray-800 cursor-pointer"
                  onClick={() => {
                    setSelectedItem(item);
                    setReportOpen(false);
                    setShowModal(true);
                  }}
                >
                  <td className="px-4 py-3 text-ubGold">{item.name}</td>
                  <td className="px-4 py-3">{item.category_name}</td>
                  <td className="px-4 py-3">{item.campus_name}</td>

                  <td className="px-4 py-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs ${
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
                    <button className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-white">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ================= MODAL ================= */}
      {showModal && selectedItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-2xl w-full p-6 relative shadow-2xl">

            <button
              onClick={() => setShowModal(false)}
              className="absolute top-3 right-4 text-gray-400 text-xl hover:text-white"
            >
              ✕
            </button>

            {selectedItem.image && (
              <img
                src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/item-photos/${selectedItem.image}`}
                className="w-full h-60 object-cover rounded-lg mb-5 border border-gray-700"
              />
            )}

            <h2 className="text-3xl font-bold text-ubGold mb-1">{selectedItem.name}</h2>
            <p className="text-gray-400 mb-4 text-sm">
              {selectedItem.category_name} • {selectedItem.campus_name}
            </p>

            {/* INFO CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3">Item Information</h3>
                <p className="text-sm text-gray-300">
                  <strong>Status:</strong>
                  <span
                    className={`ml-2 px-2 py-1 rounded text-xs ${
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

                <p className="text-sm text-gray-300 mt-2">
                  <strong>Drop-Off:</strong> {selectedItem.dropoff_location || "N/A"}
                </p>
                <p className="text-sm text-gray-300 mt-1">
                  <strong>Storage:</strong> {selectedItem.location || "N/A"}
                </p>
                <p className="text-sm text-gray-300 mt-1">
                  <strong>Reported:</strong> {formatDate(selectedItem.reported_at)}
                </p>

                {selectedItem.description && (
                  <p className="text-sm text-gray-300 mt-2">
                    <strong>Description:</strong> {selectedItem.description}
                  </p>
                )}
              </div>

              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-3">Reporter Information</h3>
                <p className="text-sm text-gray-300"><strong>Name:</strong> {selectedItem.reporter_name || "Unknown"}</p>
                <p className="text-sm text-gray-300 mt-1">
                  <strong>Email:</strong>{" "}
                  <a href={`mailto:${selectedItem.reporter_email}`} className="text-blue-400 underline">
                    {selectedItem.reporter_email || "N/A"}
                  </a>
                </p>
              </div>

            </div>

            {/* REPORT DETAILS */}
            {selectedItem.report && (
              <div className="mt-6">
                <button
                  className="w-full flex justify-between items-center bg-gray-800 border border-gray-700 p-3 rounded-lg"
                  onClick={() => setReportOpen(!reportOpen)}
                >
                  <span className="text-white font-medium">📄 Report Details</span>
                  <span className={`transition-transform ${reportOpen ? "rotate-90" : ""}`}>▶</span>
                </button>

                {reportOpen && (
                  <div className="mt-3 bg-gray-800 border border-gray-700 rounded-lg p-4 text-sm space-y-2">
                    <p><strong>Type:</strong> {selectedItem.report.report_type}</p>
                    <p><strong>Description:</strong> {selectedItem.report.description || "N/A"}</p>
                    <p><strong>Storage Location:</strong> {selectedItem.report.storage_location}</p>
                    <p><strong>Expiration:</strong> {formatDate(selectedItem.report.expiration_date)}</p>
                    <p><strong>Created:</strong> {formatDate(selectedItem.report.created_at)}</p>
                    <p><strong>Handled By:</strong> {selectedItem.report.handled_by_name}</p>
                  </div>
                )}
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-700">
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
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white"
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

/* ===== STAT CARD COMPONENT ===== */
function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
      <p className="text-3xl font-bold text-ubGold">{value}</p>
      <p className="text-gray-400 text-sm mt-1">{label}</p>
    </div>
  );
}
