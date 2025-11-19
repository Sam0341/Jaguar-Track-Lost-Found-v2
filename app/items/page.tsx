"use client";

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

  // Load logged-in user
  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    }
    checkAuth();
  }, []);

  // Fetch Items with correct relationship
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
            location,
            campus:campus_id ( id, name ),
            category:category_id ( id, name ),
            reporter:user_id ( full_name, email )
          `)
          .order("reported_at", { ascending: false });

        if (error) {
          console.error("❌ Failed to fetch items:", error);
          return;
        }

        const BUCKET =
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/item-photos`;

        const mapped =
          data?.map((item: any) => ({
            ...item,
            campus: item.campus?.name || "Unknown Campus",
            category: item.category?.name || "Other",
            reporter_name: item.reporter?.full_name || "Unknown",
            reporter_email: item.reporter?.email || "",
            image_url: item.image
              ? item.image.startsWith("http")
                ? item.image
                : `${BUCKET}/${item.image}`
              : null,
          })) || [];

        setItems(mapped);
      } catch (err) {
        console.error("❌ Unexpected Error:", err);
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

      {/* FILTERS */}
      <div className="flex flex-col md:flex-row justify-center gap-4 mb-8">
        <input
          type="text"
          placeholder="Search by name or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border border-ubBlue dark:border-ubGold bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-2 rounded-lg w-full md:w-1/3"
        />

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border border-ubBlue dark:border-ubGold bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-2 rounded-lg w-full md:w-1/4"
        >
          <option>All Categories</option>
          {Array.from(new Set(items.map((i) => i.category))).map((cat) => (
            <option key={cat}>{cat}</option>
          ))}
        </select>

        <select
          value={campusFilter}
          onChange={(e) => setCampusFilter(e.target.value)}
          className="border border-ubBlue dark:border-ubGold bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-2 rounded-lg w-full md:w-1/4"
        >
          <option>All Campuses</option>
          {Array.from(new Set(items.map((i) => i.campus))).map((camp) => (
            <option key={camp}>{camp}</option>
          ))}
        </select>
      </div>

      {/* ITEMS GRID */}
      <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="bg-white dark:bg-gray-900 shadow rounded-2xl border dark:border-gray-700 hover:shadow-lg hover:border-ubGold transition overflow-hidden group"
          >
            <div className="h-48 bg-gray-200 dark:bg-gray-800 overflow-hidden">
              <img
                src={
                  item.image_url ||
                  "https://placehold.co/600x400?text=No+Image"
                }
                alt={item.name}
                className="object-cover w-full h-full group-hover:scale-105 transition"
                onError={(e) =>
                  ((e.target as HTMLImageElement).src =
                    "https://placehold.co/600x400?text=Image+Unavailable")
                }
              />
            </div>

            <div className="p-4">
              <h2 className="font-bold text-lg text-gray-900 dark:text-gray-100">
                {item.name}
              </h2>

              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                {item.description}
              </p>

              <div className="flex flex-wrap gap-2 mt-3">
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    item.status?.toLowerCase() === "found"
                      ? "bg-green-100 text-green-700"
                      : item.status?.toLowerCase() === "claimed"
                      ? "bg-yellow-200 text-yellow-800"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {item.status?.toUpperCase()}
                </span>

                <span className="text-xs px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700">
                  {item.category}
                </span>

                <span className="text-xs px-2 py-1 rounded-full bg-blue-200 dark:bg-blue-900">
                  {item.campus}
                </span>
              </div>

              <Link href={`/items/${item.id}`}>
                <button className="mt-4 w-full bg-ubBlue dark:bg-ubGold text-white dark:text-gray-900 py-2 rounded-lg hover:opacity-90 transition font-semibold">
                  View Details
                </button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
