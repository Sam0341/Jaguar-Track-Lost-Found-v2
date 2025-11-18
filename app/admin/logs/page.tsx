"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Download,
  Trash2,
  CheckCircle,
  RefreshCcw,
  Edit,
  Eye,
  Info,
  Search,
} from "lucide-react";

type LogEntry = {
  id: string;
  action: string;
  timestamp: string;
  items: {
    id: string;
    name: string | null;
    image: string | null;
    status: string | null;
    campus: string | null;
  } | null;
  performer: { email: string | null } | null;
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("All");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [currentPage, setCurrentPage] = useState(1);
  const logsPerPage = 8;

  const [modalLog, setModalLog] = useState<LogEntry | null>(null);

  /* ------------------------------------------------ */
  /* FETCH LOGS                                       */
  /* ------------------------------------------------ */
  useEffect(() => {
    async function loadLogs() {
      const { data, error } = await supabase
        .from("logs")
        .select(
          `
          id,
          action,
          timestamp,
          items:item_id (
            id,
            name,
            image,
            status,
            campus
          ),
          performer:performed_by (
            email
          )
        `
        )
        .order("timestamp", { ascending: sortOrder === "asc" });

      if (!error && data) {
        const normalized = data.map((log: any) => ({
          id: log.id,
          action: log.action,
          timestamp: log.timestamp,
          items: log.items ?? null,
          performer: log.performer ?? null,
        }));

        setLogs(normalized);
      }

      setLoading(false);
    }

    loadLogs();
  }, [sortOrder]);

  /* ------------------------------------------------ */
  /* FILTERING + SEARCH                               */
  /* ------------------------------------------------ */
  const filteredLogs = logs.filter((log) => {
    const term = search.toLowerCase();

    const matchesSearch =
      log.action.toLowerCase().includes(term) ||
      (log.items?.name || "").toLowerCase().includes(term) ||
      (log.items?.campus || "").toLowerCase().includes(term) ||
      (log.performer?.email || "").toLowerCase().includes(term);

    const matchesAction =
      actionFilter === "All" || log.action === actionFilter;

    return matchesSearch && matchesAction;
  });

  /* ------------------------------------------------ */
  /* PAGINATION                                       */
  /* ------------------------------------------------ */
  const indexOfLast = currentPage * logsPerPage;
  const indexOfFirst = indexOfLast - logsPerPage;
  const pageLogs = filteredLogs.slice(indexOfFirst, indexOfLast);

  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);

  /* ------------------------------------------------ */
  /* CSV EXPORT                                       */
  /* ------------------------------------------------ */
  const exportCSV = () => {
    const headers = [
      "Action",
      "Item",
      "Status",
      "Campus",
      "Performer",
      "Timestamp",
    ];

    const rows = logs.map((l) => [
      `"${l.action}"`,
      `"${l.items?.name || "Unknown"}"`,
      `"${l.items?.status || "N/A"}"`,
      `"${l.items?.campus || "N/A"}"`,
      `"${l.performer?.email || "System"}"`,
      `"${new Date(l.timestamp).toLocaleString()}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `JaguarTrack_Logs_${new Date().toISOString()}.csv`;
    link.click();
  };

  /* ------------------------------------------------ */
  /* ICONS + COLORS                                   */
  /* ------------------------------------------------ */
  const iconForAction = (action: string) => {
    if (action.includes("delete")) return <Trash2 size={18} />;
    if (action.includes("claim")) return <CheckCircle size={18} />;
    if (action.includes("return")) return <RefreshCcw size={18} />;
    if (action.includes("update")) return <Edit size={18} />;
    return <Eye size={18} />;
  };

  const badgeColor = {
    item_deleted: "bg-red-600",
    item_claimed: "bg-green-600",
    item_returned: "bg-blue-600",
    item_updated: "bg-yellow-600",
    report_created: "bg-purple-600",
  };

  /* ------------------------------------------------ */
  /* UI                                               */
  /* ------------------------------------------------ */
  if (loading)
    return (
      <p className="text-center mt-10 text-gray-400 animate-pulse">
        Loading logs…
      </p>
    );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-ubGold">📜 System Logs</h1>

        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow"
        >
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* SEARCH + FILTERS */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="flex items-center bg-gray-900 border border-gray-700 rounded-lg px-3 py-2">
          <Search size={16} className="text-gray-400 mr-2" />
          <input
            placeholder="Search logs…"
            className="bg-transparent outline-none text-white w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        >
          <option>All</option>
          <option>item_claimed</option>
          <option>item_deleted</option>
          <option>item_returned</option>
          <option>item_updated</option>
          <option>report_created</option>
        </select>

        <select
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
        >
          <option value="desc">Newest → Oldest</option>
          <option value="asc">Oldest → Newest</option>
        </select>
      </div>

      {/* LOG CARDS */}
      <div className="space-y-5">
        {pageLogs.map((log) => (
          <div
            key={log.id}
            className="flex gap-4 bg-gray-900 border border-gray-700 hover:border-ubGold p-4 rounded-xl shadow transition-all"
          >
            <div className="w-24 h-24 rounded overflow-hidden bg-gray-800">
              {log.items?.image ? (
                <img
                  src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/item-photos/${log.items.image}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500">
                  No Image
                </div>
              )}
            </div>

            <div className="flex-1">
              <span
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs text-white font-semibold ${badgeColor[
                  log.action as keyof typeof badgeColor
                ] || "bg-gray-600"}`}
              >
                {iconForAction(log.action)}
                {log.action}
              </span>

              <h2 className="text-xl text-ubGold font-bold mt-2">
                {log.items?.name}
              </h2>

              <p className="text-gray-400 text-sm">
                Status: <span className="text-white">{log.items?.status}</span>
              </p>

              <p className="text-gray-400 text-sm">
                Campus:{" "}
                <span className="text-white">{log.items?.campus}</span>
              </p>

              <p className="text-sm text-gray-500 mt-2">
                By: {log.performer?.email || "System"}
              </p>

              <p className="text-xs text-gray-500">
                {new Date(log.timestamp).toLocaleString()}
              </p>
            </div>

            <button
              onClick={() => setModalLog(log)}
              className="text-gray-400 hover:text-white"
            >
              <Info size={22} />
            </button>
          </div>
        ))}

        {filteredLogs.length === 0 && (
          <p className="text-center text-gray-400 py-20">
            No logs found.
          </p>
        )}
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
            className="px-3 py-1 bg-gray-800 text-white rounded disabled:opacity-30"
          >
            Prev
          </button>

          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i + 1)}
              className={`px-3 py-1 rounded ${
                currentPage === i + 1
                  ? "bg-ubGold text-black"
                  : "bg-gray-800 text-white"
              }`}
            >
              {i + 1}
            </button>
          ))}

          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
            className="px-3 py-1 bg-gray-800 text-white rounded disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}

      {/* DETAILS MODAL */}
      {modalLog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 p-6 rounded-xl max-w-lg w-full">
            <h2 className="text-xl font-bold text-ubGold mb-4">
              Log Details
            </h2>

            <p className="text-gray-300 mb-2">
              <b>Action:</b> {modalLog.action}
            </p>

            <p className="text-gray-300 mb-2">
              <b>Item:</b> {modalLog.items?.name}
            </p>

            <p className="text-gray-300 mb-2">
              <b>Status:</b> {modalLog.items?.status}
            </p>

            <p className="text-gray-300 mb-2">
              <b>Campus:</b> {modalLog.items?.campus}
            </p>

            <p className="text-gray-300 mb-2">
              <b>Performed by:</b>{" "}
              {modalLog.performer?.email || "System"}
            </p>

            <p className="text-gray-300 mb-4">
              <b>Timestamp:</b>{" "}
              {new Date(modalLog.timestamp).toLocaleString()}
            </p>

            <button
              className="w-full py-2 mt-2 bg-ubGold text-black rounded-lg font-semibold"
              onClick={() => setModalLog(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
