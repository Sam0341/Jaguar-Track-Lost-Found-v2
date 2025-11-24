"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
// import { addLog } from "@/lib/logs";  // optional, uncomment if you want logs

export default function CreateAdminUserPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("admin"); // default: admin
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: any) {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      // 🔍 1 — Validate UB email
      if (!email.endsWith("@ub.edu.bz")) {
        throw new Error("Email must be a UB email (@ub.edu.bz)");
      }

      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }

      // 🟦 2 — Create new user in Auth
      const { data: authData, error: signUpError } =
        await supabase.auth.signUp({
          email,
          password,
        });

      if (signUpError) throw signUpError;

      const userId = authData.user?.id;
      if (!userId) throw new Error("User ID missing from signup.");

      // 🟩 3 — Insert into profiles table
      const { error: profileError } = await supabase.from("profiles").insert({
        id: userId,
        email: email,
        role: role,
        full_name: email.split("@")[0], // optional placeholder
      });

      if (profileError) throw profileError;

      // 🟧 4 — Optional: Add admin log
      /*
      await addLog({
        action: "role_assigned",
        performed_by: currentAdminId,
        description: `Assigned ${role} role to ${email}`,
      });
      */

      setMessage(`Success! ${email} is now registered as ${role}.`);
      setEmail("");
      setPassword("");

    } catch (err: any) {
      setMessage(err.message || "Something went wrong.");
    }

    setLoading(false);
  }

  return (
    <div className="p-6 max-w-xl w-full mx-auto text-white">
      <h1 className="text-3xl font-bold mb-4">Create New Admin / Staff</h1>
      <p className="text-gray-400 mb-6">
        Add a new user with UB email and assign their system role.
      </p>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 bg-gray-900 p-6 rounded-xl border border-gray-700 shadow"
      >
        {/* Email */}
        <div>
          <label className="block text-sm text-gray-300 mb-1">UB Email</label>
          <input
            type="email"
            placeholder="example@ub.edu.bz"
            className="w-full p-3 rounded bg-gray-800 border border-gray-700 focus:outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm text-gray-300 mb-1">
            Temporary Password
          </label>
          <input
            type="password"
            placeholder="Min. 6 characters"
            className="w-full p-3 rounded bg-gray-800 border border-gray-700 focus:outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {/* Role Dropdown */}
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
          <p className="text-center mt-4 text-green-400 font-medium">
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
