"use client";

import { useState, useEffect } from "react";
import { getListings, getAllActivityEntries } from "@/lib/actions";
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
  property_type: string | null;
}

interface ActivityEntry {
  listing_id: string;
  type: string;
  buyer_packet_requested: boolean;
  open_house_groups: number | null;
  date: string;
}

interface ListingSummary {
  listing: Listing;
  dom: number | null;
  totalGroups: number;
  disclosurePkgs: number;
  conversionPct: number | null;
  offers: number;
  offersToGroupsPct: number | null;
  offersToDisclosuresPct: number | null;
  pctOverUnder: number | null;
}

type DatePreset = 'all' | 'ytd' | 'last-year' | 'last-30' | 'last-90' | 'custom';
type PropTypeFilter = 'all' | 'single_family' | 'condo' | 'townhome';

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

function getDateRange(preset: DatePreset, customFrom: string, customTo: string): { from: string | null; to: string | null } {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  switch (preset) {
    case 'all': return { from: null, to: null };
    case 'ytd': return { from: `${today.getFullYear()}-01-01`, to: todayStr };
    case 'last-year': {
      const y = today.getFullYear() - 1;
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    }
    case 'last-30': {
      const d = new Date(today); d.setDate(d.getDate() - 30);
      return { from: d.toISOString().split('T')[0], to: todayStr };
    }
    case 'last-90': {
      const d = new Date(today); d.setDate(d.getDate() - 90);
      return { from: d.toISOString().split('T')[0], to: todayStr };
    }
    case 'custom': return { from: customFrom || null, to: customTo || null };
  }
}

function computeVelocity(listing: Listing, entries: ActivityEntry[]): { week: string; groups: number }[] {
  if (!listing.list_date) return [];
  const listDate = new Date(listing.list_date);
  const relevant = entries.filter(
    e => e.listing_id === listing.id && (e.type === 'buyer_showing' || e.type === 'open_house')
  );
  const byWeek: Record<number, number> = {};
  for (const e of relevant) {
    if (!e.date) continue;
    const dayDiff = Math.floor((new Date(e.date).getTime() - listDate.getTime()) / 86400000);
    if (dayDiff < 0) continue;
    const week = Math.floor(dayDiff / 7) + 1;
    const groups = e.type === 'buyer_showing' ? 1 : (e.open_house_groups ?? 0);
    byWeek[week] = (byWeek[week] ?? 0) + groups;
  }
  if (Object.keys(byWeek).length === 0) return [];
  const maxWeek = Math.max(...Object.keys(byWeek).map(Number));
  return Array.from({ length: maxWeek }, (_, i) => ({
    week: `Wk ${i + 1}`,
    groups: byWeek[i + 1] ?? 0,
  }));
}

const statusColor: Record<string, string> = {
  prepping: "bg-blue-100 text-blue-800",
  active: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  sold: "bg-red-100 text-red-800",
};

