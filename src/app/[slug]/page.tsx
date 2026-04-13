import { notFound } from "next/navigation";
import { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase";
import PlatformViewsChart from "@/components/PlatformViewsChart";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysOnMarket(listDate: string): number {
  const start = new Date(listDate + "T00:00:00");
  const now = new Date();
  const diff = now.getTime() - start.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-3xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}

// ── Activity Entry Row ───────────────────────────────────────────────────────

function ActivityRow({
  date,
  agentName,
  isRepeat,
  buyerPacket,
  feedback,
  feedbackVisible,
  groups,
}: {
  date: string;
  agentName?: string | null;
  isRepeat?: boolean;
  buyerPacket?: boolean;
  feedback?: string | null;
  feedbackVisible?: boolean;
  groups?: number | null;
}) {
  return (
    <div className="border-b border-gray-100 last:border-b-0 py-3">
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <span className="text-sm font-medium text-gray-900">
          {formatDate(date)}
        </span>
        {agentName && (
          <span className="text-sm text-gray-600">&mdash; {agentName}</span>
        )}
        {groups != null && (
          <span className="text-sm text-gray-600">
            &mdash; {groups} group{groups !== 1 ? "s" : ""}
          </span>
        )}
        {isRepeat && (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
            2nd Visit
          </span>
        )}
        {buyerPacket && (
          <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-200">
            Buyer Packet Requested
          </span>
        )}
      </div>
      {feedbackVisible && feedback && (
        <p className="text-sm text-gray-500 mt-1 pl-0.5">{feedback}</p>
      )}
    </div>
  );
}

// ── Page Component ───────────────────────────────────────────────────────────

export default async function ClientDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Fetch listing by slug
  const { data: listing, error } = await supabaseAdmin
    .from("listings")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !listing) {
    notFound();
  }

  // Prepping state — holding page
  if (listing.status === "prepping") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight mb-1">
          Aufhammer Homes
        </h1>
        <div className="w-12 h-px bg-gray-200 my-6" />
        <p className="text-gray-500 text-lg max-w-sm">
          This listing is being prepared. Check back soon.
        </p>
      </div>
    );
  }

  // Fetch activity entries for this listing
  const { data: activityEntries } = await supabaseAdmin
    .from("activity_entries")
    .select("*")
    .eq("listing_id", listing.id)
    .order("date", { ascending: false });

  const entries = activityEntries ?? [];

  // Fetch platform views for this listing
  const { data: platformViews } = await supabaseAdmin
    .from("platform_views")
    .select("*")
    .eq("listing_id", listing.id)
    .order("date", { ascending: true });

  const views = platformViews ?? [];

  // ── Compute stats ──────────────────────────────────────────────────────

  const dom = listing.list_date ? daysOnMarket(listing.list_date) : 0;

  const buyerShowings = entries.filter(
    (e: { type: string }) => e.type === "buyer_showing"
  );
  const agentPreviews = entries.filter(
    (e: { type: string }) => e.type === "agent_preview"
  );
  const openHouses = entries.filter(
    (e: { type: string }) => e.type === "open_house"
  );

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

  const showingsLast7 = entries.filter(
    (e: { type: string; date: string }) =>
      (e.type === "buyer_showing" || e.type === "agent_preview") &&
      e.date >= sevenDaysAgoStr
  ).length;

  const totalOpenHouseGroups = openHouses.reduce(
    (sum: number, e: { open_house_groups?: number | null }) =>
      sum + (e.open_house_groups ?? 0),
    0
  );

  // Latest platform view counts
  const latestView = views.length > 0 ? views[views.length - 1] : null;

  const showPlatformViews = listing.zillow_visible || listing.redfin_visible;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">
          Aufhammer Homes
        </h1>
        <p className="text-gray-400 text-sm mt-1">Listing Activity Dashboard</p>
      </header>

      {/* Property Info */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">
          {listing.address}
        </h2>
        {listing.photo_url && (
          <div className="relative w-full h-64 sm:h-80 rounded-xl overflow-hidden mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={listing.photo_url}
              alt={listing.address}
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </section>

      {/* Stats Row */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-10">
        <StatCard label="Days on Market" value={dom} />
        <StatCard label="Buyer Showings" value={buyerShowings.length} />
        <StatCard label="Agent Previews" value={agentPreviews.length} />
        <StatCard label="Showings (7 Days)" value={showingsLast7} />
        <StatCard label="Open House Groups" value={totalOpenHouseGroups} />
      </section>

      {/* Activity Log */}
      <section className="mb-10">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Activity Log
        </h3>

        {/* Buyer Showings */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
            Buyer Showings
          </h4>
          {buyerShowings.length === 0 ? (
            <p className="text-sm text-gray-400">No buyer showings yet</p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              {buyerShowings.map(
                (entry: {
                  id: string;
                  date: string;
                  agent_name?: string | null;
                  is_repeat_visit?: boolean;
                  buyer_packet_requested?: boolean;
                  display_feedback?: string | null;
                  feedback_visible?: boolean;
                }) => (
                  <ActivityRow
                    key={entry.id}
                    date={entry.date}
                    agentName={entry.agent_name}
                    isRepeat={entry.is_repeat_visit}
                    buyerPacket={entry.buyer_packet_requested}
                    feedback={entry.display_feedback}
                    feedbackVisible={entry.feedback_visible}
                  />
                )
              )}
            </div>
          )}
        </div>

        {/* Agent Previews */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
            Agent Previews
          </h4>
          {agentPreviews.length === 0 ? (
            <p className="text-sm text-gray-400">No agent previews yet</p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              {agentPreviews.map(
                (entry: {
                  id: string;
                  date: string;
                  agent_name?: string | null;
                  is_repeat_visit?: boolean;
                  buyer_packet_requested?: boolean;
                  display_feedback?: string | null;
                  feedback_visible?: boolean;
                }) => (
                  <ActivityRow
                    key={entry.id}
                    date={entry.date}
                    agentName={entry.agent_name}
                    isRepeat={entry.is_repeat_visit}
                    buyerPacket={entry.buyer_packet_requested}
                    feedback={entry.display_feedback}
                    feedbackVisible={entry.feedback_visible}
                  />
                )
              )}
            </div>
          )}
        </div>

        {/* Open Houses */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
            Open Houses
          </h4>
          {openHouses.length === 0 ? (
            <p className="text-sm text-gray-400">No open houses yet</p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              {openHouses.map(
                (entry: {
                  id: string;
                  date: string;
                  open_house_groups?: number | null;
                  display_feedback?: string | null;
                  feedback_visible?: boolean;
                }) => (
                  <ActivityRow
                    key={entry.id}
                    date={entry.date}
                    groups={entry.open_house_groups}
                    feedback={entry.display_feedback}
                    feedbackVisible={entry.feedback_visible}
                  />
                )
              )}
            </div>
          )}
        </div>
      </section>

      {/* Platform Views */}
      {showPlatformViews && (
        <section className="mb-10">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Platform Views
          </h3>

          {/* Current counts */}
          {latestView && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {listing.zillow_visible && (
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <p className="text-xs text-gray-500 mb-1">Zillow Views</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {latestView.zillow_views?.toLocaleString() ?? "—"}
                  </p>
                </div>
              )}
              {listing.redfin_visible && (
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <p className="text-xs text-gray-500 mb-1">Redfin Views</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {latestView.redfin_views?.toLocaleString() ?? "—"}
                  </p>
                </div>
              )}
              {listing.realtor_visible && (
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <p className="text-xs text-gray-500 mb-1">Realtor.com Views</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {latestView.realtor_views?.toLocaleString() ?? "—"}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Chart */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-sm">
            <PlatformViewsChart
              data={views.map(
                (v: {
                  date: string;
                  zillow_views: number | null;
                  redfin_views: number | null;
                  realtor_views: number | null;
                }) => ({
                  date: v.date,
                  zillow_views: v.zillow_views,
                  redfin_views: v.redfin_views,
                  realtor_views: v.realtor_views,
                })
              )}
              zillowVisible={listing.zillow_visible ?? false}
              redfinVisible={listing.redfin_visible ?? false}
              realtorVisible={listing.realtor_visible ?? false}
            />
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-100 pt-6 mt-10 text-center">
        <p className="text-xs text-gray-400">
          Powered by Aufhammer Homes
        </p>
      </footer>
    </div>
  );
}
