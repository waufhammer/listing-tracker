"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ── Types ────────────────────────────────────────────────────────────────────

interface Listing {
  id: string;
  property_address: string;
  status: string;
  list_date: string | null;
  pending_date: string | null;
  sold_date: string | null;
  list_price: number | null;
  sale_price: number | null;
  offers_received: number | null;
}

interface ActivityEntry {
  listing_id: string;
  type: string;
  buyer_packet_requested: boolean;
  open_house_groups: number | null;
}

interface ListingSummary {
  listing: Listing;
  dom: number | null;
  totalGroups: number;
  disclosurePkgs: number;
  conversionPct: number | null;
  offers: number;
  pctOverUnder: number | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysOnMarket(listDate: string | null, pendingDate?: string | null): number | null {
  if (!listDate) return null;
  const start = new Date(listDate);
  const end = pendingDate ? new Date(pendingDate) : new Date();
  const diff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : null;
}

function formatCurrency(value: number | null): string {
  if (value == null) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPct(value: number | null): string {
  if (value == null) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

const statusColor: Record<string, string> = {
  prepping: "bg-blue-100 text-blue-800",
  active: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  sold: "bg-red-100 text-red-800",
};

const STATUS_FILTERS = ["all", "active", "pending", "sold"] as const;

const tooltipStyle = {
  backgroundColor: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  fontSize: "13px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

const axisTickStyle = { fontSize: 12, fill: "#6b7280" };

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ── Sort helpers ─────────────────────────────────────────────────────────────

type SortKey = "property" | "status" | "dom" | "totalGroups" | "disclosurePkgs" | "conversionPct" | "offers" | "listPrice" | "salePrice" | "pctOverUnder";

function getSortValue(s: ListingSummary, key: SortKey): number | string | null {
  switch (key) {
    case "property": return s.listing.property_address;
    case "status": return s.listing.status;
    case "dom": return s.dom;
    case "totalGroups": return s.totalGroups;
    case "disclosurePkgs": return s.disclosurePkgs;
    case "conversionPct": return s.conversionPct;
    case "offers": return s.offers;
    case "listPrice": return s.listing.list_price;
    case "salePrice": return s.listing.sale_price;
    case "pctOverUnder": return s.pctOverUnder;
  }
}

function compareSummaries(a: ListingSummary, b: ListingSummary, key: SortKey, dir: "asc" | "desc"): number {
  const aVal = getSortValue(a, key);
  const bVal = getSortValue(b, key);
  if (aVal == null && bVal == null) return 0;
  if (aVal == null) return 1;
  if (bVal == null) return -1;
  const cmp = typeof aVal === "string" ? aVal.localeCompare(bVal as string) : (aVal as number) - (bVal as number);
  return dir === "asc" ? cmp : -cmp;
}

// ── Page Component ───────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [summaries, setSummaries] = useState<ListingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedListingId, setSelectedListingId] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("property");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);

    const [listingsRes, activityRes] = await Promise.all([
      supabase
        .from("listings")
        .select("id, property_address, status, list_date, pending_date, sold_date, list_price, sale_price, offers_received")
        .order("property_address"),
      supabase
        .from("activity_entries")
        .select("listing_id, type, buyer_packet_requested, open_house_groups"),
    ]);

    const listings: Listing[] = (listingsRes.data ?? []) as Listing[];
    const activities: ActivityEntry[] = (activityRes.data ?? []) as ActivityEntry[];

    const computed = listings.map((listing) => {
      const entries = activities.filter((a) => a.listing_id === listing.id);

      const buyerShowings = entries.filter((e) => e.type === "buyer_showing").length;
      const ohGroups = entries
        .filter((e) => e.type === "open_house")
        .reduce((sum, e) => sum + (e.open_house_groups ?? 0), 0);
      const totalGroups = buyerShowings + ohGroups;

      const disclosurePkgs = entries.filter((e) => e.buyer_packet_requested).length;
      const conversionPct = totalGroups > 0 ? (disclosurePkgs / totalGroups) * 100 : null;
      const offers = listing.offers_received ?? 0;
      const dom = daysOnMarket(listing.list_date, listing.pending_date);

      let pctOverUnder: number | null = null;
      if (listing.list_price && listing.sale_price && listing.list_price > 0) {
        pctOverUnder = ((listing.sale_price - listing.list_price) / listing.list_price) * 100;
      }

      return { listing, dom, totalGroups, disclosurePkgs, conversionPct, offers, pctOverUnder };
    });

    setSummaries(computed);
    setLoading(false);
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filtered = summaries.filter(
    (s) => statusFilter === "all" || s.listing.status === statusFilter
  );

  const sorted = [...filtered].sort((a, b) => compareSummaries(a, b, sortKey, sortDir));

  const selected = summaries.find((s) => s.listing.id === selectedListingId) ?? null;

  const funnelData = selected
    ? [
        { stage: "Groups", count: selected.totalGroups },
        { stage: "Disclosures", count: selected.disclosurePkgs },
        { stage: "Offers", count: selected.offers },
      ]
    : [];

  if (loading) {
    return (
      <div className="max-w-5xl">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Analytics</h2>
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  function SortHeader({ label, colKey, className }: { label: string; colKey: SortKey; className?: string }) {
    const active = sortKey === colKey;
    return (
      <th className={`px-3 sm:px-4 py-3 font-medium ${className ?? ""}`}>
        <button
          onClick={() => handleSort(colKey)}
          className="inline-flex items-center gap-1 hover:text-gray-900 transition-colors"
        >
          {label}
          {active && <span className="text-xs">{sortDir === "asc" ? "↑" : "↓"}</span>}
        </button>
      </th>
    );
  }

  return (
    <div className="max-w-6xl">
      <h2 className="text-2xl font-semibold text-gray-900 mb-6">Analytics</h2>

      {/* Status filter pills */}
      <div className="flex gap-2 mb-6">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === f
                ? "bg-green-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Cross-listing summary table */}
      {sorted.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-12 text-center text-gray-400">
          No listings found
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <SortHeader label="Property" colKey="property" />
                  <SortHeader label="Status" colKey="status" />
                  <SortHeader label="DOM" colKey="dom" />
                  <SortHeader label="Groups" colKey="totalGroups" />
                  <SortHeader label="Disclosures" colKey="disclosurePkgs" />
                  <SortHeader label="Conv %" colKey="conversionPct" />
                  <SortHeader label="Offers" colKey="offers" />
                  <SortHeader label="List Price" colKey="listPrice" className="hidden sm:table-cell" />
                  <SortHeader label="Sale Price" colKey="salePrice" className="hidden sm:table-cell" />
                  <SortHeader label="% Over/Under" colKey="pctOverUnder" className="hidden sm:table-cell" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((s) => {
                  const isSelected = selectedListingId === s.listing.id;
                  return (
                    <tr
                      key={s.listing.id}
                      onClick={() => setSelectedListingId(isSelected ? "" : s.listing.id)}
                      className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                        isSelected ? "bg-green-50/50 border-l-2 border-green-600" : ""
                      }`}
                    >
                      <td className="px-3 sm:px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">
                        {s.listing.property_address}
                      </td>
                      <td className="px-3 sm:px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColor[s.listing.status] ?? "bg-gray-100 text-gray-800"}`}>
                          {s.listing.status}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 text-gray-700">{s.dom ?? "--"}</td>
                      <td className="px-3 sm:px-4 py-3 text-gray-700">{s.totalGroups}</td>
                      <td className="px-3 sm:px-4 py-3 text-gray-700">{s.disclosurePkgs}</td>
                      <td className="px-3 sm:px-4 py-3 text-gray-700">{s.conversionPct != null ? `${s.conversionPct.toFixed(1)}%` : "--"}</td>
                      <td className="px-3 sm:px-4 py-3 text-gray-700">{s.offers}</td>
                      <td className="px-3 sm:px-4 py-3 text-gray-700 hidden sm:table-cell">{formatCurrency(s.listing.list_price)}</td>
                      <td className="px-3 sm:px-4 py-3 text-gray-700 hidden sm:table-cell">{formatCurrency(s.listing.sale_price)}</td>
                      <td className={`px-3 sm:px-4 py-3 font-medium hidden sm:table-cell ${
                        s.pctOverUnder == null ? "text-gray-400" : s.pctOverUnder >= 0 ? "text-green-700" : "text-red-600"
                      }`}>
                        {formatPct(s.pctOverUnder)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Per-listing detail */}
      {selected && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{selected.listing.property_address}</h3>

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Groups" value={selected.totalGroups} sub="Showings + OH groups" />
            <StatCard
              label="Disclosure Pkgs"
              value={selected.disclosurePkgs}
              sub={selected.conversionPct != null ? `${selected.conversionPct.toFixed(1)}% conversion` : undefined}
            />
            <StatCard label="Offers" value={selected.offers} />
            <StatCard label="Days on Market" value={selected.dom ?? "--"} />
          </div>

          {/* Funnel chart + Outcome */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Funnel bar chart */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 sm:p-6">
              <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Sales Funnel</h4>
              {selected.totalGroups === 0 && selected.offers === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                  No activity data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={funnelData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="stage" tick={axisTickStyle} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} />
                    <YAxis tick={axisTickStyle} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill="#00B04F" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Outcome card */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 sm:p-6">
              <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Outcome</h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500">Days on Market</span>
                  <span className="text-sm font-semibold text-gray-900">{selected.dom ?? "--"}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500">List Price</span>
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(selected.listing.list_price)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500">Sale Price</span>
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(selected.listing.sale_price)}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-500">% Over/Under List</span>
                  <span className={`text-sm font-semibold ${
                    selected.pctOverUnder == null ? "text-gray-400" : selected.pctOverUnder >= 0 ? "text-green-700" : "text-red-600"
                  }`}>
                    {formatPct(selected.pctOverUnder)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
