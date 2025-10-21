"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export const runtime = "nodejs";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [adminMode, setAdminMode] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  // ✅ Redirect logged-in users (normal users)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/items");
    });
  }, [router]);

  // ✅ Handle normal user login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    // 🧩 If "admin" typed, switch to admin mode
    if (email.trim().toLowerCase() === "admin") {
      setAdminMode(true);
      setLoading(false);
      return;
    }

    // ✅ Check UB email
    if (!email.endsWith("@ub.edu.bz")) {
      setMessage("❌ Please use your UB email address");
      setLoading(false);
      return;
    }

    // ✅ Regular user magic link login
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });

    if (error) {
      setMessage(`❌ ${error.message}`);
    } else {
      setMessage("✅ Check your UB email for a login link!");
    }

    setLoading(false);
  };

  // ✅ Handle Admin Login (manual)
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    // ⚙️ Password stored in .env.local as NEXT_PUBLIC_ADMIN_PASSWORD
    const ADMIN_PASSWORD =
      process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "Admin@1234";

    if (adminPassword === ADMIN_PASSWORD) {
      // ✅ Store admin flag in localStorage
      localStorage.setItem("isManualAdmin", "true");

      setMessage("✅ Welcome, Admin!");
      setTimeout(() => {
        router.push("/admin");
      }, 1000);
    } else {
      setMessage("❌ Incorrect admin password");
    }

    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300 px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100 mb-2">
          Jaguar Track Login
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
          Sign in using your <strong>@ub.edu.bz</strong> email, or log in as{" "}
          <strong>admin</strong>.
        </p>

        {/* 🧩 USER LOGIN */}
        {!adminMode ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="text"
              placeholder="you@ub.edu.bz or type 'admin'"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-ubGold focus:outline-none"
              required
            />

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-lg font-medium transition-all duration-200 ${
                loading
                  ? "bg-blue-400 cursor-not-allowed"
                  : "bg-ubBlue hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white"
              }`}
            >
              {loading ? "Processing..." : "Continue"}
            </button>
          </form>
        ) : (
          /* 🧩 ADMIN LOGIN */
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <input
              type="password"
              placeholder="Enter admin password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-red-500 focus:outline-none"
              required
            />

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-lg font-medium transition-all duration-200 ${
                loading
                  ? "bg-red-400 cursor-not-allowed"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }`}
            >
              {loading ? "Checking..." : "Login as Admin"}
            </button>

            <button
              type="button"
              onClick={() => {
                setAdminMode(false);
                setEmail("");
                setMessage("");
              }}
              className="w-full py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-500"
            >
              ← Back to regular login
            </button>
          </form>
        )}

        {/* ✅ Message display */}
        {message && (
          <p
            className={`mt-4 text-center text-sm font-medium ${
              message.startsWith("✅")
                ? "text-green-600 dark:text-green-400"
                : message.startsWith("❌")
                ? "text-red-600 dark:text-red-400"
                : "text-yellow-600 dark:text-yellow-400"
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
