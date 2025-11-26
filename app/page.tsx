"use client";

import Link from "next/link";
import { ArrowRight, Info, ShieldCheck, Users } from "lucide-react";

export default function HomePage() {
  const infoCards = [
    {
      icon: (
        <Info className="text-blue-600 dark:text-blue-400 transition-colors" size={32} />
      ),
      title: "How It Works",
      desc: "Found something? Report it! Lost an item? Browse through reports and get in touch with the finder.",
    },
    {
      icon: (
        <ShieldCheck
          className="text-yellow-500 dark:text-yellow-400 transition-colors"
          size={32}
        />
      ),
      title: "Verified System",
      desc: "All reports are verified through UB accounts to keep the platform safe and trustworthy.",
    },
    {
      icon: (
        <Users
          className="text-blue-500 dark:text-blue-300 transition-colors"
          size={32}
        />
      ),
      title: "For Every Jaguar",
      desc: "Created by UB students for UB students, ensuring our Jaguar community stays connected.",
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-100 via-white to-gray-50 dark:from-[#0a0f1d] dark:via-[#0d1426] dark:to-[#0f182e] text-gray-900 dark:text-gray-100 transition-colors duration-300">

      {/* Hero Section */}
      <section className="max-w-5xl mx-auto text-center py-20 px-6">
        <h1 className="text-5xl font-extrabold text-blue-700 dark:text-blue-400 drop-shadow-sm">
          UB Lost & Found
        </h1>
        <p className="mt-4 text-lg text-gray-700 dark:text-gray-300 transition-colors">
          Helping our{" "}
          <span className="text-yellow-600 dark:text-yellow-400 font-semibold">
            Jaguars
          </span>{" "}
          reconnect with their belongings, because every item matters!
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href="/items"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium shadow-md transition"
          >
            Browse Items
          </Link>
          <Link
            href="/report"
            className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-gray-900 rounded-full font-medium shadow-md transition"
          >
            Report Item
          </Link>
        </div>
      </section>

      {/* Info Section */}
      <section className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8 px-6 pb-16">
        {infoCards.map((card) => (
          <div
            key={card.title}
            className="bg-white dark:bg-[#111a30] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 text-center hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
          >
            <div className="flex justify-center mb-3">{card.icon}</div>
            <h3 className="text-xl font-semibold text-blue-700 dark:text-blue-300">
              {card.title}
            </h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {card.desc}
            </p>
          </div>
        ))}
      </section>

      {/* ===== Improved Footer ===== */}
      <footer className="mt-10 border-t border-gray-300 dark:border-gray-800 py-8">
        <div className="max-w-6xl mx-auto px-6 text-center flex flex-col gap-3">

          {/* Top Links */}
          <div className="flex flex-wrap justify-center gap-6 text-sm font-medium">
            <Link
              href="https://github.com/Sam0341/Jaguar-Track-Lost-Found-v2"
              target="_blank"
              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="opacity-80"
              >
                <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.38 7.86 10.91.57.1.75-.25.75-.55v-1.94c-3.2.7-3.88-1.39-3.88-1.39-.52-1.32-1.28-1.67-1.28-1.67-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.72-1.55-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.2-3.1-.12-.3-.52-1.48.12-3.08 0 0 .97-.31 3.18 1.18a10.9 10.9 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.6.24 2.78.12 3.08.75.81 1.19 1.84 1.19 3.1 0 4.43-2.69 5.4-5.25 5.68.41.36.77 1.07.77 2.17v3.23c0 .3.18.65.76.55A10.99 10.99 0 0 0 23.5 12c0-6.27-5.23-11.5-11.5-11.5Z" />
              </svg>
              GitHub Repository
            </Link>
          </div>

          {/* Divider */}
          <div className="w-full h-px bg-gray-200 dark:bg-gray-700 rounded-full"></div>

          {/* Copyright */}
          <p className="text-sm text-gray-600 dark:text-gray-400">
            © {new Date().getFullYear()} University of Belize — Jaguar Track Lost & Found  
            <span className="ml-1">🐾</span>
          </p>
        </div>
      </footer>
      {/* ===== End Footer ===== */}

    </main>
  );
}
