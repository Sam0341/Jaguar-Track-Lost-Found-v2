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

function NavLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`block px-3 py-2 text-base md:text-lg transition ${
        isActive
          ? "text-blue-600 dark:text-ubGold font-semibold"
          : "text-gray-700 dark:text-gray-200 hover:text-blue-500 dark:hover:text-ubGold"
      }`}
    >
      {children}
    </Link>
  );
}

export default function Navbar() {
  const router = useRouter();
  const { user, loading } = useSupabaseAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isManualAdmin, setIsManualAdmin] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const adminFlag = localStorage.getItem("isManualAdmin");
      setIsManualAdmin(!!adminFlag);

      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user && adminFlag) {
          localStorage.removeItem("isManualAdmin");
          setIsManualAdmin(false);
        }
      });

      const handleScroll = () => setScrolled(window.scrollY > 10);
      window.addEventListener("scroll", handleScroll);
      return () => window.removeEventListener("scroll", handleScroll);
    }
  }, []);

  const handleLogout = async () => {
    try {
      localStorage.removeItem("isManualAdmin");
      setIsManualAdmin(false);
      await supabase.auth.signOut();

      setToast("✅ You’ve been logged out");
      setTimeout(() => {
        setToast("");
        window.location.href = "/login";
      }, 1200);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const userRole = user?.user_metadata?.role;
  const isAdmin = userRole === "admin" || isManualAdmin;
  const userName = user?.email?.split("@")[0] || "User";

  return (
    <header
      className={`sticky top-0 z-[1000] w-full transition-all duration-300 ${
        scrolled
          ? "bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-md py-2"
          : "bg-white dark:bg-gray-900 py-3"
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* 🐾 Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="Jaguar Track Logo"
            width={38}
            height={38}
            className="rounded-full"
          />
          <span className="text-base md:text-lg font-bold text-gray-800 dark:text-gray-100 whitespace-nowrap">
            Jaguar Track Lost & Found
          </span>
        </Link>

        {/* 🌐 Desktop Nav */}
        <nav className="hidden md:flex gap-6 font-medium items-center relative">
          <NavLink href="/">Home</NavLink>

          {/* 👤 Regular Users */}
          {user && !isAdmin && (
            <>
              <NavLink href="/items">Items</NavLink>
              <NavLink href="/report">Report</NavLink>
            </>
          )}

          {/* 🧑‍💼 Admin Users */}
          {isAdmin && (
            <>
              <NavLink href="/reports">Reports</NavLink>
              <NavLink href="/admin">Admin</NavLink>
              <NavLink href="/admin/claims">Claims</NavLink>
            </>
          )}

          {/* 🌙 Dark Mode */}
          <ThemeToggle />

          {/* 👋 User Display + Logout */}
          {!loading && (user || isAdmin) ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Hi,{" "}
                <span className="font-semibold">
                  {isAdmin ? "Admin" : userName}
                </span>
              </span>
              <button
                onClick={handleLogout}
                className="bg-red-600 dark:bg-red-700 text-white px-3 py-1 rounded-md hover:bg-red-700 dark:hover:bg-red-600 transition"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="bg-blue-600 dark:bg-ubGold text-white dark:text-gray-900 px-3 py-1 rounded-md hover:bg-blue-500 dark:hover:bg-yellow-400 transition"
            >
              Login
            </Link>
          )}
        </nav>

        {/* 📱 Mobile Menu Button */}
        <button
          aria-label="Open menu"
          className="md:hidden p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          onClick={() => setMenuOpen(true)}
        >
          <Menu size={26} />
        </button>
      </div>

      {/* 📱 Mobile Drawer */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40"
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.3 }}
              className="fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-900 dark:text-gray-100 shadow-lg z-50 flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <span className="font-bold text-lg">Menu</span>
                <button onClick={() => setMenuOpen(false)}>
                  <X size={26} />
                </button>
              </div>

              <nav className="flex flex-col p-4 space-y-2">
                <NavLink href="/" onClick={() => setMenuOpen(false)}>
                  Home
                </NavLink>

                {/* 👤 Regular Users */}
                {!isAdmin && user && (
                  <>
                    <NavLink href="/items" onClick={() => setMenuOpen(false)}>
                      Items
                    </NavLink>
                    <NavLink href="/report" onClick={() => setMenuOpen(false)}>
                      Report
                    </NavLink>
                  </>
                )}

                {/* 🧑‍💼 Admin Users */}
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
                  </>
                )}

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <ThemeToggle />
                  {!loading && (user || isAdmin) ? (
                    <button
                      onClick={() => {
                        handleLogout();
                        setMenuOpen(false);
                      }}
                      className="bg-red-600 dark:bg-red-700 text-white px-3 py-1 rounded hover:bg-red-700 dark:hover:bg-red-600 transition"
                    >
                      Logout
                    </button>
                  ) : (
                    <Link
                      href="/login"
                      onClick={() => setMenuOpen(false)}
                      className="bg-blue-600 dark:bg-ubGold text-white dark:text-gray-900 px-3 py-1 rounded hover:bg-blue-500 dark:hover:bg-yellow-400 transition text-center"
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

      {/* 🔔 Logout Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 right-6 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-[2000]"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
