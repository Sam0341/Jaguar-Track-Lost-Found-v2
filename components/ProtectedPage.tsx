"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ProtectedPage({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login"); // send to login if not logged in
      } else {
        setAuthenticated(true);
      }

      setLoading(false);
    };

    checkSession();
  }, [router]);

  if (loading) {
    return <div className="text-center mt-10">Loading...</div>;
  }

  if (!authenticated) return null;

  return <>{children}</>;
}
