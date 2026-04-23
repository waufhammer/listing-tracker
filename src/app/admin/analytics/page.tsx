"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface Listing {
  id: string;
  property_address: string;
  status: string;
  zillow_visible: boolean;
  redfin_visible: boolean;
}

interface PlatformView {
  view_date: string;
  zillow_views: number | null;
  redfin_views: number | null;
}

interface ActivityEntry {
  activity_date: string;
  activity_type: string;
}

// --- Stat Card ---
function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// --- Helpers ---
function formatDate(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getWeekLabel(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00");
  // Get Monday of that week
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date);
  monday.setDate(diff);
  return monday.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const tooltipStyle = {
  backgroundColor: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  fontSize: "13px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

const axisTickStyle = { fontSize: 12, fill: "#6b7280" };

export default function AnalyticsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedListingId, setSelectedListingId] = useState("");
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);

  // Stats
  const [activeCount, setActiveCount] = useState(0);
  const [showingCount, setShowingCount] = useState(0);
  const [previewCount, setPreviewCount] = useState(0);
  const [openHouseCount, setOpenHouseCount] = useState(0);

  // Chart data
  const [viewsData, setViewsData] = useState<PlatformView[]>([]);
  const [activityData, setActivityData] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    fetchListingsAndStats();
  }, []);

  useEffect(() => {
    if (selectedListingId) {
      const listing = listings.find((l) => l.id === selectedListingId) || null;
      setSelectedListing(listing);
      fetchListingChartData(selectedListingId);
    } else {
      setSelectedListing(null);
      setViewsData([]);
      setActivityData([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedListingId]);

  async function fetchListingsAndStats() {
    setLoading(true);

    const [listingsRes, activityRes] = await Promise.all([
      supabase
        .from("listings")
        .select("id, property_address, status, zillow_visible, redfin_visible")
        .order("property_address"),
      supabase.from("activity_entries").select("activity_type"),
    ]);

    const allListings: Listing[] = listingsRes.data || [];
    const allActivity: { activity_type: string }[] = activityRes.data || [];

    setListings(allListings);
    setActiveCount(allListings.filter((l) => l.status === "Active").length);
    setShowingCount(
      allActivity.filter((a) => a.activity_type === "Buyer Showing").length
    );
    setPreviewCount(
      allActivity.filter((a) => a.activity_type === "Agent Preview").length
    );
    setOpenHouseCount(
      allActivity.filter((a) => a.activity_type === "Open House").length
    );

    // Auto-select first active listing if available
    const firstActive = allListings.find((l) => l.status === "Active");
    if (firstActive) {
      setSelectedListingId(firstActive.id);
    } else if (allListings.length > 0) {
      setSelectedListingId(allListings[0].id);
    }

    setLoading(false);
  }

  async function fetchListingChartData(listingId: string) {
    const [viewsRes, activityRes] = await Promise.all([
      supabase
        .from("platform_views")
        .select("view_date, zillow_views, redfin_views")
        .eq("listing_id", listingId)
        .order("view_date", { ascending: true }),
      supabase
        .from("activity_entries")
        .select("activity_date, activity_type")
        .eq("listing_id", listingId)
        .order("activity_date", { ascending: true }),
    ]);

    setViewsData(viewsRes.data || []);
    setActivityData(activityRes.data || []);
  }

  // --- Build weekly activity chart data ---
  const weeklyActivity = (() => {
    if (activityData.length === 0) return [];

    const weekMap: Record<
      string,
      { week: string; Showings: number; Previews: number; "Open Houses": number }
    > = {};

    activityData.forEach((entry) => {
      const week = getWeekLabel(entry.activity_date);
      if (!weekMap[week]) {
        weekMap[week] = { week, Showings: 0, Previews: 0, "Open Houses": 0 };
      }
      if (entry.activity_type === "Buyer Showing") weekMap[week].Showings++;
      else if (entry.activity_type === "Agent Preview") weekMap[week].Previews++;
      else if (entry.activity_type === "Open House")
        weekMap[week]["Open Houses"]++;
    });

    return Object.values(weekMap);
  })();

  // --- Build platform views chart data ---
  const viewsChartData = viewsData.map((entry) => ({
    date: formatDate(entry.view_date),
    ...(selectedListing?.zillow_visible !== false && {
      Zillow: entry.zillow_views ?? 0,
    }),
    ...(selectedListing?.redfin_visible !== false && {
      Redfin: entry.redfin_views ?? 0,
    }),
  }));

  if (loading) {
    return (
      <div className="max-w-5xl">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Analytics</h2>
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <h2 className="text-2xl font-semibold text-gray-900 mb-6">Analytics</h2>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Active Listings" value={activeCount} />
        <StatCard label="Buyer Showings" value={showingCount} sub="All listings" />
        <StatCard label="Agent Previews" value={previewCount} sub="All listings" />
        <StatCard label="Open Houses" value={openHouseCount} sub="All listings" />
      </div>

      {/* Listing Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Select Listing
        </label>
        <select
          value={selectedListingId}
          onChange={(e) => setSelectedListingId(e.target.value)}
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
        >
          <option value="">-- Choose a listing --</option>
          {listings.map((l) => (
            <option key={l.id} value={l.id}>
              {l.property_address}
            </option>
          ))}
        </select>
      </div>

      {selectedListingId && (
        <div className="space-y-8">
          {/* Platform Views Chart */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Platform Views Over Time
            </h3>
            {viewsChartData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                No view data for this listing
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart
                  data={viewsChartData}
                  margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={axisTickStyle}
                    tickLine={false}
                    axisLine={{ stroke: "#e5e7eb" }}
                  />
                  <YAxis
                    tick={axisTickStyle}
                    tickLine={false}
                    axisLine={{ stroke: "#e5e7eb" }}
                    allowDecimals={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: "13px", paddingTop: "8px" }} />
                  {selectedListing?.zillow_visible !== false && (
                    <Line
                      type="monotone"
                      dataKey="Zillow"
                      stroke="#006AFF"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#006AFF" }}
                      activeDot={{ r: 5 }}
                    />
                  )}
                  {selectedListing?.redfin_visible !== false && (
                    <Line
                      type="monotone"
                      dataKey="Redfin"
                      stroke="#A02021"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#A02021" }}
                      activeDot={{ r: 5 }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Activity Trends Chart */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Weekly Activity
            </h3>
            {weeklyActivity.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                No activity data for this listing
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={weeklyActivity}
                  margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="week"
                    tick={axisTickStyle}
                    tickLine={false}
                    axisLine={{ stroke: "#e5e7eb" }}
                  />
                  <YAxis
                    tick={axisTickStyle}
                    tickLine={false}
                    axisLine={{ stroke: "#e5e7eb" }}
                    allowDecimals={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: "13px", paddingTop: "8px" }} />
                  <Bar
                    dataKey="Showings"
                    fill="#00B04F"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="Previews"
                    fill="#006AFF"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="Open Houses"
                    fill="#F59E0B"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
