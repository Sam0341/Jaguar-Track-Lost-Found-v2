"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  // ✅ If already logged in, redirect to /items
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/items");
    });
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    // Ensure only UB emails can log in
    if (!email.endsWith("@ub.edu.bz")) {
      setMessage("❌ Please use your UB email address");
      setLoading(false);
      return;
    }

    // ✅ Send magic link to user
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`, // where the magic link lands
      },
    });

    if (error) {
      setMessage("❌ " + error.message);
    } else {
      setMessage("✅ Check your UB email for a login link!");
    }

    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto mt-10 card p-6 space-y-4">
      <h1 className="text-2xl font-bold text-center">Jaguar Track Login</h1>
      <p className="text-sm text-gray-600 text-center">
        Sign in using your <strong>@ub.edu.bz</strong> email. You’ll receive a one-time login link.
      </p>

      <form onSubmit={handleLogin} className="space-y-3">
        <input
          type="email"
          placeholder="you@ub.edu.bz"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded p-2"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-500 transition"
        >
          {loading ? "Sending…" : "Send Magic Link"}
        </button>
      </form>

      {message && (
        <p className="text-sm text-center text-gray-700 mt-2">{message}</p>
      )}
    </div>
  );
}
