"use client";

import Link from "next/link";
import type { Item } from "@/lib/items";

export default function ItemCard({ item }: { item: Item }) {
  const imgSrc =
    item.image_url && item.image_url.trim() !== ""
      ? item.image_url
      : "https://placehold.co/600x400?text=No+Image+Available";

  return (
    <Link
      href={`/items/${item.id}`}
      className="block border rounded-2xl shadow-sm hover:shadow-md transition overflow-hidden bg-white"
    >
      {/* ✅ Image wrapper (click-safe, prevents opening image directly) */}
      <div className="relative w-full h-48 bg-gray-100 overflow-hidden rounded-t-2xl">
        <img
          src={imgSrc}
          alt={item.name || "Item image"}
          className="w-full h-full object-cover select-none pointer-events-none transition-transform duration-300 hover:scale-105"
          draggable="false"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              "https://placehold.co/600x400?text=Image+Unavailable";
          }}
        />
      </div>

      {/* ✅ Info section */}
      <div className="p-4">
        <h2 className="font-bold text-lg text-gray-900">{item.name}</h2>
        <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>

        <div className="flex flex-wrap gap-2 mt-3 text-xs">
          <span
            className={`px-3 py-1 rounded-full ${
              item.status?.toLowerCase() === "found"
                ? "bg-green-100 text-green-700"
                : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {item.status?.toUpperCase()}
          </span>

          {item.category && (
            <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full">
              {item.category}
            </span>
          )}

          {item.campus && (
            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
              {item.campus}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
