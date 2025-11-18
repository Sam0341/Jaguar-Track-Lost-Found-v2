"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AdminDashboard from "@/components/AdminDashboard";

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function checkAccess() {
      try {
        // 🔥 getSession() works 100x better than getUser()
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.replace("/login");
          return;
        }

        const user = session.user;

        // 🔥 Manual admin (fallback)
        const manualAdmin = localStorage.getItem("isManualAdmin");
        if (manualAdmin === "true") {
          setIsAdmin(true);
          setLoading(false);
          return;
        }

        // 🔥 Safe profile fetch — no .single() crashes
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        // 🔥 If admin, allow
        if (profile?.role === "admin") {
          setIsAdmin(true);
        } else {
          router.replace("/unauthorized");
          return;
        }
      } catch (err) {
        console.error("Admin access error:", err);
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    }

    checkAccess();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[70vh] text-lg text-gray-400">
        Verifying admin access...
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <section className="animate-fade-in">
      <AdminDashboard />
    </section>
  );
}
