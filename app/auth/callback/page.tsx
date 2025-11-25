"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    async function finishLogin() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        if (!code) {
          router.replace("/login");
          return;
        }

        // Exchange magic link code
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error(error);
          router.replace("/login");
          return;
        }

        // Redirect to home page
        router.replace("/items");
      } catch (err) {
        console.error("Auth callback error:", err);
        router.replace("/login");
      }
    }

    finishLogin();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen text-white">
      <p className="text-lg">Logging you in...</p>
    </div>
  );
}
