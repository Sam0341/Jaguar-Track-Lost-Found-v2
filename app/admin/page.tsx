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
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error || !user) {
          alert("You must be logged in.");
          router.push("/login");
          return;
        }

        // ✅ Fetch the role from your `profiles` table
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (profileError) {
          console.error("Profile fetch error:", profileError);
          alert("Unable to verify your account role.");
          router.push("/login");
          return;
        }

        // ✅ Check if user is admin
        if (profile?.role === "admin") {
          setIsAdmin(true);
          return;
        }

        // ✅ Local override (manual admin)
        if (localStorage.getItem("isManualAdmin") === "true") {
          setIsAdmin(true);
          return;
        }

        // 🚫 Not admin
        alert("Access denied. Admins only.");
        router.push("/login");
      } catch (err) {
        console.error("Admin access error:", err);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }

    checkAccess();
  }, [router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[70vh] text-lg text-gray-600 dark:text-gray-300">
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
