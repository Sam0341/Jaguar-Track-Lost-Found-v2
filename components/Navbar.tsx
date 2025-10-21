"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";
import ThemeToggle from "./ThemeToggle"; // ✅ Dark mode toggle

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
      className={`block px-3 py-2 text-lg transition ${
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUser(data.user);
        const { data: refreshed } = await supabase.auth.getSession();
        setEmailConfirmed(!!refreshed.session?.user.email_confirmed_at);
      }
    };

    fetchUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      setEmailConfirmed(!!u?.email_confirmed_at);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push("/login");
  };

  return (
    <header className="bg-white dark:bg-gray-900 dark:text-gray-100 shadow sticky top-0 z-50 transition-colors duration-300">
      <div className="max-w-7xl mx-auto flex items-center justify-between p-4">
        {/* 🐾 Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="Jaguar Track Logo"
            width={40}
            height={40}
            className="rounded-full"
          />
          <span className="text-lg md:text-xl font-bold text-gray-800 dark:text-gray-100">
            Jaguar Track Lost & Found
          </span>
        </Link>

        {/* 🌐 Desktop Nav */}
        <nav className="hidden md:flex gap-6 font-medium items-center relative">
          <NavLink href="/">Home</NavLink>
          <NavLink href="/items">Items</NavLink>

          {/* 👤 Regular Users */}
          {user && emailConfirmed && user.user_metadata?.role !== "admin" && (
            <NavLink href="/report">Report</NavLink>
          )}

          {/* 🧑‍💼 Admin Users */}
          {user?.user_metadata?.role === "admin" && (
            <>
              <NavLink href="/reports">Reports</NavLink>
              <NavLink href="/admin">Admin</NavLink>
            </>
          )}

          {/* 🌙 Dark Mode Toggle */}
          <ThemeToggle />

          {user ? (
            <button
              onClick={handleLogout}
              className="bg-gray-800 dark:bg-gray-700 text-white px-3 py-1 rounded hover:bg-gray-700 dark:hover:bg-gray-600 transition"
            >
              Logout
            </button>
          ) : (
            <Link
              href="/login"
              className="bg-blue-600 dark:bg-ubGold text-white dark:text-gray-900 px-3 py-1 rounded hover:bg-blue-500 dark:hover:bg-yellow-400 transition"
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
          <Menu size={28} />
        </button>
      </div>

      {/* ⚠️ Banner for unconfirmed email */}
      {user && !emailConfirmed && (
        <div className="bg-yellow-100 dark:bg-yellow-900 border-t border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-100 text-center py-2 text-sm">
          Please confirm your UB email to access reporting features.{" "}
          <button
            className="underline font-medium"
            onClick={async () => {
              if (user?.email) {
                await supabase.auth.resend({
                  type: "signup",
                  email: user.email,
                  options: { emailRedirectTo: `${location.origin}/auth/callback` },
                });
                alert("✅ Confirmation email resent. Check your inbox.");
              }
            }}
          >
            Resend confirmation email
          </button>
          .
        </div>
      )}

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
              className="fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-900 dark:text-gray-100 shadow-lg z-50 flex flex-col transition-colors duration-300"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <span className="font-bold text-lg">Menu</span>
                <button onClick={() => setMenuOpen(false)}>
                  <X size={28} />
                </button>
              </div>

              <nav className="flex flex-col p-4 space-y-2">
                <NavLink href="/" onClick={() => setMenuOpen(false)}>
                  Home
                </NavLink>
                <NavLink href="/items" onClick={() => setMenuOpen(false)}>
                  Items
                </NavLink>

                {/* 👤 Regular Users */}
                {user && emailConfirmed && user.user_metadata?.role !== "admin" && (
                  <NavLink href="/report" onClick={() => setMenuOpen(false)}>
                    Report
                  </NavLink>
                )}

                {/* 🧑‍💼 Admin Users */}
                {user?.user_metadata?.role === "admin" && (
                  <>
                    <NavLink href="/reports" onClick={() => setMenuOpen(false)}>
                      Reports
                    </NavLink>
                    <NavLink href="/admin" onClick={() => setMenuOpen(false)}>
                      Admin
                    </NavLink>
                  </>
                )}

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <ThemeToggle />
                  {user ? (
                    <button
                      onClick={() => {
                        handleLogout();
                        setMenuOpen(false);
                      }}
                      className="bg-gray-800 dark:bg-gray-700 text-white px-3 py-1 rounded hover:bg-gray-700 dark:hover:bg-gray-600 transition"
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
    </header>
  );
}
