"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function CreateAdminUserPage() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("admin");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: any) {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      // 1️⃣ Load all Supabase Auth users
      const { data: userList, error: listErr } =
        await supabase.auth.admin.listUsers();

      if (listErr) throw listErr;

      // 2️⃣ Find user by email
      const foundUser = userList.users.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      );

      if (!foundUser) {
        throw new Error(
          "This UB email has never logged in before. Ask them to log in once using the magic link first."
        );
      }

      const userId = foundUser.id;

      // 3️⃣ Update their profile role (RLS will allow because you're admin)
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ role })
        .eq("id", userId);

      if (updateErr) throw updateErr;

      setMessage(
        `Success! ${email} is now assigned the role: ${role.toUpperCase()}.`
      );
      setEmail("");
    } catch (err: any) {
      setMessage(err.message || "Something went wrong.");
    }

    setLoading(false);
  }

  return (
    <div className="p-6 max-w-xl w-full mx-auto text-white">
      <h1 className="text-3xl font-bold mb-4">Create New Admin / Staff</h1>
      <p className="text-gray-400 mb-6">
        Promote an existing UB email account to admin or staff.
      </p>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 bg-gray-900 p-6 rounded-xl border border-gray-700 shadow"
      >
        {/* UB Email */}
        <div>
          <label className="block text-sm text-gray-300 mb-1">UB Email</label>
          <input
            type="email"
            placeholder="you@ub.edu.bz"
            className="w-full p-3 rounded bg-gray-800 border border-gray-700 focus:outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {/* Role Selector */}
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

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 transition px-4 py-3 rounded w-full text-center font-semibold"
        >
          {loading ? "Processing..." : "Assign Role"}
        </button>

        {/* Status Message */}
        {message && (
          <p className="text-center mt-4 text-green-400 font-medium">
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
