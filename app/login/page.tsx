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

  // 🔥 AUTO-REDIRECT IF LOGGED IN
  useEffect(() => {
    async function redirectIfLoggedIn() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // ❌ Not logged in → stay here
      if (!session) return;

      const user = session.user;

      // 🔥 Fetch profile safely (NO .single())
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      // 🔥 Admin → redirect
      if (profile?.role === "admin") {
        router.replace("/admin");
        return;
      }

      // 🔥 Regular user → redirect
      if (profile?.role === "user") {
        router.replace("/items");
        return;
      }

      // If no profile yet, do nothing
      // (middleware will inject later)
    }

    redirectIfLoggedIn();
  }, [router]);

  // ──────────────────────────────────────────────
  // UB EMAIL LOGIN
  // ──────────────────────────────────────────────

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const trimmedEmail = email.trim().toLowerCase();

    // Switch to admin login mode
    if (trimmedEmail === "admin" || trimmedEmail === "admin@system.local") {
      setAdminMode(true);
      setLoading(false);
      return;
    }

    // Validate UB email
    if (!trimmedEmail.endsWith("@ub.edu.bz")) {
      setMessage("❌ Please use your UB email address or type 'admin'");
      setLoading(false);
      return;
    }

    // Magic link login
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });

    if (error) setMessage(`❌ ${error.message}`);
    else setMessage("✅ Check your UB email for a login link!");

    setLoading(false);
  };

  // ──────────────────────────────────────────────
  // ADMIN LOGIN (PASSWORD)
  // ──────────────────────────────────────────────

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: "admin@system.local",
        password: adminPassword,
      });

      if (error) {
        setMessage("❌ " + error.message);
        setLoading(false);
        return;
      }

      // Verify admin role
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("email", "admin@system.local")
        .maybeSingle();

      if (profileErr || !profile || profile.role !== "admin") {
        setMessage("❌ Unauthorized: not an admin account");
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      // Store fallback session
      if (data.session) {
        localStorage.setItem("isManualAdmin", "true");
        localStorage.setItem("adminSession", JSON.stringify(data.session));
        localStorage.setItem("userRole", "admin");
      }

      setMessage("✅ Welcome, Admin! Redirecting...");
      setTimeout(() => router.push("/admin"), 700);
    } catch {
      setMessage("❌ Login error");
    } finally {
      setLoading(false);
    }
  };

  // ──────────────────────────────────────────────
  // UI
  // ──────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-2 text-gray-900 dark:text-gray-100">
          Jaguar Track Login
        </h1>

        <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
          Sign in using your <strong>@ub.edu.bz</strong> email,  
          or log in as <strong>admin</strong>.
        </p>

        {/* ────────────────────────── */}
        {/* UB EMAIL LOGIN FORM       */}
        {/* ────────────────────────── */}
        {!adminMode ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="text"
              value={email}
              placeholder="you@ub.edu.bz or type 'admin'"
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full p-3 rounded-lg border dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-lg font-medium text-white ${
                loading
                  ? "bg-blue-400 cursor-not-allowed"
                  : "bg-ubBlue hover:bg-blue-700"
              }`}
            >
              {loading ? "Processing..." : "Continue"}
            </button>
          </form>
        ) : (
          // ──────────────────────────
          // ADMIN LOGIN FORM
          // ──────────────────────────
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <input
              type="password"
              placeholder="Enter admin password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              required
              className="w-full p-3 rounded-lg border dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-lg font-medium ${
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

        {/* FEEDBACK */}
        {message && (
          <p
            className={`mt-4 text-center text-sm font-medium ${
              message.startsWith("✅")
                ? "text-green-600"
                : message.startsWith("❌")
                ? "text-red-600"
                : "text-yellow-600"
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
