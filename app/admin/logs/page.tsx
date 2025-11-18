"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Download, Trash2, CheckCircle, RefreshCcw, Edit, Eye } from "lucide-react";

type LogEntry = {
  id: string;
  action: string;
  timestamp: string;
  items: {
    name: string | null;
    image: string | null;
    status: string | null;
    campus: string | null;
  };
  performer: { email: string | null };
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const logsPerPage = 8;

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
            name,
            image,
            status,
            campus
          ),
          performer:performed_by ( email )
        `
        )
        .order("timestamp", { ascending: false });

      if (!error && data) {
        // 🔥 Normalize data so TS never breaks
        const fixed = data.map((log: any) => ({
          id: log.id,
          action: log.action,
          timestamp: log.timestamp,

          items: log.items ?? {
            name: null,
            image: null,
            status: null,
            campus: null,
          },

          performer: log.performer ?? {
            email: null,
          },
        }));

        setLogs(fixed);
      }

      setLoading(false);
    }

    loadLogs();
  }, []);

  const indexOfLast = currentPage * logsPerPage;
  const indexOfFirst = indexOfLast - logsPerPage;
  const currentLogs = logs.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(logs.length / logsPerPage);

  // CSV EXPORT
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
      `"${l.items.name || "Unknown"}"`,
      `"${l.items.status || "N/A"}"`,
      `"${l.items.campus || "N/A"}"`,
      `"${l.performer.email || "System"}"`,
      `"${new Date(l.timestamp).toLocaleString()}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `JaguarTrack_SystemLogs_${new Date().toISOString()}.csv`;
    link.click();
  };

  const actionStyle = {
    item_deleted: "bg-red-600",
    item_claimed: "bg-green-600",
    item_returned: "bg-blue-600",
    item_updated: "bg-yellow-600",
    report_created: "bg-purple-600",
  };

  const actionIcon = (action: string) => {
    if (action.includes("delete")) return <Trash2 size={16} />;
    if (action.includes("claim")) return <CheckCircle size={16} />;
    if (action.includes("return")) return <RefreshCcw size={16} />;
    if (action.includes("update")) return <Edit size={16} />;
    return <Eye size={16} />;
  };

  if (loading)
    return <p className="text-center mt-10 text-gray-400">Loading logs…</p>;

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-ubGold">📜 System Logs</h1>

        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow"
        >
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Logs */}
      <div className="space-y-4">
        {currentLogs.map((log) => (
          <div
            key={log.id}
            className="flex gap-4 bg-gray-900 border border-gray-700 p-4 rounded-xl shadow"
          >
            {/* ITEM IMAGE */}
            <div className="w-20 h-20 rounded overflow-hidden bg-gray-800">
              {log.items.image ? (
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

            {/* DETAILS */}
            <div className="flex-1">
              <span
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs text-white font-semibold ${actionStyle[
                  log.action as keyof typeof actionStyle
                ] || "bg-gray-600"}`}
              >
                {actionIcon(log.action)}
                {log.action}
              </span>

              <h2 className="text-lg text-ubGold font-bold mt-2">
                {log.items.name || "Unknown Item"}
              </h2>

              <p className="text-gray-400 text-sm">
                Status:{" "}
                <span className="text-white">{log.items.status || "N/A"}</span>
              </p>

              <p className="text-gray-400 text-sm">
                Campus:{" "}
                <span className="text-white">{log.items.campus || "N/A"}</span>
              </p>

              <p className="text-sm text-gray-500 mt-1">
                By: {log.performer.email || "System"}
              </p>

              <p className="text-xs text-gray-500">
                {new Date(log.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
        ))}

        {logs.length === 0 && (
          <p className="text-gray-400 text-center py-10">No logs yet.</p>
        )}
      </div>

      {/* Pagination */}
      {logs.length > logsPerPage && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
            className="px-3 py-1 bg-gray-700 text-white rounded disabled:opacity-40"
          >
            Prev
          </button>

          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i + 1)}
              className={`px-3 py-1 rounded ${
                currentPage === i + 1
                  ? "bg-ubGold text-black font-bold"
                  : "bg-gray-700 text-white hover:bg-gray-600"
              }`}
            >
              {i + 1}
            </button>
          ))}

          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
            className="px-3 py-1 bg-gray-700 text-white rounded disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
