"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function CreateAdminUserPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("admin");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [requesterId, setRequesterId] = useState<string | null>(null);

  // Load logged-in user
  useEffect(() => {
    async function loadUser() {
      const { data: { session } } = await supabase.auth.getSession();
      setRequesterId(session?.user?.id || null);
    }
    loadUser();
  }, []);

  async function handleSubmit(e: any) {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    if (!requesterId) {
      setMessage("❌ Unable to verify your admin identity.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role, requesterId }),
      });

      const json = await res.json();

      if (!res.ok) throw new Error(json.error);

      setMessage(`✅ Successfully created account for ${email} with role: ${role}`);
      setEmail("");
      setPassword("");

    } catch (err: any) {
      setMessage(`❌ ${err.message}`);
    }

    setLoading(false);
  }

  return (
    <div className="p-6 max-w-xl w-full mx-auto text-white">
      <h1 className="text-3xl font-bold mb-4">Create New Admin / Staff</h1>
      <p className="text-gray-400 mb-6">
        Create a new admin or staff account with email + password.
      </p>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 bg-gray-900 p-6 rounded-xl border border-gray-700 shadow"
      >
        {/* Email */}
        <div>
          <label className="block text-sm text-gray-300 mb-1">Email</label>
          <input
            type="email"
            placeholder="user@example.com"
            className="w-full p-3 rounded bg-gray-800 border border-gray-700 focus:outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm text-gray-300 mb-1">Password</label>
          <input
            type="password"
            placeholder="Set user password"
            className="w-full p-3 rounded bg-gray-800 border border-gray-700 focus:outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {/* Role */}
        <div>
          <label className="block text-sm text-gray-300 mb-1">Role</label>
          <select
            className="w-full p-3 rounded bg-gray-800 border border-gray-700 focus:outline-none"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
          </select>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 transition px-4 py-3 rounded w-full text-center font-semibold"
        >
          {loading ? "Creating..." : "Create User"}
        </button>

        {/* Message */}
        {message && (
          <p
            className={`text-center mt-4 font-medium ${
              message.startsWith("✅") ? "text-green-400" : "text-red-400"
            }`}
          >
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
