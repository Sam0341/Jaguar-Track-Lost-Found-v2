"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type UserInfo = {
  id: string;
  email: string;
  last_sign_in_at: string | null;
  role: string | null;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  /* ====================================================
      FETCH ALL USERS FROM AUTH + MATCH PROFILES ROLE
  ===================================================== */
  useEffect(() => {
    async function fetchUsers() {
      setLoading(true);

      try {
        // 1️⃣ Get all auth users
        const { data: authList, error: authErr } =
          await supabase.auth.admin.listUsers();

        if (authErr) throw authErr;

        const authUsers = authList.users;

        // 2️⃣ Get profile roles
        const { data: profiles, error: profErr } = await supabase
          .from("profiles")
          .select("id, role");

        if (profErr) throw profErr;

        // 3️⃣ Merge auth data + profile roles
        const merged = authUsers.map((u) => {
          const profile = profiles.find((p) => p.id === u.id);

          return {
            id: u.id,
            email: u.email!,
            last_sign_in_at: u.last_sign_in_at,
            role: profile?.role || "user",
          };
        });

        setUsers(merged as UserInfo[]);
      } catch (err: any) {
        console.error(err);
        setMessage(err.message);
      }

      setLoading(false);
    }

    fetchUsers();
  }, []);

  /* ====================================================
        UPDATE ROLE
  ===================================================== */
  async function updateRole(userId: string, newRole: string) {
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", userId);

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, role: newRole } : u
        )
      );

      setMessage(`Updated role to ${newRole}.`);
    } catch (err: any) {
      setMessage(err.message);
    }

    setSaving(false);
  }

  /* ====================================================
        FILTER BY SEARCH
  ===================================================== */
  const filteredUsers = users.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-5xl mx-auto text-white">
      <h1 className="text-3xl font-bold mb-4">Admin — Users Management</h1>

      <p className="text-gray-400 mb-6">
        View all users, promote or demote roles, and manage access.
      </p>

      {/* Search Box */}
      <input
        type="text"
        placeholder="Search by email..."
        className="w-full p-3 mb-6 rounded bg-gray-800 border border-gray-700 text-white"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Status Message */}
      {message && (
        <p className="mb-4 text-green-400 font-semibold">{message}</p>
      )}

      {/* Loading */}
      {loading ? (
        <p className="text-gray-400">Loading users...</p>
      ) : (
        <div className="overflow-x-auto bg-gray-900 border border-gray-700 rounded-xl shadow">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-800 text-gray-300">
              <tr>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Last Login</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="py-6 text-center text-gray-400"
                  >
                    No users found.
                  </td>
                </tr>
              )}

              {filteredUsers.map((u) => (
                <tr
                  key={u.id}
                  className="border-t border-gray-800 hover:bg-gray-800"
                >
                  <td className="py-3 px-4">{u.email}</td>
                  <td className="py-3 px-4 capitalize">{u.role}</td>
                  <td className="py-3 px-4">
                    {u.last_sign_in_at
                      ? new Date(u.last_sign_in_at).toLocaleString()
                      : "Never"}
                  </td>

                  <td className="py-3 px-4 text-center flex justify-center gap-2">

                    {/* Promote to Admin */}
                    {u.role !== "admin" && (
                      <button
                        disabled={saving}
                        onClick={() => updateRole(u.id, "admin")}
                        className="bg-yellow-500 px-3 py-1 rounded text-black text-sm"
                      >
                        Make Admin
                      </button>
                    )}

                    {/* Promote to Staff */}
                    {u.role !== "staff" && (
                      <button
                        disabled={saving}
                        onClick={() => updateRole(u.id, "staff")}
                        className="bg-blue-500 px-3 py-1 rounded text-white text-sm"
                      >
                        Make Staff
                      </button>
                    )}

                    {/* Demote to User */}
                    {u.role !== "user" && (
                      <button
                        disabled={saving}
                        onClick={() => updateRole(u.id, "user")}
                        className="bg-red-600 px-3 py-1 rounded text-white text-sm"
                      >
                        Remove Role
                      </button>
                    )}
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
