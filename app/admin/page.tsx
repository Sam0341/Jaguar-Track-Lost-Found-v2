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
        // 1️⃣ First, check if a Supabase user is logged in
        const {
          data: { user },
        } = await supabase.auth.getUser();

        // 2️⃣ Check for Supabase admin
        if (user?.user_metadata?.role === "admin") {
          setIsAdmin(true);
          setLoading(false);
          return;
        }

        // 3️⃣ Otherwise, check for manual admin login stored in localStorage
        const localAdmin = localStorage.getItem("isManualAdmin");
        if (localAdmin === "true") {
          setIsAdmin(true);
          setLoading(false);
          return;
        }

        // 🚫 No valid access
        alert("Access denied. Admins only.");
        router.push("/login");
      } catch (err) {
        console.error("Error checking admin access:", err);
        alert("Something went wrong while verifying access.");
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }

    checkAccess();
  }, [router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 text-lg text-gray-600 dark:text-gray-300">
        Checking admin access...
      </div>
    );
  }

  if (!isAdmin) return null;

  return <AdminDashboard />;
}
