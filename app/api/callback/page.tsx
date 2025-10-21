"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export const runtime = "nodejs"; // Prevents Edge runtime warnings

export default function AuthCallbackPage() {
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState("Logging you in...");
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    async function handleAuth() {
      try {
        const hash = window.location.hash;
        const query = window.location.search;
        let params: Record<string, string> = {};

        if (hash) {
          // Handle #access_token=...&refresh_token=...
          const cleanHash = hash.substring(1);
          const searchParams = new URLSearchParams(cleanHash);
          searchParams.forEach((value, key) => {
            params[key] = value;
          });
        } else if (query) {
          // Handle ?code=...
          const searchParams = new URLSearchParams(query);
          searchParams.forEach((value, key) => {
            params[key] = value;
          });
        }

        // Exchange code or set session depending on format
        if (params["code"]) {
          const { error } = await supabase.auth.exchangeCodeForSession(params["code"]);
          if (error) throw error;
          console.log("✅ Logged in using code exchange");
        } else if (params["access_token"]) {
          const { error } = await supabase.auth.setSession({
            access_token: params["access_token"],
            refresh_token: params["refresh_token"],
          });
          if (error) throw error;
          console.log("✅ Logged in using token hash");
        } else {
          throw new Error("No authentication parameters found.");
        }

        // Fetch the current user info
        const { data: userData } = await supabase.auth.getUser();
        const userEmail = userData?.user?.email || null;
        const displayName = userEmail ? userEmail.split("@")[0] : null;

        if (displayName) {
          setUserName(displayName);
          setStatusMessage(`Welcome back, ${displayName}!`);
        } else {
          setStatusMessage("Welcome back!");
        }

        // Small delay so the user sees the greeting
        setTimeout(() => {
          router.push("/items");
        }, 2000);
      } catch (err) {
        console.error("❌ Auth callback error:", err);
        setStatusMessage("Login failed. Redirecting...");
        setTimeout(() => router.push("/login"), 2000);
      }
    }

    handleAuth();
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-gray-700 dark:text-gray-300 transition-all">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-3">{statusMessage}</h1>
        {!userName && (
          <>
            <p className="text-sm">Please wait while we complete your authentication.</p>
            <div className="mt-5 animate-spin h-8 w-8 border-4 border-ubBlue border-t-transparent rounded-full"></div>
          </>
        )}
      </div>
    </div>
  );
}
