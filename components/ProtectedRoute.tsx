"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ProtectedPage({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isAuth, setIsAuth] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
      } else {
        setIsAuth(true);
      }
      setLoading(false);
    };
    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login");
      } else {
        setIsAuth(true);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [router]);

  if (loading) return <p className="p-4">Loading...</p>;
  if (!isAuth) return null;

  return <>{children}</>;
}
