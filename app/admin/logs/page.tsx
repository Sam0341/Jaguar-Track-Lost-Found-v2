"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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

  useEffect(() => {
    async function loadLogs() {
      const { data, error } = await supabase
        .from("logs")
        .select(`
          id,
          action,
          timestamp,
          item: item_id ( name ),
          performer: performed_by ( email )
        `)
        .order("timestamp", { ascending: false });

      if (!error && data) {
        const formattedLogs: LogEntry[] = data.map((log: any) => ({
          id: log.id,
          action: log.action,
          timestamp: log.timestamp,
          item: log.item?.[0] || { name: null },
          performer: log.performer?.[0] || { email: null },
        }));
        setLogs(formattedLogs);
      }
      setLoading(false);
    }

    loadLogs();
  }, []);

  if (loading) return <p className="text-center mt-10 text-gray-400">Loading logs…</p>;

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold text-ubGold mb-6">📜 System Logs</h1>

      <div className="bg-gray-900 p-4 rounded-xl shadow border border-gray-800">
        {logs.length === 0 ? (
          <p className="text-gray-400 text-center py-10">No logs yet.</p>
        ) : (
          <ul className="space-y-4">
            {logs.map((log) => (
              <li
                key={log.id}
                className="p-4 bg-gray-800 rounded-lg border border-gray-700"
              >
                <p className="text-white">
                  {log.action}
                </p>

                <p className="text-sm text-gray-400 mt-1">
                  Item: <span className="text-ubGold">{log.item?.name || "Unknown"}</span>
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
    </div>
  );
}
