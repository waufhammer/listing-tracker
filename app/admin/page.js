import { getListings } from '@/lib/airtable';
import { getActivities, computeSummary } from '@/lib/airtable';
import NewListingModal from '@/components/NewListingModal';
import CopyLinkButton from '@/components/CopyLinkButton';
import LogoutButton from '@/components/LogoutButton';
import Link from 'next/link';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || '';

const STATUS_COLORS = {
  Active: 'bg-brand-green-light text-brand-green',
  'Coming Soon': 'bg-yellow-50 text-yellow-700',
  'Under Contract': 'bg-orange-50 text-orange-700',
  Sold: 'bg-gray-100 text-gray-600',
  Withdrawn: 'bg-red-50 text-red-600',
};

function dom(listingDate) {
  if (!listingDate) return null;
  return Math.floor((Date.now() - new Date(listingDate)) / (1000 * 60 * 60 * 24));
}

export default async function AdminPage() {
  let listings = [];
  let listingStats = {};

  try {
    listings = await getListings();
    // Fetch activity counts for each listing in parallel
    const statsArr = await Promise.all(
      listings.map(async (l) => {
        try {
          const acts = await getActivities(l.id);
          const s = computeSummary(acts, l.listingDate);
          return { id: l.id, ...s, total: acts.length };
        } catch {
          return { id: l.id, buyerShowings: 0, total: 0 };
        }
      })
    );
    statsArr.forEach((s) => { listingStats[s.id] = s; });
  } catch (err) {
    console.error('Failed to fetch listings:', err);
  }

  return (
    <div className="min-h-screen bg-brand-gray">
      {/* Header */}
      <header className="bg-white border-b border-brand-gray-medium sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-green flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-brand-dark">Listing Activity Tracker</h1>
          </div>
          <div className="flex items-center gap-3">
            <NewListingModal baseUrl={BASE_URL} />
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {listings.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-14 h-14 rounded-full bg-brand-green-light flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-brand-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-brand-dark mb-2">No listings yet</h2>
            <p className="text-brand-gray-text text-sm mb-6">Create your first listing to get started.</p>
            <NewListingModal baseUrl={BASE_URL} />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-semibold text-brand-gray-text uppercase tracking-wide">
                {listings.length} Listing{listings.length !== 1 ? 's' : ''}
              </h2>
            </div>
            <div className="space-y-3">
              {listings.map((l) => {
                const stats = listingStats[l.id] || {};
                const days = dom(l.listingDate);
                const clientUrl = `${BASE_URL}/listing/${l.token}`;
                return (
                  <div key={l.id} className="card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-brand-dark truncate">{l.address}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[l.status] || 'bg-gray-100 text-gray-600'}`}>
                          {l.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 mt-2 text-sm text-brand-gray-text">
                        {l.listPrice && <span>{l.listPrice}</span>}
                        {days !== null && <span>{days} days on market</span>}
                        <span>{stats.buyerShowings ?? 0} showings</span>
                        {stats.total > 0 && <span>{stats.total} total activities</span>}
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <CopyLinkButton url={clientUrl} label="Copy Link" />
                      <Link href={`/admin/listing/${l.id}`} className="btn-secondary">
                        Manage →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
