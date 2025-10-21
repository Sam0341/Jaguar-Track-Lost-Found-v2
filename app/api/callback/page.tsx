"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export const runtime = "nodejs";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    async function handleAuth() {
      try {
        const hash = window.location.hash;
        const query = window.location.search;
        let params: Record<string, string> = {};

        if (hash) {
          // Convert #access_token=...&refresh_token=... into query-like params
          const cleanHash = hash.substring(1);
          const searchParams = new URLSearchParams(cleanHash);
          searchParams.forEach((value, key) => {
            params[key] = value;
          });
        } else if (query) {
          // Regular ?code=... style params
          const searchParams = new URLSearchParams(query);
          searchParams.forEach((value, key) => {
            params[key] = value;
          });
        }

        // Handle both cases
        if (params["code"]) {
          // Case 1: ?code=...
          const { error } = await supabase.auth.exchangeCodeForSession(params["code"]);
          if (error) throw error;
          console.log("✅ Logged in using code exchange");
        } else if (params["access_token"]) {
          // Case 2: #access_token=...
          const { data, error } = await supabase.auth.setSession({
            access_token: params["access_token"],
            refresh_token: params["refresh_token"],
          });
          if (error) throw error;
          console.log("✅ Logged in using token hash");
        } else {
          throw new Error("No authentication params found");
        }

        // Redirect to home or items page
        router.push("/items");
      } catch (err) {
        console.error("❌ Auth callback error:", err);
        router.push("/login");
      }
    }

    handleAuth();
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
