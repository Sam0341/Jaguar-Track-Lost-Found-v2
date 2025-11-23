"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// TYPES
type LogEntry = {
  id: string;
  action: string;
  timestamp: string;
  item: { name: string | null };
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
          item:item_id ( name ),
          performer:performed_by ( email )
        `
        )
        .order("timestamp", { ascending: false });

      if (!error && data) {
        setLogs(
          data.map((log: any) => ({
            id: log.id,
            action: log.action,
            timestamp: log.timestamp,
            item: log.item || { name: null },       // ⭐ FIXED
            performer: log.performer || { email: null }, // ⭐ FIXED
          }))
        );
      }

      setLoading(false);
    }

    loadLogs();
  }, []);

  // Pagination logic
  const indexOfLast = currentPage * logsPerPage;
  const indexOfFirst = indexOfLast - logsPerPage;
  const currentLogs = logs.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(logs.length / logsPerPage);

  // Export CSV
  const exportCSV = () => {
    const headers = ["Action", "Item", "Performer", "Timestamp"];
    const rows = logs.map((l) => [
      `"${l.action}"`,
      `"${l.item?.name || "Unknown"}"`,
      `"${l.performer?.email || "System"}"`,
      `"${new Date(l.timestamp).toLocaleString()}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `JaguarTrack_Logs_${new Date().toISOString()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Badge colors
  const badgeColor = (action: string) => {
    if (action.toLowerCase().includes("delete")) return "bg-red-600";
    if (action.toLowerCase().includes("approve")) return "bg-green-600";
    if (action.toLowerCase().includes("update")) return "bg-blue-600";
    if (action.toLowerCase().includes("claim")) return "bg-yellow-600";
    return "bg-gray-600";
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
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow"
        >
          ⬇ Export CSV
        </button>
      </div>

      {/* Logs Container */}
      <div className="bg-gray-900 p-4 rounded-xl shadow border border-gray-800">
        {logs.length === 0 ? (
          <p className="text-gray-400 text-center py-10">No logs yet.</p>
        ) : (
          <ul className="space-y-4">
            {currentLogs.map((log) => (
              <li
                key={log.id}
                className="p-4 bg-gray-800 rounded-lg border border-gray-700"
              >
                <span
                  className={`px-3 py-1 rounded-full text-xs text-white font-semibold ${badgeColor(
                    log.action
                  )}`}
                >
                  {log.action}
                </span>

                <p className="text-sm text-gray-400 mt-2">
                  Item:{" "}
                  <span className="text-ubGold">
                    {log.item?.name || "Unknown"}
                  </span>
                </p>

                <p className="text-sm text-gray-500">
                  By: {log.performer?.email || "System"}
                </p>

                <p className="text-xs text-gray-500 mt-1">
                  {new Date(log.timestamp).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
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