const tooltipStyle = {
  backgroundColor: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  fontSize: "13px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

const axisTickStyle = { fontSize: 12, fill: "#6b7280" };

const PROP_TYPE_LABELS: Record<PropTypeFilter, string> = {
  all: "All",
  single_family: "Single Family",
  condo: "Condo",
  townhome: "Townhome",
};

const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  all: "All Time",
  ytd: "YTD",
  "last-year": "Last Year",
  "last-30": "Last 30",
  "last-90": "Last 90",
  custom: "Custom",
};

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
  const [allEntries, setAllEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedListingId, setSelectedListingId] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("property");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Filters
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(
    () => new Set(['prepping', 'active', 'pending', 'sold'])
  );
  const [propTypeFilter, setPropTypeFilter] = useState<PropTypeFilter>('all');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);

    const [listingsRes, activityRes] = await Promise.all([
      getListings("property_address", true),
      getAllActivityEntries(),
    ]);

    const listings: Listing[] = (listingsRes.data ?? []) as Listing[];
    const activities: ActivityEntry[] = (activityRes.data ?? []) as ActivityEntry[];

    setAllEntries(activities);

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
      const offersToGroupsPct = totalGroups > 0 ? (offers / totalGroups) * 100 : null;
      const offersToDisclosuresPct = disclosurePkgs > 0 ? (offers / disclosurePkgs) * 100 : null;
      const dom = daysOnMarket(listing.list_date, listing.pending_date);

      let pctOverUnder: number | null = null;
      if (listing.list_price && listing.sale_price && listing.list_price > 0) {
        pctOverUnder = ((listing.sale_price - listing.list_price) / listing.list_price) * 100;
      }

      return { listing, dom, totalGroups, disclosurePkgs, conversionPct, offers, offersToGroupsPct, offersToDisclosuresPct, pctOverUnder };
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

  function toggleStatus(status: string) {
    setActiveStatuses(prev => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }

  const { from: dateFrom, to: dateTo } = getDateRange(datePreset, customFrom, customTo);

  const filtered = summaries.filter(s => {
    if (!activeStatuses.has(s.listing.status)) return false;
    if (propTypeFilter !== 'all' && (s.listing.property_type ?? '') !== propTypeFilter) return false;
    if (dateFrom && s.listing.list_date && s.listing.list_date < dateFrom) return false;
    if (dateTo && s.listing.list_date && s.listing.list_date > dateTo) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => compareSummaries(a, b, sortKey, sortDir));

  const selected = summaries.find((s) => s.listing.id === selectedListingId) ?? null;

  // Aggregate stats for filtered listings
  const aggTotalGroups = filtered.reduce((sum, s) => sum + s.totalGroups, 0);
  const aggDisclosures = filtered.reduce((sum, s) => sum + s.disclosurePkgs, 0);
  const aggOffers = filtered.reduce((sum, s) => sum + s.offers, 0);
  const aggDiscConv = aggTotalGroups > 0 ? (aggDisclosures / aggTotalGroups) * 100 : null;
  const aggOffersToGroups = aggTotalGroups > 0 ? (aggOffers / aggTotalGroups) * 100 : null;
  const aggOffersToDisc = aggDisclosures > 0 ? (aggOffers / aggDisclosures) * 100 : null;

  // Sold benchmarks — always sold, but respects date range + property type (not status checkboxes)
  const soldForBenchmarks = summaries.filter(s => {
    if (s.listing.status !== 'sold') return false;
    if (propTypeFilter !== 'all' && (s.listing.property_type ?? '') !== propTypeFilter) return false;
    if (dateFrom && s.listing.list_date && s.listing.list_date < dateFrom) return false;
    if (dateTo && s.listing.list_date && s.listing.list_date > dateTo) return false;
    return true;
  });
  const soldCount = soldForBenchmarks.length;
  const avgDom = soldCount > 0
    ? soldForBenchmarks.reduce((sum, s) => sum + (s.dom ?? 0), 0) / soldCount
    : null;
  const soldWithPct = soldForBenchmarks.filter(s => s.pctOverUnder != null);
  const avgPctOver = soldWithPct.length > 0
    ? soldWithPct.reduce((sum, s) => sum + s.pctOverUnder!, 0) / soldWithPct.length
    : null;
  const avgOffers = soldCount > 0
    ? soldForBenchmarks.reduce((sum, s) => sum + s.offers, 0) / soldCount
    : null;
  const avgGroups = soldCount > 0
    ? soldForBenchmarks.reduce((sum, s) => sum + s.totalGroups, 0) / soldCount
    : null;

  const aggFunnelData = [
    { stage: "Groups", count: aggTotalGroups },
    { stage: "Disclosures", count: aggDisclosures },
    { stage: "Offers", count: aggOffers },
  ];

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

      {/* ── Filters ── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-6 space-y-4">
        {/* Date range */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Date Range</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(DATE_PRESET_LABELS) as DatePreset[]).map(preset => (
              <button
                key={preset}
                onClick={() => setDatePreset(preset)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  datePreset === preset
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {DATE_PRESET_LABELS[preset]}
              </button>
            ))}
          </div>
          {datePreset === 'custom' && (
            <div className="flex items-center gap-3 mt-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">From</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">To</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Status */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Status</p>
          <div className="flex flex-wrap gap-4">
            {[
              { value: 'prepping', label: 'Preparing to List' },
              { value: 'active', label: 'Active' },
              { value: 'pending', label: 'Pending' },
              { value: 'sold', label: 'Sold' },
            ].map(({ value, label }) => (
              <label key={value} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={activeStatuses.has(value)}
                  onChange={() => toggleStatus(value)}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-600"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Property type */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Property Type</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PROP_TYPE_LABELS) as PropTypeFilter[]).map(pt => (
              <button
                key={pt}
                onClick={() => setPropTypeFilter(pt)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  propTypeFilter === pt
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {PROP_TYPE_LABELS[pt]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Aggregate funnel — all filtered listings */}
      {filtered.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
            All Listings Overview
            <span className="ml-2 text-xs font-normal text-gray-400 normal-case">({filtered.length} listing{filtered.length !== 1 ? "s" : ""})</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <StatCard label="Total Groups" value={aggTotalGroups} />
            <StatCard label="Disclosures" value={aggDisclosures} sub={aggDiscConv != null ? `${aggDiscConv.toFixed(1)}% of groups` : undefined} />
            <StatCard label="Offers" value={aggOffers} />
            <StatCard label="Offers / Groups" value={aggOffersToGroups != null ? `${aggOffersToGroups.toFixed(1)}%` : "--"} />
            <StatCard label="Offers / Disclosures" value={aggOffersToDisc != null ? `${aggOffersToDisc.toFixed(1)}%` : "--"} />
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
              <p className="text-sm font-medium text-gray-500 mb-2">Funnel</p>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={aggFunnelData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <Bar dataKey="count" fill="#00B04F" radius={[4, 4, 0, 0]} />
                  <XAxis dataKey="stage" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Sold benchmarks */}
      {soldCount > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
            Sold Benchmarks
            <span className="ml-2 text-xs font-normal text-gray-400 normal-case">({soldCount} sold listing{soldCount !== 1 ? "s" : ""})</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Avg DOM" value={avgDom != null ? avgDom.toFixed(0) : "--"} sub="days on market" />
            <StatCard label="Avg Groups" value={avgGroups != null ? avgGroups.toFixed(1) : "--"} sub="per listing" />
            <StatCard label="Avg Offers" value={avgOffers != null ? avgOffers.toFixed(1) : "--"} sub="per listing" />
            <StatCard label="Avg % Over List" value={avgPctOver != null ? formatPct(avgPctOver) : "--"} sub="sale vs list price" />
          </div>
        </div>
      )}

      {/* Cross-listing summary table */}
      {sorted.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-12 text-center text-gray-400">
          No listings match the current filters
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <StatCard label="Total Groups" value={selected.totalGroups} sub="Showings + OH groups" />
            <StatCard
              label="Disclosure Pkgs"
              value={selected.disclosurePkgs}
              sub={selected.conversionPct != null ? `${selected.conversionPct.toFixed(1)}% of groups` : undefined}
            />
            <StatCard label="Offers" value={selected.offers} />
            <StatCard label="Offers / Groups" value={selected.offersToGroupsPct != null ? `${selected.offersToGroupsPct.toFixed(1)}%` : "--"} />
            <StatCard label="Offers / Disclosures" value={selected.offersToDisclosuresPct != null ? `${selected.offersToDisclosuresPct.toFixed(1)}%` : "--"} />
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

          {/* Activity velocity chart */}
          {(() => {
            const velocityData = computeVelocity(selected.listing, allEntries);
            if (velocityData.length === 0) return null;
            return (
              <div className="mt-6 bg-white border border-gray-200 rounded-xl shadow-sm p-4 sm:p-6">
                <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
                  Activity by Week
                  <span className="ml-2 text-xs font-normal text-gray-400 normal-case">groups from list date</span>
                </h4>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={velocityData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="week" tick={axisTickStyle} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} />
                    <YAxis tick={axisTickStyle} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, "Groups"]} />
                    <Bar dataKey="groups" fill="#00B04F" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
