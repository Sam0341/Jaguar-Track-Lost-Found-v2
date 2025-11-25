"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export const runtime = "nodejs";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"student" | "admin">("student");

  const [email, setEmail] = useState("");
  const [adminEmail, setAdminEmail] = useState("admin@system.local");
  const [adminPassword, setAdminPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // ------------------------------------------------------
  // 🔥 AUTO-REDIRECT IF ALREADY LOGGED IN
  // ------------------------------------------------------
  useEffect(() => {
    async function redirectIfLoggedIn() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const user = session.user;

      // ⭐ FIXED — use EMAIL instead of user.id
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("email", user.email)
        .maybeSingle();

      if (!profile) return;

      if (profile.role === "admin") {
        router.replace("/admin");
        return;
      }

      router.replace("/items");
    }

    redirectIfLoggedIn();
  }, [router]);

  // ------------------------------------------------------
  // 🎓 STUDENT MAGIC LINK LOGIN
  // ------------------------------------------------------
  async function handleStudentLogin(e: any) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const trimmed = email.trim().toLowerCase();

    if (!trimmed.endsWith("@ub.edu.bz")) {
      setMessage("❌ Use your @ub.edu.bz student email.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });

    if (error) setMessage("❌ " + error.message);
    else setMessage("✅ Check your UB email for the login link.");

    setLoading(false);
  }

  // ------------------------------------------------------
  // 🛡️ ADMIN LOGIN
  // ------------------------------------------------------
  async function handleAdminLogin(e: any) {
  e.preventDefault();
  setLoading(true);
  setMessage("");

  let emailToUse = adminEmail;

  // ⭐ If user types just "admin", convert to admin@system.local
  if (adminEmail.trim().toLowerCase() === "admin") {
    emailToUse = "admin@system.local";
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailToUse,
    password: adminPassword,
  });

  if (error) {
    setMessage("❌ Incorrect admin credentials.");
    setLoading(false);
    return;
  }

  // Retrieve role from profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, superadmin")
    .eq("email", emailToUse)
    .maybeSingle();

  if (!profile || (profile.role !== "admin" && profile.superadmin !== true)) {
    setMessage("❌ Unauthorized — not an admin account.");
    await supabase.auth.signOut();
    setLoading(false);
    return;
  }

  setMessage("✅ Welcome Admin! Redirecting...");
  setTimeout(() => router.replace("/admin"), 800);
}
  // ------------------------------------------------------
  // UI
  // ------------------------------------------------------
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-5">
      <div className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-2xl p-8 shadow-lg">

        <h1 className="text-2xl font-bold text-center text-white mb-2">
          Jaguar Track Login
        </h1>

        <p className="text-center text-gray-400 text-sm mb-6">
          {mode === "student"
            ? "Sign in using your @ub.edu.bz email."
            : "Admin access requires email + password."}
        </p>

        {/* Mode Toggle */}
        <div className="flex mb-6">
          <button
            onClick={() => {
              setMode("student");
              setMessage("");
            }}
            className={`flex-1 py-2 rounded-l-lg font-semibold ${
              mode === "student"
                ? "bg-ubBlue text-white"
                : "bg-gray-700 text-gray-300"
            }`}
          >
            Student Login
          </button>

          <button
            onClick={() => {
              setMode("admin");
              setMessage("");
            }}
            className={`flex-1 py-2 rounded-r-lg font-semibold ${
              mode === "admin"
                ? "bg-red-600 text-white"
                : "bg-gray-700 text-gray-300"
            }`}
          >
            Admin Login
          </button>
        </div>

        {/* Student Login */}
        {mode === "student" && (
          <form onSubmit={handleStudentLogin} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@ub.edu.bz"
              required
              className="w-full p-3 rounded-lg bg-gray-900 text-white border border-gray-700"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-ubBlue hover:bg-blue-700 text-white font-semibold rounded-lg"
            >
              {loading ? "Sending..." : "Send Magic Link"}
            </button>
          </form>
        )}

        {/* Admin Login */}
        {mode === "admin" && (
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin email"
              required
              className="w-full p-3 rounded-lg bg-gray-900 text-white border border-gray-700"
            />

            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Admin password"
              required
              className="w-full p-3 rounded-lg bg-gray-900 text-white border border-gray-700"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg"
            >
              {loading ? "Checking..." : "Login as Admin"}
            </button>
          </form>
        )}

        {/* Message / Feedback */}
        {message && (
          <p
            className={`mt-5 text-center font-medium text-sm ${
              message.startsWith("✅")
                ? "text-green-400"
                : "text-red-400"
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
