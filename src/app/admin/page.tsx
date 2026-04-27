"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Listing = {
  id: string;
  client_name: string;
  property_address: string;
  slug: string;
  status: string;
  list_date: string | null;
  pending_date: string | null;
};

const COLUMNS = [
  { key: "prepping", label: "Preparing to List", color: "border-blue-400", bg: "bg-blue-50", badge: "bg-blue-100 text-blue-800" },
  { key: "active", label: "Active", color: "border-green-500", bg: "bg-green-50", badge: "bg-green-100 text-green-800" },
  { key: "pending", label: "Pending", color: "border-amber-400", bg: "bg-amber-50", badge: "bg-amber-100 text-amber-800" },
  { key: "sold", label: "Sold", color: "border-red-400", bg: "bg-red-50", badge: "bg-red-100 text-red-800" },
];

function daysOnMarket(listDate: string | null, pendingDate?: string | null): number | null {
  if (!listDate) return null;
  const start = new Date(listDate);
  const end = pendingDate ? new Date(pendingDate) : new Date();
  const diff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : null;
}

export default function AdminListingsPage() {
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [showingCounts, setShowingCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      const { data: listingsData, error } = await supabase
        .from("listings")
        .select("id, client_name, property_address, slug, status, list_date, pending_date")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching listings:", error);
        setLoading(false);
        return;
      }

      const listingsResult = (listingsData ?? []) as Listing[];
      setListings(listingsResult);

      const counts: Record<string, number> = {};
      await Promise.all(
        listingsResult.map(async (listing) => {
          const { count, error: countError } = await supabase
            .from("activity_entries")
            .select("id", { count: "exact", head: true })
            .eq("listing_id", listing.id)
            .in("type", ["buyer_showing", "agent_preview"]);

          if (!countError && count !== null) {
            counts[listing.id] = count;
          }
        })
      );

      setShowingCounts(counts);
      setLoading(false);
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-500">Loading...</div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Listings</h1>
        <Link
          href="/admin/listings/new"
          className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 transition-colors"
        >
          + New Listing
        </Link>
      </div>

      {/* Kanban board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {COLUMNS.map((col) => {
          const colListings = listings.filter(
            (l) => l.status?.toLowerCase() === col.key
          );

          return (
            <div key={col.key} className="min-w-0">
              {/* Column header */}
              <div className={`flex items-center gap-2 mb-3 pb-2 border-b-2 ${col.color}`}>
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                  {col.label}
                </h2>
                <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${col.badge}`}>
                  {colListings.length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-3">
                {colListings.length === 0 ? (
                  <div className={`rounded-xl border border-dashed border-gray-200 ${col.bg} p-6 text-center`}>
                    <p className="text-xs text-gray-400">No listings</p>
                  </div>
                ) : (
                  colListings.map((listing) => {
                    const dom = daysOnMarket(listing.list_date, listing.pending_date);
                    const showings = showingCounts[listing.id] ?? 0;

                    return (
                      <div
                        key={listing.id}
                        onClick={() => router.push(`/admin/listings/${listing.id}`)}
                        className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-gray-300 cursor-pointer transition-all group"
                      >
                        <p className="text-sm font-semibold text-gray-900 group-hover:text-green-700 transition-colors leading-snug">
                          {listing.property_address}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {listing.client_name}
                        </p>

                        {/* Meta row */}
                        <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                          {dom !== null && (
                            <span>{dom}d on market</span>
                          )}
                          {showings > 0 && (
                            <span>{showings} showing{showings !== 1 ? "s" : ""}</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
