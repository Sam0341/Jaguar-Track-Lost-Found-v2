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

      {/* Footer */}
      <footer className="text-center py-6 text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-800 transition-colors">
        © {new Date().getFullYear()} University of Belize, Jaguar Track Lost & Found 🐾
      </footer>
    </main>
  );
}
