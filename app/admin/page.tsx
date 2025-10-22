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
        // ✅ Step 1: Try to get Supabase user
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        // ✅ Step 2: If manual admin (local flag), allow access right away
        const manualAdmin = localStorage.getItem("isManualAdmin");
        if (manualAdmin === "true") {
          setIsAdmin(true);
          setLoading(false);
          return;
        }

        // 🚫 No user, no manual admin → redirect
        if (error || !user) {
          console.warn("No Supabase user found");
          router.push("/login");
          return;
        }

        // ✅ Step 3: Fetch user profile from DB
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (profileError) {
          console.error("Profile fetch error:", profileError);
          router.push("/login");
          return;
        }

        // ✅ Step 4: If role is admin, grant access
        if (profile?.role === "admin") {
          setIsAdmin(true);
        } else {
          console.warn("Access denied: not admin");
          router.push("/login");
        }
      } catch (err) {
        console.error("Admin access error:", err);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }

    checkAccess();
  }, [router]);

  // 🌀 Loading State
  if (loading) {
    return (
      <div className="flex justify-center items-center h-[70vh] text-lg text-gray-600 dark:text-gray-300">
        Verifying admin access...
      </div>
    );
  }

  // 🚫 Not admin (hidden for security)
  if (!isAdmin) return null;

  // ✅ Admin Access Granted
  return (
    <section className="animate-fade-in">
      <AdminDashboard />
    </section>
  );
}
