"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AdminDashboard() {
  const [items, setItems] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // 🧾 Fetch items
        const { data: itemsData, error: itemsError } = await supabase
          .from("items")
          .select("*");
        if (itemsError) throw itemsError;

        // 👤 Fetch users (only available if RLS allows admin access)
        const { data: usersData, error: usersError } = await supabase
          .from("profiles")
          .select("id, full_name, email");
        if (usersError) console.warn("⚠️ No profiles table or not accessible");

        setItems(itemsData || []);
        setUsers(usersData || []);
      } catch (err) {
        console.error("❌ Error loading admin data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) return <div className="p-8 text-center">Loading dashboard...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-ubBlue dark:text-ubGold">
        Admin Dashboard
      </h1>

      {/* Items Section */}
      <div className="mb-10">
        <h2 className="text-2xl font-semibold mb-3">📦 Reported Items</h2>
        <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700">
          <table className="w-full border-collapse">
            <thead className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
              <tr>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Campus</th>
                <th className="p-3 text-left">Reporter</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t dark:border-gray-700">
                  <td className="p-3">{item.name}</td>
                  <td className="p-3">{item.status}</td>
                  <td className="p-3">{item.campus}</td>
                  <td className="p-3">{item.reporter_name || "Unknown"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Users Section (optional) */}
      {users.length > 0 && (
        <div>
          <h2 className="text-2xl font-semibold mb-3">👤 Registered Users</h2>
          <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700">
            <table className="w-full border-collapse">
              <thead className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <tr>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Email</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t dark:border-gray-700">
                    <td className="p-3">{user.full_name || "N/A"}</td>
                    <td className="p-3">{user.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
