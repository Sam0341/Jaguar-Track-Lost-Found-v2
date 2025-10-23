"use client";

import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";
import { Download, BarChart2, PieChart as PieChartIcon, Calendar } from "lucide-react";

export default function ReportsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartType, setChartType] = useState<"pie" | "bar">("pie");
  const [filter, setFilter] = useState("all");

  const [stats, setStats] = useState({
    total: 0,
    lost: 0,
    found: 0,
    claimed: 0,
    unclaimed: 0,
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/admin/items");
        const json = await res.json();
        if (!json.success) throw new Error(json.error || "Failed to load data");
        setItems(json.items);
        applyFilter(json.items, "all");
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const applyFilter = (data: any[], type: string) => {
    let filtered = [...data];
    const now = new Date();

    if (type === "week") {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      filtered = data.filter((i) => new Date(i.reported_at) >= weekAgo);
    } else if (type === "month") {
      const monthAgo = new Date();
      monthAgo.setMonth(now.getMonth() - 1);
      filtered = data.filter((i) => new Date(i.reported_at) >= monthAgo);
    }

    setFilteredItems(filtered);
    calculateStats(filtered);
  };

  const calculateStats = (data: any[]) => {
    const lost = data.filter((i) => i.status.toLowerCase() === "lost").length;
    const found = data.filter((i) => i.status.toLowerCase() === "found").length;
    const claimed = data.filter((i) => i.status.toLowerCase() === "claimed").length;
    const unclaimed = found - claimed < 0 ? 0 : found - claimed;
    setStats({
      total: data.length,
      lost,
      found,
      claimed,
      unclaimed,
    });
  };

  const downloadCSV = () => {
    const header = "Name,Status,Category,Campus,Reporter,Email,Date\n";
    const rows = filteredItems
      .map(
        (i) =>
          `${i.name},${i.status},${i.category},${i.campus},${i.reporter_name},${i.reporter_email},${i.reported_at}`
      )
      .join("\n");

    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `UB_LostAndFound_Reports_${filter}.csv`;
    link.click();
  };

  const chartData = [
    { name: "Lost", value: stats.lost, color: "#3B82F6" },
    { name: "Found", value: stats.found, color: "#FACC15" },
    { name: "Claimed", value: stats.claimed, color: "#10B981" },
    { name: "Unclaimed", value: stats.unclaimed, color: "#F97316" },
  ];

  if (loading)
    return <div className="text-center mt-10 text-blue-600">Loading reports...</div>;
  if (error)
    return <div className="text-center mt-10 text-red-500">Error: {error}</div>;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-10">
      <h1 className="text-3xl font-bold text-center text-blue-700 dark:text-yellow-400">
        📊 Lost & Found Reports Overview
      </h1>

      {/* Date Filters */}
      <div className="flex justify-center gap-3 flex-wrap mb-6">
        {[
          { key: "all", label: "All Time" },
          { key: "month", label: "This Month" },
          { key: "week", label: "This Week" },
        ].map((btn) => (
          <button
            key={btn.key}
            onClick={() => {
              setFilter(btn.key);
              applyFilter(items, btn.key);
            }}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition ${
              filter === btn.key
                ? "bg-blue-600 text-white dark:bg-yellow-500 dark:text-gray-900"
                : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:opacity-90"
            }`}
          >
            <Calendar size={16} /> {btn.label}
          </button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-center">
          <h3 className="text-2xl font-bold">{stats.total}</h3>
          <p>Total Items</p>
        </div>
        <div className="p-4 rounded-xl bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 text-center">
          <h3 className="text-2xl font-bold">{stats.found}</h3>
          <p>Found</p>
        </div>
        <div className="p-4 rounded-xl bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 text-center">
          <h3 className="text-2xl font-bold">{stats.claimed}</h3>
          <p>Claimed</p>
        </div>
        <div className="p-4 rounded-xl bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 text-center">
          <h3 className="text-2xl font-bold">{stats.unclaimed}</h3>
          <p>Unclaimed</p>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
            Item Distribution Overview
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setChartType("pie")}
              className={`px-3 py-1 rounded-md flex items-center gap-1 text-sm font-medium ${
                chartType === "pie"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
              }`}
            >
              <PieChartIcon size={16} /> Pie
            </button>
            <button
              onClick={() => setChartType("bar")}
              className={`px-3 py-1 rounded-md flex items-center gap-1 text-sm font-medium ${
                chartType === "bar"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
              }`}
            >
              <BarChart2 size={16} /> Bar
            </button>
          </div>
        </div>

        <div className="w-full h-72">
          <ResponsiveContainer>
            {chartType === "pie" ? (
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={110} label>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1E293B",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                />
                <Legend />
              </PieChart>
            ) : (
              <BarChart data={chartData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1E293B",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Download CSV */}
      <div className="text-center">
        <button
          onClick={downloadCSV}
          className="mt-4 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 dark:bg-yellow-500 dark:hover:bg-yellow-600 text-white dark:text-gray-900 px-5 py-2 rounded-lg font-medium transition"
        >
          <Download size={18} /> Download Report
        </button>
      </div>
    </div>
  );
}
