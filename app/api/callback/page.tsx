"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export const runtime = "nodejs"; // ✅ prevents Edge runtime issues

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    async function handleAuthCallback() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (!code) {
        console.warn("⚠️ No auth code found in URL.");
        router.push("/login");
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("❌ Error exchanging code:", error.message);
        router.push("/login");
      } else {
        console.log("✅ Login successful!");
        router.push("/"); // redirect to homepage or /items
      }
    }

    handleAuthCallback();
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-gray-600 dark:text-gray-300">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-2">Logging you in...</h1>
        <p className="text-sm">Please wait while we complete your authentication.</p>
        <div className="mt-4 animate-spin h-6 w-6 border-4 border-ubBlue border-t-transparent rounded-full"></div>
      </div>
    </div>
  );
}
