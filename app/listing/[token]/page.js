import { getListingByToken, getActivities, computeSummary } from '@/lib/airtable';
import { notFound } from 'next/navigation';
import ClientDashboardTabs from '@/components/ClientDashboardTabs';

const AGENT_NAME    = process.env.AGENT_NAME    || 'Your Agent';
const AGENT_COMPANY = process.env.AGENT_COMPANY || '';
const AGENT_PHONE   = process.env.AGENT_PHONE   || '';
const AGENT_EMAIL   = process.env.AGENT_EMAIL   || '';
const AGENT_PHOTO   = process.env.AGENT_PHOTO_URL || '';

const STATUS_STYLES = {
  Active:           'bg-brand-green-light text-brand-green',
  'Coming Soon':    'bg-yellow-50 text-yellow-700',
  'Under Contract': 'bg-orange-50 text-orange-700',
  Sold:             'bg-gray-100 text-gray-500',
  Withdrawn:        'bg-red-50 text-red-500',
};

function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtDateShort(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatCard({ value, label }) {
  return (
    <div className="bg-white rounded-lg border border-brand-gray-medium p-5 text-center">
      <div className="text-3xl font-bold text-brand-dark">{value ?? '—'}</div>
      <div className="text-xs text-brand-gray-text mt-1.5 leading-snug">{label}</div>
    </div>
  );
}

function AgentInitials(name) {
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

export default async function ClientDashboardPage({ params }) {
  const listing = await getListingByToken(params.token);
  if (!listing) notFound();

  const activities = await getActivities(listing.id);
  const summary = computeSummary(activities, listing.listingDate);

  const stats = [
    { value: summary.buyerShowings,  label: 'Buyer Showings' },
    { value: summary.agentPreviews,  label: 'Agent Previews' },
    { value: summary.openHouseGroups, label: 'Open House Groups' },
    { value: summary.recentShowings, label: 'Showings Last 7 Days' },
    { value: summary.buyerPackets,   label: 'Buyer Packets Sent' },
  ];

  return (
    <div className="min-h-screen bg-[#F6F6F6]">
      {/* ── Agent Header ── */}
      <header className="bg-white border-b border-[#E8E8E8]">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center gap-4">
          {/* Agent photo or initials */}
          {AGENT_PHOTO ? (
            <img
              src={AGENT_PHOTO}
              alt={AGENT_NAME}
              className="w-14 h-14 rounded-full object-cover flex-shrink-0 border border-[#E8E8E8]"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-[#1A1A1A] flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
              {AgentInitials(AGENT_NAME)}
            </div>
          )}
          <div>
            <p className="text-xl font-semibold text-[#1A1A1A] leading-tight">{AGENT_NAME}</p>
            {AGENT_COMPANY && <p className="text-sm text-[#6B7280]">{AGENT_COMPANY}</p>}
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {AGENT_PHONE && (
                <a href={`tel:${AGENT_PHONE}`} className="text-sm text-[#6B7280] hover:text-[#1A1A1A]">
                  {AGENT_PHONE}
                </a>
              )}
              {AGENT_PHONE && AGENT_EMAIL && <span className="text-[#D1D5DB]">·</span>}
              {AGENT_EMAIL && (
                <a href={`mailto:${AGENT_EMAIL}`} className="text-sm text-[#6B7280] hover:text-[#1A1A1A]">
                  {AGENT_EMAIL}
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Property info */}
        <div className="bg-white rounded-lg border border-[#E8E8E8] p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-[#1A1A1A] leading-tight">{listing.address}</h1>
              {listing.listPrice && (
                <p className="text-lg text-[#6B7280] mt-1 font-medium">{listing.listPrice}</p>
              )}
            </div>
            <span className={`text-sm px-3 py-1 rounded-full font-medium flex-shrink-0 ${STATUS_STYLES[listing.status] || 'bg-gray-100 text-gray-600'}`}>
              {listing.status}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 mt-4 text-sm text-[#6B7280]">
            {listing.listingDate && (
              <span>Listed {fmtDate(listing.listingDate)}</span>
              )}
            {summary.daysOnMarket !== null && summary.daysOnMarket >= 0 && (
              <>
                <span className="text-[#D1D5DB]">·</span>
                <span>
                  <span className="font-semibold text-[#1A1A1A]">{gsummary.daysOnMarket}</span> days on market
                </span>
              </>
            )}
          </div>
        </div>

        {/* Summary stats */}
        <div>
          <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-3">Activity Summary</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {stats.map((s) => (
              <StatCard key={s.label} value={s.value} label={s.label} />
            ))}
          </div>
        </div>

        {/* Tabbed content */}
        <ClientDashboardTabs activities={activities} listing={listing} />
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-6 py-8 text-center">
        <p className="text-xs text-[#9CA3AF]">
          Updated {fmtDateShort(new Date().toISOString())} · {AGENT_NAME}
          {AGENT_COMPANY ? ` · ${AGENT_COMPANY}` : ''}
        </p>
      </footer>
    </div>
  );
}
