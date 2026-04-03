'use client';
import { useState } from 'react';
import ActivityLogTab from './ActivityLogTab';

function fmt(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ViewsCard({ platform, views, url, updatedDate, color }) {
  return (
    <div className="card p-6 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className={`text-sm font-semibold ${color}`}>{platform}</span>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-gray-text hover:text-brand-dark underline">
            View listing ↗
          </a>
        )}
      </div>
      <div className="text-4xl font-bold text-brand-dark">
        {views !== null && views !== undefined ? views.toLocaleString() : '—'}
      </div>
      <p className="text-xs text-brand-gray-text">
        {updatedDate ? `Updated ${fmt(updatedDate)}` : 'Not yet updated'}
      </p>
    </div>
  );
}

export default function ClientDashboardTabs({ activities, listing }) {
  const [tab, setTab] = useState('activity');

  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b border-brand-gray-medium mb-0">
        <button
          onClick={() => setTab('activity')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            tab === 'activity'
              ? 'text-brand-green border-b-2 border-brand-green -mb-px'
              : 'text-brand-gray-text hover:text-brand-dark'
          }`}
        >
          Activity Log
        </button>
        <button
          onClick={() => setTab('views')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            tab === 'views'
              ? 'text-brand-green border-b-2 border-brand-green -mb-px'
              : 'text-brand-gray-text hover:text-brand-dark'
          }`}
        >
          Online Views
        </button>
      </div>

      {/* Tab content */}
      <div className="card rounded-tl-none mt-0">
        {tab === 'activity' ? (
          <ActivityLogTab activities={activities} />
        ) : (
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ViewsCard
              platform="Zillow"
              views={listing.zillowViews}
              url={listing.zillowUrl}
              updatedDate={listing.zillowViewsUpdated}
              color="text-blue-600"
            />
            <ViewsCard
              platform="Redfin"
              views={listing.redfinViews}
              url={listing.redfinUrl}
              updatedDate={listing.redfinViewsUpdated}
              color="text-red-600"
            />
            <p className="col-span-full text-xs text-brand-gray-text mt-2">
              View counts are updated manually by your agent and reflect the number of times your listing has been viewed on each platform.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
