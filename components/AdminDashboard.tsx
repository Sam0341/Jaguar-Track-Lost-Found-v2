"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { addLog } from "@/lib/logs";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

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

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(
    null
  );

  const [editingExpiration, setEditingExpiration] = useState(false);
  const [newExpiration, setNewExpiration] = useState("");

  const pdfRef = useRef<HTMLDivElement>(null);

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

    const mapped = await Promise.all(
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
            ? { ...item.report, handled_by_name }
            : null,
        };
      })
    );

    setItems(mapped);
    setFilteredItems(mapped);
    setLoading(false);
  }

  /* ============================================================
     FILTERING
  ============================================================ */
  useEffect(() => {
    let f = [...items];

    if (statusFilter !== "All") f = f.filter((i) => i.status === statusFilter);
    if (campusFilter !== "All") f = f.filter((i) => i.campus_name === campusFilter);

    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      f = f.filter(
        (i) =>
          i.name.toLowerCase().includes(t) ||
          (i.reporter_name || "").toLowerCase().includes(t) ||
          (i.reporter_email || "").toLowerCase().includes(t)
      );
    }

    setFilteredItems(f);
  }, [items, searchTerm, statusFilter, campusFilter]);

  /* ============================================================
     HELPERS
  ============================================================ */
  const formatDate = (d?: string | null) =>
    d
      ? new Date(d).toLocaleDateString("en-BZ", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const getDaysLeft = (d?: string | null) => {
    if (!d) return null;
    const today = new Date();
    const exp = new Date(d);
    const diff = exp.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  /* ============================================================
     SAVE EXPIRATION
  ============================================================ */
  async function saveExpiration() {
    if (!selectedItem?.report) return;

    const { error } = await supabase
      .from("reports")
      .update({ expiration_date: newExpiration })
      .eq("item_id", selectedItem.id);

    if (error) return showToast("Failed to update expiration", "error");

    showToast("Expiration updated!", "success");
    setEditingExpiration(false);
    fetchItems();
  }

  /* ============================================================
     DOWNLOAD PDF (Option A)
  ============================================================ */
  async function downloadPDF() {
    if (!pdfRef.current) return;

    const canvas = await html2canvas(pdfRef.current);
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");
    const width = pdf.internal.pageSize.getWidth();
    const height = (canvas.height * width) / canvas.width;

    pdf.addImage(imgData, "PNG", 0, 0, width, height);
    pdf.save(`${selectedItem?.name}-report.pdf`);
  }

  /* ============================================================
     MARK CLAIMED + DELETE
  ============================================================ */
  async function markAsClaimed(id: string) {
    if (!confirm("Mark this item as claimed?")) return;

    await supabase.from("items").update({ status: "Claimed" }).eq("id", id);
    fetchItems();
    setShowModal(false);
    showToast("Item marked as claimed!", "success");
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this item?")) return;

    await supabase.from("items").delete().eq("id", id);
    fetchItems();
    setShowModal(false);
    showToast("Item deleted!", "success");
  }

  /* ============================================================
     COUNTS
  ============================================================ */
  const uniqueStorageRooms = Array.from(new Set(items.map((i) => i.location))).length;
  const uniqueCampuses = Array.from(new Set(items.map((i) => i.campus_name))).length;

  /* ============================================================
     RENDER
  ============================================================ */
  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* TOAST */}
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

      {/* Filters & Stats skipped here for brevity */}

      {/* ======================= MODAL ======================= */}
      {showModal && selectedItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-xl p-5 shadow-xl relative">

            {/* CLOSE */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute right-4 top-3 text-gray-500 hover:text-black"
            >
              ✕
            </button>

            {/* PDF CONTENT */}
            <div ref={pdfRef} className="p-3">

              {selectedItem.image && (
                <img
                  src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/item-photos/${selectedItem.image}`}
                  className="w-full h-48 object-cover rounded mb-4 border"
                />
              )}

              <h2 className="text-xl font-bold text-ubGold">{selectedItem.name}</h2>
              <p className="text-sm text-gray-600 mb-3">
                {selectedItem.category_name} • {selectedItem.campus_name}
              </p>

              {/* ===== Item Info ===== */}
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-3 text-sm">
                <h3 className="font-semibold mb-2">Item Information</h3>

                <p>
                  <strong>Status:</strong>{" "}
                  <span
                    className={`px-2 py-1 rounded text-white text-xs ${
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

                <p className="mt-1"><strong>Drop-Off:</strong> {selectedItem.dropoff_location || "N/A"}</p>
                <p className="mt-1"><strong>Storage:</strong> {selectedItem.location || "N/A"}</p>
                <p className="mt-1"><strong>Reported:</strong> {formatDate(selectedItem.reported_at)}</p>
                <p className="mt-1"><strong>Description:</strong> {selectedItem.description || "—"}</p>
              </div>

              {/* ===== Reporter Info ===== */}
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-3 text-sm">
                <h3 className="font-semibold mb-2">Reporter Information</h3>
                <p><strong>Name:</strong> {selectedItem.reporter_name || "Unknown"}</p>
                <p className="mt-1">
                  <strong>Email:</strong>{" "}
                  <a href={`mailto:${selectedItem.reporter_email}`} className="text-blue-500 underline">
                    {selectedItem.reporter_email}
                  </a>
                </p>
              </div>

              {/* ===== Report Details ===== */}
              {selectedItem.report && (
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 text-sm">
                  <h3 className="font-semibold mb-2">Report Details</h3>

                  <p><strong>Type:</strong> {selectedItem.report.report_type}</p>

                  <p className="mt-1">
                    <strong>Expiration:</strong>{" "}
                    {selectedItem.report.expiration_date
                      ? `${formatDate(selectedItem.report.expiration_date)} (${getDaysLeft(
                          selectedItem.report.expiration_date
                        )} days left)`
                      : "—"}
                  </p>

                  {/* Editable expiration */}
                  {!editingExpiration ? (
                    <button
                      className="text-blue-500 underline text-sm mt-1"
                      onClick={() => {
                        setEditingExpiration(true);
                        setNewExpiration(
                          selectedItem.report?.expiration_date
                            ? selectedItem.report.expiration_date.split("T")[0]
                            : ""
                        );
                      }}
                    >
                      Edit Expiration
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="date"
                        value={newExpiration}
                        onChange={(e) => setNewExpiration(e.target.value)}
                        className="border rounded px-2 py-1"
                      />
                      <button
                        onClick={saveExpiration}
                        className="px-3 py-1 bg-green-600 text-white rounded"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingExpiration(false)}
                        className="px-3 py-1 bg-gray-400 rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  <p className="mt-2"><strong>Created:</strong> {formatDate(selectedItem.report.created_at)}</p>
                  <p><strong>Handled By:</strong> {selectedItem.report.handled_by_name}</p>
                </div>
              )}
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex justify-between mt-5">
              <button
                onClick={downloadPDF}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Download PDF
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => markAsClaimed(selectedItem.id)}
                  className="px-4 py-2 bg-green-600 text-white rounded"
                >
                  Mark as Claimed
                </button>

                <button
                  onClick={() => deleteItem(selectedItem.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded"
                >
                  Delete
                </button>

                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-400 rounded"
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
    <div className="bg-gray-100 dark:bg-gray-800 border rounded-lg p-4 text-center shadow-sm">
      <p className="text-2xl font-bold text-ubGold">{value}</p>
      <p className="text-gray-600 dark:text-gray-400">{label}</p>
    </div>
  );
}
