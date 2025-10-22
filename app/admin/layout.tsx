"use client";

import "@/app/globals.css";
import { useState } from "react";
import { SupabaseProvider } from "@/components/SupabaseProvider";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [modalContent, setModalContent] = useState<React.ReactNode | null>(null);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-x-hidden">
      <SupabaseProvider>
        {/* 💼 Main Admin Content */}
        <main className="flex-1 relative z-[10] max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 transition-all duration-300 ease-in-out">
          {children}

          {/* 🔹 Modal Portal Area */}
          {modalContent && (
            <>
              <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000]"
                onClick={() => setModalContent(null)}
              />
              <div className="fixed left-1/2 top-[7rem] md:top-1/2 transform -translate-x-1/2 md:-translate-y-1/2 w-[90%] max-w-md rounded-2xl shadow-2xl z-[2100] overflow-hidden transition-all duration-300 animate-slide-up backdrop-blur-xl bg-white/90 dark:bg-gray-800/90 border border-gray-300/40 dark:border-gray-700/40">
                {modalContent}
              </div>
            </>
          )}
        </main>

        {/* ⚙️ Footer */}
        <footer className="w-full text-center py-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400 border-t border-gray-800 bg-gray-100/50 dark:bg-gray-900/50 backdrop-blur-md">
          © {new Date().getFullYear()} Jaguar Track Lost & Found — Admin Panel
        </footer>
      </SupabaseProvider>
    </div>
  );
}
