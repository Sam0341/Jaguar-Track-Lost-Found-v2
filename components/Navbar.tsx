"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import ThemeToggle from "./ThemeToggle";
import { useSupabaseAuth } from "@/components/SupabaseProvider";

/* ================================
   🔗 Reusable Navigation Link
================================ */
function NavLink({
  href,
  children,
  onClick,
  badgeCount = 0,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
  badgeCount?: number;
}) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`relative block px-3 py-2 text-base md:text-lg transition ${
        isActive
          ? "text-blue-600 dark:text-ubGold font-semibold"
          : "text-gray-700 dark:text-gray-200 hover:text-blue-500 dark:hover:text-ubGold"
      }`}
    >
      {children}

      {/* 🔴 Unread badge */}
      {badgeCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
          {badgeCount > 9 ? "9+" : badgeCount}
        </span>
      )}
    </Link>
  );
}

/* ===============================
   🧭 MAIN NAVBAR COMPONENT
================================ */
export default function Navbar() {
  const router = useRouter();
  const { user, loading } = useSupabaseAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [isManualAdmin, setIsManualAdmin] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [scrolled, setScrolled] = useState(false);
  const [toast, setToast] = useState("");

  /* ============================
     👑 Detect User Role
  ============================ */
  useEffect(() => {
    async function fetchUserRole() {
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;

      if (authUser?.email) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("email", authUser.email)
          .single();

        if (profile?.role) {
          setRole(profile.role);
          localStorage.setItem("userRole", profile.role);
        }
      } else {
        const storedRole = localStorage.getItem("userRole");
        const adminFlag = localStorage.getItem("isManualAdmin");

        if (storedRole) setRole(storedRole);
        if (adminFlag) setIsManualAdmin(true);
      }
    }
    void fetchUserRole();
  }, []);

  /* ============================
     🔔 Fetch unread messages
  ============================ */
  useEffect(() => {
    async function fetchUnread() {
      if (!user) return;

      const { data: claims } = await supabase
        .from("claims")
        .select("id")
        .eq("claimed_by", user.id);

      if (!claims || claims.length === 0) {
        setUnreadCount(0);
        return;
      }

      const claimIds = claims.map((c) => c.id);

      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .in("claim_id", claimIds)
        .eq("is_admin", true);

      setUnreadCount(count || 0);
    }

    void fetchUnread();

    const channel = supabase.channel("messages_changes");
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => {
        if (payload.new.is_admin) {
          setUnreadCount((prev) => prev + 1);
        }
      }
    );

    void channel.subscribe();
    return () => void supabase.removeChannel(channel);
  }, [user]);

  /* ============================
     🪟 Scroll Effect
  ============================ */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ============================
     🚪 Logout
  ============================ */
  const handleLogout = async () => {
    localStorage.removeItem("isManualAdmin");
    localStorage.removeItem("userRole");
    setIsManualAdmin(false);
    setRole(null);

    await supabase.auth.signOut();

    setToast("✅ Logged out");

    setTimeout(() => {
      setToast("");
      router.push("/login");
    }, 1000);
  };

  const userEmail = user?.email || "User";
  const userName = userEmail.split("@")[0];

  const isAdmin = role === "admin" || isManualAdmin;

  /* =============================
     🟡 Navbar UI
  ============================= */
  return (
    <header
      className={`sticky top-0 z-[1000] w-full transition-all duration-300 ${
        scrolled
          ? "bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-md py-2"
          : "bg-white dark:bg-gray-900 py-3"
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* 📌 Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo.png"
            width={38}
            height={38}
            alt="Jaguar Track Logo"
            className="rounded-full"
          />
          <span className="text-base md:text-lg font-bold text-gray-800 dark:text-gray-100">
            Jaguar Track Lost & Found
          </span>
        </Link>

        {/* 🌐 Desktop Navigation */}
        <nav className="hidden md:flex gap-6 font-medium items-center">

          <NavLink href="/">Home</NavLink>

          {/* 👤 USER */}
          {user && !isAdmin && (
            <>
              <NavLink href="/items">Items</NavLink>
              <NavLink href="/report">Report</NavLink>
              <NavLink href="/user/claims" badgeCount={unreadCount}>
                My Claims
              </NavLink>
            </>
          )}

          {/* 🧑‍💼 ADMIN */}
          {isAdmin && (
            <>
              <NavLink href="/reports">Reports</NavLink>
              <NavLink href="/admin">Admin</NavLink>
              <NavLink href="/admin/claims">Claims</NavLink>
              <NavLink href="/admin/storage">Storage</NavLink>
              <NavLink href="/admin/logs">Logs</NavLink>

              {/* ⭐ NEW BUTTON: CREATE USER */}
              <NavLink href="/admin/create-user">Create User</NavLink>
            </>
          )}

          <ThemeToggle />

          {/* Greeting + Logout */}
          {!loading && (user || isAdmin) ? (
            <div className="flex items-center gap-3">
              <span className="text-sm dark:text-gray-300 text-gray-700">
                Hi,{" "}
                <span className="font-semibold">
                  {isAdmin ? "Admin" : userName}
                </span>
              </span>

              <button
                onClick={handleLogout}
                className="bg-red-600 dark:bg-red-700 text-white px-3 py-1 rounded-md"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="bg-blue-600 dark:bg-ubGold text-white dark:text-gray-900 px-3 py-1 rounded-md"
            >
              Login
            </Link>
          )}
        </nav>

        {/* 📱 Mobile Menu Button */}
        <button
          className="md:hidden p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          onClick={() => setMenuOpen(true)}
        >
          <Menu size={26} />
        </button>
      </div>

      {/* 📱 MOBILE DRAWER */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/50 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              onClick={() => setMenuOpen(false)}
            />

            <motion.div
              className="fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-900 shadow-lg z-50 flex flex-col"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
            >
              <div className="flex items-center justify-between p-4">
                <span className="font-bold text-lg">Menu</span>
                <button onClick={() => setMenuOpen(false)}>
                  <X size={26} />
                </button>
              </div>

              <nav className="flex flex-col p-4 space-y-2">
                <NavLink href="/" onClick={() => setMenuOpen(false)}>
                  Home
                </NavLink>

                {/* USER */}
                {!isAdmin && user && (
                  <>
                    <NavLink href="/items" onClick={() => setMenuOpen(false)}>
                      Items
                    </NavLink>
                    <NavLink href="/report" onClick={() => setMenuOpen(false)}>
                      Report
                    </NavLink>
                    <NavLink
                      href="/user/claims"
                      onClick={() => setMenuOpen(false)}
                      badgeCount={unreadCount}
                    >
                      My Claims
                    </NavLink>
                  </>
                )}

                {/* ADMIN */}
                {isAdmin && (
                  <>
                    <NavLink href="/reports" onClick={() => setMenuOpen(false)}>
                      Reports
                    </NavLink>
                    <NavLink href="/admin" onClick={() => setMenuOpen(false)}>
                      Admin
                    </NavLink>
                    <NavLink
                      href="/admin/claims"
                      onClick={() => setMenuOpen(false)}
                    >
                      Claims
                    </NavLink>
                    <NavLink
                      href="/admin/storage"
                      onClick={() => setMenuOpen(false)}
                    >
                      Storage
                    </NavLink>
                    <NavLink
                      href="/admin/logs"
                      onClick={() => setMenuOpen(false)}
                    >
                      Logs
                    </NavLink>

                    {/* ⭐ NEW: CREATE USER */}
                    <NavLink
                      href="/admin/create-user"
                      onClick={() => setMenuOpen(false)}
                    >
                      Create User
                    </NavLink>
                  </>
                )}

                {/* Bottom section */}
                <div className="pt-4 border-t flex items-center justify-between">
                  <ThemeToggle />

                  {!loading && (user || isAdmin) ? (
                    <button
                      onClick={() => {
                        handleLogout();
                        setMenuOpen(false);
                      }}
                      className="bg-red-600 text-white px-3 py-1 rounded"
                    >
                      Logout
                    </button>
                  ) : (
                    <Link
                      href="/login"
                      onClick={() => setMenuOpen(false)}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-center"
                    >
                      Login
                    </Link>
                  )}
                </div>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 🔔 Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className="fixed bottom-6 right-6 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-[2000]"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
