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
    async function checkAdmin() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // 🚫 Not logged in
        alert("You must log in to access this page.");
        router.push("/login");
        return;
      }

      // ✅ Check if the user is admin
      const role = user.user_metadata?.role;
      if (role === "admin") {
        setIsAdmin(true);
      } else {
        alert("Access Denied: Admins only.");
        router.push("/");
      }

      setLoading(false);
    }

    checkAdmin();
  }, [router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 text-lg text-gray-600">
        Checking access...
      </div>
    );
  }

  if (!isAdmin) {
    return null; // Prevents flashing content for non-admins
  }

  return <AdminDashboard />;
}
