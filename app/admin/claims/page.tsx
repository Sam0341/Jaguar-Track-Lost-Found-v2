"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ClaimRaw = {
  id: string;
  item_id: string;
  claimed_by?: string | null;
  message?: string | null;
  status?: string | null;
  created_at?: string | null;
  // other fields if present...
};

type ClaimView = ClaimRaw & {
  itemName?: string | null;
  itemCampus?: string | null;
  claimantEmail?: string | null;
};

export default function AdminClaimsPage() {
  const [claims, setClaims] = useState<ClaimView[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // claim id currently loading

  // helper to decide if we should send dev-bypass header (localhost)
  const shouldSendDevHeader = () =>
    typeof window !== "undefined" && window.location.hostname.includes("localhost");

  useEffect(() => {
    fetchAndHydrateClaims();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchAndHydrateClaims() {
    setLoading(true);
    setErrorMsg(null);

    try {
      // 1) fetch raw claims from API
      const res = await fetch("/api/claims", {
        headers: shouldSendDevHeader() ? { "x-dev-admin": "true" } : undefined,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`${res.status} ${res.statusText} ${text}`);
      }

      const rawData = await res.json();
      // API returns array (we fall back to simple rows server-side). Accept either data or {claims: []}
      const rawClaims: ClaimRaw[] =
        Array.isArray(rawData) ? rawData : rawData?.claims || rawData?.data || [];

      if (!rawClaims || rawClaims.length === 0) {
        setClaims([]);
        setLoading(false);
        return;
      }

      // 2) hydrate each claim with item and claimant profile (parallel)
      const hydrated = await Promise.all(
        rawClaims.map(async (c) => {
          const view: ClaimView = { ...c, itemName: null, itemCampus: null, claimantEmail: null };

          try {
            // fetch item name/campus (if item exists)
            if (c.item_id) {
              const { data: itemData, error: itemErr } = await supabase
                .from("items")
                .select("name, campus")
                .eq("id", c.item_id)
                .single();

              if (!itemErr && itemData) {
                view.itemName = itemData.name ?? null;
                view.itemCampus = itemData.campus ?? null;
              }
            }

            // fetch profile email from profiles table using claimed_by (if present)
            if (c.claimed_by) {
              const { data: profileData, error: profileErr } = await supabase
                .from("profiles")
                .select("email")
                .eq("id", c.claimed_by)
                .single();

              if (!profileErr && profileData) {
                view.claimantEmail = profileData.email ?? null;
              } else {
                // fallback: try the auth.users table through supabase.rpc? (not always available client-side)
                view.claimantEmail = null;
              }
            }
          } catch (err) {
            // don't fail whole list if one lookup fails
            console.warn("Hydration warning for claim", c.id, err);
          }

          return view;
        })
      );

      setClaims(hydrated);
    } catch (err: any) {
      console.error("Fetch error:", err);
      setErrorMsg(typeof err === "string" ? err : err.message || "Failed to fetch claims");
    } finally {
      setLoading(false);
    }
  }

  async function updateClaimStatus(claimId: string, status: "approved" | "rejected") {
    setActionLoading(claimId);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/claims", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(shouldSendDevHeader() ? { "x-dev-admin": "true" } : {}),
        },
        body: JSON.stringify({ claim_id: claimId, status }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`${res.status} ${res.statusText} ${txt}`);
      }

      const json = await res.json();
      console.log("PATCH result:", json);

      // update local state (optimistic)
      setClaims((prev) =>
        prev.map((c) => (c.id === claimId ? { ...c, status: status } : c))
      );
    } catch (err: any) {
      console.error("Update claim error:", err);
      setErrorMsg(err.message || "Failed to update claim");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return <div className="text-center py-16 text-gray-400">Loading claims...</div>;
  }

  if (errorMsg) {
    return (
      <div className="text-center py-16">
        <p className="text-red-400 mb-4">Failed to fetch claims ({errorMsg})</p>
        <button
          onClick={() => fetchAndHydrateClaims()}
          className="px-4 py-2 rounded bg-blue-600 text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!claims || claims.length === 0) {
    return <div className="text-center py-16 text-gray-400">No claims found.</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Claims Management</h1>

      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded shadow">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-700 text-left">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Campus</th>
              <th className="px-4 py-3">Claimed By</th>
              <th className="px-4 py-3">Message</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.id} className="border-b dark:border-gray-700">
                <td className="px-4 py-3 font-medium">{c.itemName ?? c.item_id}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{c.itemCampus ?? "—"}</td>
                <td className="px-4 py-3 text-sm">{c.claimantEmail ?? c.claimed_by ?? "—"}</td>
                <td className="px-4 py-3 max-w-xs truncate">{c.message ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      c.status?.toLowerCase() === "approved"
                        ? "bg-green-600 text-white"
                        : c.status?.toLowerCase() === "rejected"
                        ? "bg-red-600 text-white"
                        : "bg-yellow-500 text-white"
                    }`}
                  >
                    {c.status ? c.status.charAt(0).toUpperCase() + c.status.slice(1) : "Pending"}
                  </span>
                </td>
                <td className="px-4 py-3">{c.created_at ? new Date(c.created_at).toLocaleString() : "—"}</td>
                <td className="px-4 py-3 space-x-2">
                  <button
                    onClick={() => updateClaimStatus(c.id, "approved")}
                    disabled={actionLoading !== null}
                    className="px-3 py-1 rounded bg-green-600 text-white disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => updateClaimStatus(c.id, "rejected")}
                    disabled={actionLoading !== null}
                    className="px-3 py-1 rounded bg-red-600 text-white disabled:opacity-50"
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
