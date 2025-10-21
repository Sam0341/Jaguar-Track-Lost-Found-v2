"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { toast, Toaster } from "react-hot-toast";

type Item = {
  id: string;
  name: string;
  description: string;
  category: string;
  campus: string;
  location: string;
  image: string;
  status: string;
  reporter_name: string;
  reporter_email: string;
  reported_at: string;
};

export default function ReportsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchItems() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || user.user_metadata?.role !== "admin") {
        router.push("/");
        return;
      }

      const { data, error } = await supabase
        .from("items")
        .select("*")
        .order("reported_at", { ascending: false });

      if (error) {
        console.error("Error fetching items:", error);
        toast.error("Failed to load reports");
      } else {
        setItems(data || []);
      }

      setLoading(false);
    }

    fetchItems();
  }, [router]);

  // 🔍 Filter logic
  const filteredItems = items.filter((item) => {
    const term = searchTerm.toLowerCase();
    return (
      item.name.toLowerCase().includes(term) ||
      (item.reporter_name || "").toLowerCase().includes(term) ||
      (item.reporter_email || "").toLowerCase().includes(term)
    );
  });

  async function updateStatus(id: string, newStatus: string) {
    const { error } = await supabase
      .from("items")
      .update({ status: newStatus })
      .eq("id", id);

    if (!error) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: newStatus } : item
        )
      );
      toast.success(`Status updated to ${newStatus}`);
    } else {
      console.error(error);
      toast.error("Failed to update status");
    }
  }

  async function deleteItem(id: string) {
    if (!confirm("Are you sure you want to delete this item?")) return;
    const { error } = await supabase.from("items").delete().eq("id", id);

    if (!error) {
      setItems((prev) => prev.filter((item) => item.id !== id));
      toast.success("Item deleted successfully");
    } else {
      console.error(error);
      toast.error("Failed to delete item");
    }
  }

  if (loading)
    return (
      <div className="text-center text-blue-600 dark:text-ubGold mt-10 animate-pulse">
        Loading reported items...
      </div>
    );

  return (
    <div className="max-w-7xl mx-auto p-6">
      <Toaster position="bottom-right" toastOptions={{ duration: 3000 }} />

      <h1 className="text-3xl font-bold text-ubBlue dark:text-ubGold mb-6 text-center">
        Admin Reports Panel
      </h1>

      {/* 🔍 Search Bar */}
      <div className="flex justify-center mb-6">
        <input
          type="text"
          placeholder="Search by item name, reporter name, or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:w-1/2 p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-ubGold"
        />
      </div>

      {filteredItems.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400">
          No reported items found.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
            <thead className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              <tr>
                <th className="px-4 py-2 text-left">Item Name</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Campus</th>
                <th className="px-4 py-2">Reporter</th>
                <th className="px-4 py-2">Email (Admin only)</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  <td className="px-4 py-2 font-medium">{item.name}</td>
                  <td className="px-4 py-2">
                    <select
                      value={item.status}
                      onChange={(e) => updateStatus(item.id, e.target.value)}
                      className="border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 text-sm bg-white dark:bg-gray-900"
                    >
                      <option value="lost">Lost</option>
                      <option value="found">Found</option>
                      <option value="claimed">Claimed</option>
                    </select>
                  </td>
                  <td className="px-4 py-2">{item.campus}</td>
                  <td className="px-4 py-2">{item.reporter_name || "Unknown"}</td>
                  <td className="px-4 py-2 text-blue-600 dark:text-ubGold">
                    {item.reporter_email || "Hidden"}
                  </td>
                  <td className="px-4 py-2 flex gap-2">
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
