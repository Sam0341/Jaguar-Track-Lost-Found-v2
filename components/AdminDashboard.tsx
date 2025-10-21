"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Item = {
  id: string;
  name: string;
  description: string;
  category: string;
  campus: string;
  location: string;
  image?: string;
  status: string;
  reporter_name?: string;
  reporter_email?: string;
  reported_at?: string;
};

export default function AdminDashboard() {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);

  // ✅ Fetch all items
  useEffect(() => {
    async function fetchItems() {
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .order("reported_at", { ascending: false });

      if (error) {
        console.error("Error loading items:", error.message);
      } else {
        setItems(data || []);
      }
      setLoading(false);
    }

    fetchItems();
  }, []);

  // 🧩 Delete an item
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this report?")) return;

    const { error } = await supabase.from("items").delete().eq("id", id);

    if (error) {
      alert("❌ Failed to delete item");
    } else {
      setItems(items.filter((i) => i.id !== id));
      alert("✅ Report deleted successfully");
    }
  };

  // 🧩 Update an item
  const handleUpdate = async () => {
    if (!selectedItem) return;
    const { id, ...fields } = selectedItem;

    const { error } = await supabase.from("items").update(fields).eq("id", id);

    if (error) {
      alert("❌ Update failed: " + error.message);
    } else {
      alert("✅ Item updated successfully!");
      setEditing(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center text-gray-700 dark:text-gray-300 p-8">
        Loading Admin Dashboard...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-ubBlue dark:text-ubGold">
        Admin Dashboard
      </h1>

      <h2 className="text-2xl font-semibold mb-3 flex items-center gap-2">
        📦 Reported Items
        <span className="text-sm text-gray-500 dark:text-gray-400">
          ({items.length} total)
        </span>
      </h2>

      {/* 🧾 Items Table */}
      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700">
        <table className="w-full border-collapse">
          <thead className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Campus</th>
              <th className="p-3 text-left">Reporter</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                <td className="p-3">{item.name}</td>
                <td
                  className={`p-3 font-semibold ${
                    item.status === "Found"
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {item.status}
                </td>
                <td className="p-3">{item.campus}</td>
                <td className="p-3">
                  {item.reporter_name}
                  <br />
                  <span className="text-sm text-gray-500">
                    {item.reporter_email}
                  </span>
                </td>
                <td className="p-3 flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedItem(item);
                      setEditing(false);
                    }}
                    className="text-blue-600 hover:underline"
                  >
                    View
                  </button>
                  <button
                    onClick={() => {
                      setSelectedItem(item);
                      setEditing(true);
                    }}
                    className="text-yellow-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 🧩 Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg max-w-lg w-full p-6 relative">
            <button
              onClick={() => setSelectedItem(null)}
              className="absolute top-3 right-4 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              ✕
            </button>

            {!editing ? (
              <>
                <h3 className="text-2xl font-bold mb-4">
                  {selectedItem.name || "Unnamed Item"}
                </h3>
                {selectedItem.image && (
                  <img
                    src={selectedItem.image}
                    alt={selectedItem.name}
                    className="rounded-lg mb-4"
                  />
                )}
                <p className="text-gray-700 dark:text-gray-300 mb-2">
                  <strong>Description:</strong>{" "}
                  {selectedItem.description || "No description"}
                </p>
                <p className="text-gray-700 dark:text-gray-300 mb-2">
                  <strong>Status:</strong> {selectedItem.status}
                </p>
                <p className="text-gray-700 dark:text-gray-300 mb-2">
                  <strong>Campus:</strong> {selectedItem.campus}
                </p>
                <p className="text-gray-700 dark:text-gray-300 mb-2">
                  <strong>Reporter:</strong> {selectedItem.reporter_name} (
                  {selectedItem.reporter_email})
                </p>
              </>
            ) : (
              <>
                <h3 className="text-xl font-semibold mb-3">✏️ Edit Item</h3>
                <input
                  type="text"
                  value={selectedItem.name}
                  onChange={(e) =>
                    setSelectedItem({ ...selectedItem, name: e.target.value })
                  }
                  className="w-full mb-2 p-2 border rounded"
                />
                <select
                  value={selectedItem.status}
                  onChange={(e) =>
                    setSelectedItem({ ...selectedItem, status: e.target.value })
                  }
                  className="w-full mb-2 p-2 border rounded"
                >
                  <option value="Lost">Lost</option>
                  <option value="Found">Found</option>
                </select>
                <textarea
                  value={selectedItem.description || ""}
                  onChange={(e) =>
                    setSelectedItem({
                      ...selectedItem,
                      description: e.target.value,
                    })
                  }
                  className="w-full mb-2 p-2 border rounded"
                  placeholder="Description"
                ></textarea>
                <button
                  onClick={handleUpdate}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded mr-2"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
