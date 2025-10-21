"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AdminDashboard() {
  const [items, setItems] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // 🛡️ Ensure admin access
        const isAdmin = localStorage.getItem("isManualAdmin");
        if (isAdmin !== "true") {
          setError("Access denied. Admins only.");
          setLoading(false);
          return;
        }

        // 📦 Fetch all items with details
        const { data: itemsData, error: itemsError } = await supabase
          .from("items")
          .select(
            `
            id,
            name,
            description,
            category,
            campus,
            location,
            image,
            status,
            reporter_name,
            reporter_email,
            created_at,
            claimed_by,
            claimed_at
          `
          )
          .order("created_at", { ascending: false });

        if (itemsError) throw itemsError;

        // 👤 Fetch all users (optional)
        const { data: usersData, error: usersError } = await supabase
          .from("profiles")
          .select("id, full_name, email, role, created_at")
          .order("created_at", { ascending: false });

        if (usersError) console.warn("⚠️ Could not load users:", usersError);

        setItems(itemsData || []);
        setUsers(usersData || []);
      } catch (err: any) {
        console.error("❌ Error loading admin data:", err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading)
    return (
      <div className="p-8 text-center text-gray-700 dark:text-gray-300">
        Loading admin dashboard...
      </div>
    );

  if (error)
    return (
      <div className="p-8 text-center text-red-600 dark:text-red-400 font-semibold">
        {error}
      </div>
    );

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-ubBlue dark:text-ubGold">
        Admin Dashboard
      </h1>

      {/* Reported Items Section */}
      <section className="mb-10">
        <h2 className="text-2xl font-semibold mb-3 flex items-center gap-2">
          📦 Reported Items
          <span className="text-sm text-gray-500 dark:text-gray-400">
            ({items.length} total)
          </span>
        </h2>

        <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700">
          <table className="w-full border-collapse">
            <thead className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
              <tr>
                <th className="p-3 text-left">Name</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Campus</th>
                <th className="p-3 text-left">Reporter</th>
                <th className="p-3 text-left">Reported At</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  <td className="p-3">{item.name || "Untitled"}</td>
                  <td
                    className={`p-3 font-medium ${
                      item.status === "Found"
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {item.status}
                  </td>
                  <td className="p-3">{item.campus || "—"}</td>
                  <td className="p-3">
                    {item.reporter_name || "Unknown"} <br />
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {item.reporter_email}
                    </span>
                  </td>
                  <td className="p-3 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(item.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Registered Users Section */}
      {users.length > 0 && (
        <section>
          <h2 className="text-2xl font-semibold mb-3 flex items-center gap-2">
            👥 Registered Users
            <span className="text-sm text-gray-500 dark:text-gray-400">
              ({users.length})
            </span>
          </h2>

          <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700">
            <table className="w-full border-collapse">
              <thead className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <tr>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-left">Email</th>
                  <th className="p-3 text-left">Role</th>
                  <th className="p-3 text-left">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                  >
                    <td className="p-3">{user.full_name || "N/A"}</td>
                    <td className="p-3">{user.email}</td>
                    <td
                      className={`p-3 ${
                        user.role === "admin"
                          ? "text-yellow-600 dark:text-yellow-400 font-semibold"
                          : ""
                      }`}
                    >
                      {user.role || "user"}
                    </td>
                    <td className="p-3 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
