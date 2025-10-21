"use client";

import { useEffect, useState } from "react";
import { getAllItems, type Item } from "@/lib/items";
import Link from "next/link";

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [campusFilter, setCampusFilter] = useState("All Campuses");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");

  useEffect(() => {
    async function fetchItems() {
      try {
        const data = await getAllItems();
        console.log("📦 Items fetched:", data);
        setItems(data);
      } catch (error) {
        console.error("❌ Failed to fetch items:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchItems();
  }, []);

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCampus =
      campusFilter === "All Campuses" || item.campus === campusFilter;
    const matchesCategory =
      categoryFilter === "All Categories" || item.category === categoryFilter;
    return matchesSearch && matchesCampus && matchesCategory;
  });

  if (loading) {
    return (
      <div className="text-center p-6 text-ubBlue dark:text-ubGold text-lg animate-pulse">
        Loading items...
      </div>
    );
  }

  if (filteredItems.length === 0) {
    return (
      <div className="text-center p-10 text-gray-500 dark:text-gray-400 text-lg">
        No items found.
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-center text-ubBlue dark:text-ubGold">
        Lost & Found Items
      </h1>

      {/* 🔍 Filters */}
      <div className="flex flex-col md:flex-row justify-center gap-4 mb-8">
        {/* Search Bar */}
        <input
          type="text"
          placeholder="Search by name or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border border-ubBlue dark:border-ubGold bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-2 rounded-lg w-full md:w-1/3 focus:ring-2 focus:ring-ubGold transition"
        />

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border border-ubBlue dark:border-ubGold bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-2 rounded-lg w-full md:w-1/4 focus:ring-2 focus:ring-ubGold transition"
        >
          <option>All Categories</option>
          <option>Books & Documents</option>
          <option>Electronics</option>
          <option>Clothing</option>
          <option>Jewelry</option>
          <option>Sports Equipment</option>
          <option>Wallets & IDs</option>
          <option>Bags</option>
          <option>Other</option>
        </select>

        {/* Campus Filter */}
        <select
          value={campusFilter}
          onChange={(e) => setCampusFilter(e.target.value)}
          className="border border-ubBlue dark:border-ubGold bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-2 rounded-lg w-full md:w-1/4 focus:ring-2 focus:ring-ubGold transition"
        >
          <option>All Campuses</option>
          <option>Belmopan (Central Campus)</option>
          <option>Belize City</option>
          <option>Central Farm</option>
          <option>Punta Gorda</option>
          <option>Toledo</option>
        </select>
      </div>

      {/* 🧾 Item Cards */}
      <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filteredItems.map((item) => (
          <Link
            href={`/items/${item.id}`}
            key={item.id}
            className="bg-white dark:bg-gray-900 shadow-sm rounded-2xl border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-ubGold transition overflow-hidden group"
          >
            {/* 🖼️ UB Blue/Gold Shimmer */}
            <div className="h-48 bg-gray-100 dark:bg-gray-800 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-ubBlue/20 via-ubGold/40 to-ubBlue/20 animate-[shimmer_1.5s_infinite]" />
              <img
                src={
                  item.image_url ||
                  "https://placehold.co/600x400?text=No+Image+Available"
                }
                alt={item.name}
                className="object-cover w-full h-full opacity-0 transition-all duration-700 group-hover:scale-105"
                onLoad={(e) => {
                  e.currentTarget.style.opacity = "1";
                  const shimmer = e.currentTarget.previousSibling as HTMLElement;
                  if (shimmer) shimmer.style.display = "none";
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://placehold.co/600x400?text=Image+Unavailable";
                }}
              />
            </div>

            {/* Info Section */}
            <div className="p-4">
              <h2 className="font-bold text-lg text-gray-900 dark:text-gray-100">
                {item.name}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-2 line-clamp-2">
                {item.description}
              </p>

              <div className="flex flex-wrap gap-2">
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    item.status?.toLowerCase() === "found"
                      ? "bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-200"
                      : "bg-yellow-100 text-yellow-700 dark:bg-yellow-700 dark:text-yellow-200"
                  }`}
                >
                  {item.status?.toUpperCase()}
                </span>

                {item.category && (
                  <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1 rounded-full">
                    {item.category}
                  </span>
                )}

                {item.campus && (
                  <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 px-2 py-1 rounded-full">
                    {item.campus}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* 🌀 Custom shimmer keyframes */}
      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}
