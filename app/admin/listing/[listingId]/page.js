import { getListing, getActivities } from '@/lib/airtable';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import CopyLinkButton from '@/components/CopyLinkButton';
import ListingEditor from '@/components/ListingEditor';
import ActivityManager from '@/components/ActivityManager';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || '';

const STATUS_COLORS = {
  Active: 'bg-brand-green-light text-brand-green',
  'Coming Soon': 'bg-yellow-50 text-yellow-700',
  'Under Contract': 'bg-orange-50 text-orange-700',
  Sold: 'bg-gray-100 text-gray-600',
  Withdrawn: 'bg-red-50 text-red-600',
};

export default async function ManageListingPage({ params }) {
  let listing, activities;

  try {
    listing = await getListing(params.listingId);
    activities = await getActivities(params.listingId);
  } catch {
    notFound();
  }

  if (!listing) notFound();

  const clientUrl = `${BASE_URL}/listing/${listing.token}`;

  return (
    <div className="min-h-screen bg-brand-gray">
      {/* Header */}
      <header className="bg-white border-b border-brand-gray-medium sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-brand-gray-text hover:text-brand-dark flex items-center gap-1 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              All Listings
            </Link>
            <span className="text-brand-gray-medium">/</span>
            <span className="text-sm font-medium text-brand-dark truncate max-w-xs">{listing.address}</span>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[listing.status] || 'bg-gray-100 text-gray-600'}`}>
            {listing.status}
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Client link banner */}
        <div className="card p-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-brand-gray-text uppercase tracking-wide mb-1">Client Link</p>
            <p className="text-sm text-brand-dark truncate font-mono">{clientUrl}</p>
          </div>
          <CopyLinkButton url={clientUrl} label="Copy Client Link" />
        </div>

        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Listing editor */}
          <div className="lg:col-span-1">
            <ListingEditor listing={listing} />
          </div>

          {/* Right: Activity manager */}
          <div className="lg:col-span-2">
            <ActivityManager activities={activities} listingId={listing.id} />
          </div>
        </div>
      </main>
    </div>
  );
}
