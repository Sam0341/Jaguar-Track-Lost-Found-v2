"use client";

import Link from "next/link";
import type { Item } from "@/lib/items";

export default function ItemCard({ item }: { item: Item }) {
  // Ensure image always has a valid fallback
  const imgSrc =
    item.image_url && item.image_url.trim() !== ""
      ? item.image_url
      : "https://placehold.co/600x400?text=No+Image+Available";

  return (
    <Link
      href={`/items/${item.id}`}
      className="block border rounded-2xl shadow-sm hover:shadow-md transition overflow-hidden bg-white dark:bg-gray-900"
    >
      {/* 🖼 Image */}
      <div className="relative w-full h-48 bg-gray-100 dark:bg-gray-800 overflow-hidden rounded-t-2xl">
        <img
          src={imgSrc}
          alt={item.name || "Item image"}
          className="w-full h-full object-cover select-none pointer-events-none transition-transform duration-300 group-hover:scale-105"
          draggable="false"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              "https://placehold.co/600x400?text=Image+Unavailable";
          }}
        />
      </div>

      {/* 📄 Info */}
      <div className="p-4">
        <h2 className="font-bold text-lg text-gray-900 dark:text-gray-100">
          {item.name}
        </h2>

        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
          {item.description}
        </p>

        {/* 🏷️ Tags */}
        <div className="flex flex-wrap gap-2 mt-3 text-xs">
          {/* STATUS */}
          <span
            className={`px-3 py-1 rounded-full ${
              item.status?.toLowerCase() === "found"
                ? "bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-200"
                : item.status?.toLowerCase() === "claimed"
                ? "bg-yellow-200 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-200"
                : "bg-yellow-100 text-yellow-700 dark:bg-yellow-700 dark:text-yellow-200"
            }`}
          >
            {item.status?.toUpperCase()}
          </span>

          {/* CATEGORY */}
          {item.category && (
            <span className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-1 rounded-full">
              {item.category}
            </span>
          )}

          {/* CAMPUS */}
          {item.campus && (
            <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 px-3 py-1 rounded-full">
              {item.campus}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
