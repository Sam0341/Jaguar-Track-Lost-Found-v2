'use client';

export const runtime = "nodejs";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ItemsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [campusFilter, setCampusFilter] = useState("All Campuses");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");

  const router = useRouter();

  // 🧠 Check for login status
  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    }
    checkAuth();
  }, []);

  // 📦 Fetch items (NEW DB FORMAT)
  useEffect(() => {
    async function fetchItems() {
      try {
        const { data, error } = await supabase
          .from("items")
          .select(`
            id,
            name,
            description,
            image,
            status,
            reported_at,
            claimed_at,

            campus:campus_id (
              id,
              name
            ),

            category:category_id (
              id,
              name
            ),

            reporter:reported_by (
              id,
              full_name,
              email
            )
          `)
          .order("reported_at", { ascending: false });

        if (error) {
          console.error("❌ Supabase Fetch Error:", error);
        }

        // Transform into UI structure
        const mapped = data?.map((item: any) => ({
          ...item,
          campus: item.campus?.name || "Unknown Campus",
          category: item.category?.name || "Other",
          image_url: item.image || null,
        })) || [];

        setItems(mapped);
      } catch (err) {
        console.error("❌ Unexpected Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchItems();
  }, []);

  // 🔍 Filters
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

  // ⏳ Loading UI
  if (loading) {
    return (
      <div className="text-center p-6 text-ubBlue dark:text-ubGold text-lg animate-pulse">
        Loading items...
      </div>
    );
  }

  // ❌ No items
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
        <input
          type="text"
          placeholder="Search by name or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border border-ubBlue dark:border-ubGold bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-2 rounded-lg w-full md:w-1/3 focus:ring-2 focus:ring-ubGold transition"
        />

        {/* Dynamic Categories */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border border-ubBlue dark:border-ubGold bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-2 rounded-lg w-full md:w-1/4 focus:ring-2 focus:ring-ubGold transition"
        >
          <option>All Categories</option>
          {Array.from(new Set(items.map((i) => i.category))).map((cat) => (
            <option key={cat}>{cat}</option>
          ))}
        </select>

        {/* Dynamic Campuses */}
        <select
          value={campusFilter}
          onChange={(e) => setCampusFilter(e.target.value)}
          className="border border-ubBlue dark:border-ubGold bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-2 rounded-lg w-full md:w-1/4 focus:ring-2 focus:ring-ubGold transition"
        >
          <option>All Campuses</option>
          {Array.from(new Set(items.map((i) => i.campus))).map((camp) => (
            <option key={camp}>{camp}</option>
          ))}
        </select>
      </div>

      {/* 🧾 Items Grid */}
      <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="bg-white dark:bg-gray-900 shadow-sm rounded-2xl border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-ubGold transition overflow-hidden group"
          >
            <div className="h-48 bg-gray-100 dark:bg-gray-800 flex items-center justify-center relative overflow-hidden">
              <img
                src={
                  item.image_url ||
                  "https://placehold.co/600x400?text=No+Image"
                }
                alt={item.name}
                className="object-cover w-full h-full group-hover:scale-105 transition-all"
              />
            </div>

            <div className="p-4 flex flex-col justify-between min-h-[180px]">
              <div>
                <h2 className="font-bold text-lg text-gray-900 dark:text-gray-100">
                  {item.name}
                </h2>

                <p className="text-gray-600 dark:text-gray-400 text-sm mb-2 line-clamp-2">
                  {item.description}
                </p>

                <div className="flex flex-wrap gap-2 mb-2">
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      item.status?.toLowerCase() === "found"
                        ? "bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-200"
                        : "bg-yellow-100 text-yellow-700 dark:bg-yellow-700 dark:text-yellow-200"
                    }`}
                  >
                    {item.status?.toUpperCase()}
                  </span>

                  <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1 rounded-full">
                    {item.category}
                  </span>

                  <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 px-2 py-1 rounded-full">
                    {item.campus}
                  </span>
                </div>
              </div>

              <div className="mt-auto">
                <Link
                  href={`/items/${item.id}`}
                  className="block w-full text-center bg-ubBlue hover:bg-ubBlue/80 text-white text-sm font-medium py-2 rounded-lg transition"
                >
                  View Details
                </Link>

                {!user && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                    🔒 Log in to claim items
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
