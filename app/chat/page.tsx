"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

export default function MyClaimsPage() {
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const PUBLIC_BUCKET = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/item-photos`;

  useEffect(() => {
    async function loadClaims() {
      const { data: session } = await supabase.auth.getSession();
      const user = session?.session?.user;

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("claims")
        .select(`
          id,
          status,
          message,
          created_at,
          items:item_id (
            id,
            name,
            description,
            image,
            campus:campus_id(name)
          )
        `)
        .eq("claimed_by", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        const mapped = data.map((claim: any) => {
          const item = claim.items;
          return {
            ...claim,
            item_name: item?.name || "Unknown Item",
            item_desc: item?.description || "",
            campus: item?.campus?.name || "Unknown Campus",
            image_url: item?.image
              ? item.image.startsWith("http")
                ? item.image
                : `${PUBLIC_BUCKET}/${item.image}`
              : null,
          };
        });
        setClaims(mapped);
      }

      setLoading(false);
    }

    loadClaims();
  }, []);

  if (loading) {
    return (
      <div className="p-10 text-center text-gray-400">Loading your claims…</div>
    );
  }

  if (claims.length === 0) {
    return (
      <div className="text-center p-20 text-gray-400 dark:text-gray-300">
        <h2 className="text-3xl font-bold text-ubGold mb-3">📄 My Claims</h2>
        You haven’t made any claims yet.
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h2 className="text-3xl font-bold mb-10 text-ubGold flex items-center gap-2">
        📄 My Claims
      </h2>

      <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-8">
        {claims.map((claim) => (
          <Link
            key={claim.id}
            href={`/user/chat/${claim.id}`}
            className="bg-gray-900 dark:bg-gray-800 border border-gray-700 rounded-xl shadow hover:shadow-lg transition overflow-hidden"
          >
            {/* IMAGE */}
            <div className="h-56 bg-gray-700 overflow-hidden">
              <img
                src={
                  claim.image_url ||
                  "https://placehold.co/600x400?text=No+Image"
                }
                className="w-full h-full object-cover"
              />
            </div>

            {/* CONTENT */}
            <div className="p-5 space-y-2">
              <h3 className="text-xl font-bold text-white">
                {claim.item_name}
              </h3>

              <p className="text-sm text-gray-400">{claim.campus}</p>

              {/* Claim Message */}
              <p className="text-gray-300 text-sm line-clamp-2 italic">
                "{claim.message || "No message provided"}"
              </p>

              {/* STATUS BADGE */}
              <span
                className={`inline-block mt-2 px-3 py-1 text-xs rounded-full font-semibold ${
                  claim.status === "pending"
                    ? "bg-yellow-500 text-black"
                    : claim.status === "approved"
                    ? "bg-green-500 text-black"
                    : "bg-red-500 text-white"
                }`}
              >
                {claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
