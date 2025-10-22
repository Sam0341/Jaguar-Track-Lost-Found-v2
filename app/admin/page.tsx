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
        } = await supabase.auth.getUser();

        // ✅ Check Supabase metadata
        if (user?.user_metadata?.role === "admin") {
          setIsAdmin(true);
          return;
        }

        // ✅ Local admin override
        if (localStorage.getItem("isManualAdmin") === "true") {
          setIsAdmin(true);
          return;
        }

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
