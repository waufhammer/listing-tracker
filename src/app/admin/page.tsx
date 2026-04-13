"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Listing = {
  id: string;
  client_name: string;
  property_address: string;
  slug: string;
  status: string;
  list_date: string | null;
};

type ShowingCount = {
  listing_id: string;
  count: number;
};

const STATUS_OPTIONS = ["All", "Prepping", "Active", "Pending", "Sold"] as const;

const statusColor: Record<string, string> = {
  Prepping: "bg-yellow-100 text-yellow-800",
  Active: "bg-green-100 text-green-800",
  Pending: "bg-blue-100 text-blue-800",
  Sold: "bg-gray-100 text-gray-800",
};

function daysOnMarket(listDate: string | null): string {
  if (!listDate) return "—";
  const start = new Date(listDate);
  const now = new Date();
  const diff = Math.floor(
    (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );
  return diff >= 0 ? String(diff) : "—";
}

export default function AdminListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [showingCounts, setShowingCounts] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      const { data: listingsData, error } = await supabase
        .from("listings")
        .select("id, client_name, property_address, slug, status, list_date")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching listings:", error);
        setLoading(false);
        return;
      }

      const listingsResult = (listingsData ?? []) as Listing[];
      setListings(listingsResult);

      // Fetch showing counts for all listings
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

  const filtered =
    statusFilter === "All"
      ? listings
      : listings.filter(
          (l) => l.status?.toLowerCase() === statusFilter.toLowerCase()
        );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Listings</h1>
          <Link
            href="/admin/listings/new"
            className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 transition-colors"
          >
            + New Listing
          </Link>
        </div>

        {/* Filter */}
        <div className="mb-6">
          <label
            htmlFor="status-filter"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Filter by status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Table card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              No listings found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Client Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Days on Market
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Showings
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filtered.map((listing) => (
                    <tr key={listing.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">
                        {listing.property_address}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">
                        {listing.client_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                            statusColor[listing.status] ??
                            "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {listing.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">
                        {daysOnMarket(listing.list_date)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">
                        {showingCounts[listing.id] ?? 0}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <Link
                          href={`/admin/listings/${listing.id}/edit`}
                          className="text-sm font-medium text-green-600 hover:text-green-800 transition-colors"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
