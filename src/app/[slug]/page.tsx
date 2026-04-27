import { notFound } from "next/navigation";
import { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase";
import PlatformViewsChart from "@/components/PlatformViewsChart";
import ActivitySummaryChart from "@/components/ActivitySummaryChart";
import ActivityLog from "@/components/ActivityLog";
import CumulativeActivityChart from "@/components/CumulativeActivityChart";
import PageViewTracker from "@/components/PageViewTracker";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// ── Types ───────────────────────────────────────────────────────────────────

interface ActivityEntry {
  id: string;
  date: string;
  type: string;
  agent_name?: string | null;
  is_repeat_visit?: boolean;
  buyer_packet_requested?: boolean;
  display_feedback?: string | null;
  feedback_visible?: boolean;
  open_house_groups?: number | null;
  created_at?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function daysOnMarket(listDate: string, pendingDate?: string | null): number {
  const start = new Date(listDate + "T00:00:00");
  const end = pendingDate ? new Date(pendingDate + "T00:00:00") : new Date();
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatRelativeTime(isoStr: string): string {
  const date = new Date(isoStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}


const statusConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
  active: { label: "Active", bg: "bg-green-50", text: "text-green-800", border: "border-green-200" },
  pending: { label: "Pending", bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200" },
  sold: { label: "Sold", bg: "bg-red-50", text: "text-red-800", border: "border-red-200" },
};

const activityTypeConfig: Record<string, { label: string; color: string; dotColor: string }> = {
  buyer_showing: { label: "Buyer Showing", color: "text-gray-900", dotColor: "bg-green-500" },
  agent_preview: { label: "Agent Preview", color: "text-gray-900", dotColor: "bg-blue-500" },
  open_house: { label: "Open House", color: "text-gray-900", dotColor: "bg-amber-500" },
};

// ── Page Component ──────────────────────────────────────────────────────────

export default async function ClientDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: listing, error } = await supabaseAdmin
    .from("listings")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !listing) notFound();

  // Prepping — holding page
  if (listing.status === "prepping") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Aufhammer Homes" className="h-24 mb-8" />
        <div className="w-12 h-px bg-gray-200 mb-6" />
        <p className="text-gray-400 text-lg max-w-sm">
          This listing is being prepared. Check back soon.
        </p>
      </div>
    );
  }

  // Fetch activity + platform views
  const [{ data: activityEntries }, { data: platformViews }] = await Promise.all([
    supabaseAdmin
      .from("activity_entries")
      .select("*")
      .eq("listing_id", listing.id)
      .order("date", { ascending: false }),
    supabaseAdmin
      .from("platform_views")
      .select("*")
      .eq("listing_id", listing.id)
      .order("date", { ascending: true }),
  ]);

  const entries: ActivityEntry[] = activityEntries ?? [];
  const views = platformViews ?? [];

  // ── Compute stats ─────────────────────────────────────────────────────

  const dom = listing.list_date ? daysOnMarket(listing.list_date, listing.pending_date) : 0;

  const buyerShowings = entries.filter((e) => e.type === "buyer_showing");
  const agentPreviews = entries.filter((e) => e.type === "agent_preview");
  const openHouses = entries.filter((e) => e.type === "open_house");

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

  const showingsLast7 = entries.filter(
    (e) => (e.type === "buyer_showing" || e.type === "agent_preview") && e.date >= sevenDaysAgoStr
  ).length;

  const totalOpenHouseGroups = openHouses.reduce(
    (sum, e) => sum + (e.open_house_groups ?? 0),
    0
  );

  const disclosureRequests = entries.filter((e) => e.buyer_packet_requested).length;

  // Last updated
  const lastEntryCreated = entries.length > 0 ? entries[0].created_at : null;
  const lastViewCreated = views.length > 0 ? views[views.length - 1].created_at : null;
  const lastUpdated = [lastEntryCreated, lastViewCreated]
    .filter(Boolean)
    .sort()
    .pop() ?? null;

  // Platform views
  const latestView = views.length > 0 ? views[views.length - 1] : null;
  const showPlatformViews = listing.platform_views_public;

  const totalPlatformViews =
    (latestView?.zillow_views ?? 0) +
    (latestView?.redfin_views ?? 0) +
    (latestView?.compass_views ?? 0);

  // Activity summary data for horizontal bar chart
  const activitySummaryData = [
    { label: "Buyer Showings", value: buyerShowings.length },
    { label: "Agent Previews", value: agentPreviews.length },
    { label: "Open House Groups", value: totalOpenHouseGroups },
    { label: "Disclosure Packages", value: disclosureRequests },
  ];

  // Cumulative activity trend (showings + OH groups by date, ascending)
  const cumulativeActivity = (() => {
    const dayMap: Record<string, number> = {};
    entries.forEach((e) => {
      if (e.type === "buyer_showing" || e.type === "agent_preview") {
        dayMap[e.date] = (dayMap[e.date] ?? 0) + 1;
      } else if (e.type === "open_house") {
        dayMap[e.date] = (dayMap[e.date] ?? 0) + (e.open_house_groups ?? 0);
      }
    });
    const sorted = Object.entries(dayMap).sort(([a], [b]) => a.localeCompare(b));
    let cumulative = 0;
    return sorted.map(([date, count]) => {
      cumulative += count;
      return { date, total: cumulative };
    });
  })();

  const status = statusConfig[listing.status] ?? null;

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div>
      <PageViewTracker listingId={listing.id} />
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="mb-10">
        {/* Logo */}
        <div className="mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-horiz-black.png"
            alt="Aufhammer Homes"
            className="h-8 sm:h-10"
          />
        </div>

        {/* Photo + Details row */}
        <div className="flex items-start gap-6 sm:gap-8">
          {/* Property photo */}
          {listing.photo_url && (
            <div className="flex-shrink-0 w-36 sm:w-48">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={listing.photo_url}
                alt={listing.property_address}
                className="w-full aspect-[4/3] object-cover rounded-xl"
              />
            </div>
          )}

          {/* Property details */}
          <div className="flex-1 min-w-0 pt-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight leading-tight mb-2">
              {listing.property_address}
            </h1>
            <p className="text-sm text-gray-400 mb-3">
              {listing.client_name}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {status && (
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase ${status.bg} ${status.text} border ${status.border}`}>
                  {status.label}
                </span>
              )}
              {listing.list_date && (
                <span className="text-gray-400 text-sm font-medium">
                  {dom} days on market
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Status Banners ────────────────────────────────────── */}
      {listing.status === "sold" && (
        <div className="mb-8 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="text-sm font-semibold text-red-800">This property has been sold.</p>
          <p className="text-sm text-red-700 mt-1">Showing activity from the listing period is available below.</p>
        </div>
      )}

      {/* ── Main Content ─────────────────────────────────────── */}
      <div>

        {/* Last updated */}
        {lastUpdated && (
          <p className="text-xs text-gray-400 mb-6 tracking-wide uppercase">
            Last updated {formatRelativeTime(lastUpdated)}
          </p>
        )}

        {/* ── Showing Activity ─────────────────────────────── */}
        <section className="mb-10">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Showing Activity</h3>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-white border border-gray-100 rounded-xl px-3 py-3">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Showings</p>
              <p className="text-2xl font-bold text-gray-900">{buyerShowings.length}</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl px-3 py-3">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Previews</p>
              <p className="text-2xl font-bold text-gray-900">{agentPreviews.length}</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl px-3 py-3">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Open House Groups</p>
              <p className="text-2xl font-bold text-gray-900">{totalOpenHouseGroups}</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl px-3 py-3">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Disclosures</p>
              <p className="text-2xl font-bold text-gray-900">{disclosureRequests}</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl px-3 py-3">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Online Views</p>
              <p className="text-2xl font-bold text-gray-900">{showPlatformViews && latestView ? totalPlatformViews.toLocaleString() : "—"}</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-xl px-3 py-3">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Last 7 Days</p>
              <p className="text-2xl font-bold text-gray-900">{showingsLast7}</p>
            </div>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <ActivitySummaryChart data={activitySummaryData} />
          </div>
          {cumulativeActivity.length > 1 && (
            <div className="bg-white border border-gray-100 rounded-xl p-4 mt-3">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-3">Activity Over Time</p>
              <CumulativeActivityChart data={cumulativeActivity} />
            </div>
          )}
        </section>

        {/* ── Platform Views ──────────────────────────────── */}
        {showPlatformViews && (
          <section className="mb-10">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Online Views</h3>
            {latestView && (
              <div className="flex flex-wrap gap-x-5 gap-y-1 mb-3">
                {views.some((v: { zillow_views: number | null }) => v.zillow_views != null) && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#006AFF]" />
                    <span className="text-xs text-gray-400 uppercase">Zillow</span>
                    <span className="text-sm font-bold text-gray-900">{latestView.zillow_views?.toLocaleString() ?? "--"}</span>
                  </div>
                )}
                {views.some((v: { redfin_views: number | null }) => v.redfin_views != null) && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#A02021]" />
                    <span className="text-xs text-gray-400 uppercase">Redfin</span>
                    <span className="text-sm font-bold text-gray-900">{latestView.redfin_views?.toLocaleString() ?? "--"}</span>
                  </div>
                )}
                {views.some((v: { compass_views: number | null }) => v.compass_views != null) && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#000000]" />
                    <span className="text-xs text-gray-400 uppercase">Compass</span>
                    <span className="text-sm font-bold text-gray-900">{latestView.compass_views?.toLocaleString() ?? "--"}</span>
                  </div>
                )}
              </div>
            )}

            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <PlatformViewsChart
                data={views.map(
                  (v: {
                    date: string;
                    zillow_views: number | null;
                    redfin_views: number | null;
                    compass_views: number | null;
                  }) => ({
                    date: v.date,
                    zillow_views: v.zillow_views,
                    redfin_views: v.redfin_views,
                    compass_views: v.compass_views,
                  })
                )}
                listDate={listing.list_date ?? undefined}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
              Online view counts are provided for informational purposes only and should not be fully relied upon. These totals are sourced from third-party platforms whose reporting intervals vary — actual figures may not always reflect the most current data.
            </p>
          </section>
        )}

        {/* ── Activity Log ─────────────────────────────────── */}
        <section className="mb-10">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Activity and Feedback</h3>
          <ActivityLog
            entries={entries.map((e) => ({
              ...e,
              formattedDate: formatDate(e.date),
            }))}
            activityTypeConfig={activityTypeConfig}
          />
        </section>

        {/* ── Footer ───────────────────────────────────────── */}
        <footer className="border-t border-gray-100 pt-8 mt-4 pb-10 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Aufhammer Homes"
            className="h-16 mb-3 opacity-30"
          />
          <p className="text-[11px] text-gray-300 uppercase tracking-widest">
            Listing Activity Dashboard
          </p>
        </footer>
      </div>
    </div>
  );
}
