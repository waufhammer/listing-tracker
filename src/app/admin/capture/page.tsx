"use client";

import { useState, useEffect, FormEvent } from "react";
import Link from "next/link";
import { getListings, getPlatformViews, savePlatformViewCapture } from "@/lib/actions";
import { useAdminUserContext } from "@/lib/admin-user-context";

// Popup opened by the "Save views" browser button (see /admin/capture-button).
// The button passes the page it was clicked on in the URL hash:
// { u: url, t: title, v: views it found on the page, or "" }.

type Platform = "zillow" | "redfin" | "compass";

const PLATFORM_LABELS: Record<Platform, string> = {
  zillow: "Zillow",
  redfin: "Redfin",
  compass: "Compass",
};

interface Listing {
  id: string;
  property_address: string;
  status: string;
}

interface CapturedPage {
  url: string;
  title: string;
  views: string;
}

interface PlatformView {
  date: string;
  zillow_views: number | null;
  redfin_views: number | null;
  compass_views: number | null;
}

function readCapturedPage(): CapturedPage | null {
  try {
    const raw = decodeURIComponent(window.location.hash.slice(1));
    if (!raw) return null;
    const data = JSON.parse(raw);
    return {
      url: String(data.u ?? ""),
      title: String(data.t ?? ""),
      views: String(data.v ?? ""),
    };
  } catch {
    return null;
  }
}

function hostnameOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function platformFromUrl(url: string): Platform | "" {
  const host = hostnameOf(url);
  for (const platform of Object.keys(PLATFORM_LABELS) as Platform[]) {
    if (host === `${platform}.com` || host.endsWith(`.${platform}.com`)) {
      return platform;
    }
  }
  return "";
}

// "2568 28th Avenue W" and "2568 28th Ave W, Seattle, WA" both give
// "2568 28th" — street number plus the first word of the street name.
function addressKey(text: string) {
  const match = text.toLowerCase().match(/^\s*(\d+[a-z]?)\s+([a-z0-9]+)/);
  return match ? `${match[1]} ${match[2]}` : null;
}

function findListingForPage(listings: Listing[], page: CapturedPage) {
  // Listing URLs spell the address with dashes, e.g. /2568-28th-Ave-W-98199/
  let path = "";
  try {
    path = new URL(page.url).pathname.replace(/[-/_]+/g, " ");
  } catch {
    // Unparseable URL; match on the title only
  }
  const haystack = `${page.title} ${path}`.toLowerCase();
  return listings.find((l) => {
    const key = addressKey(l.property_address);
    return key && new RegExp(`(^|\\D)${key}\\b`).test(haystack);
  });
}

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function CapturePage() {
  const { user, setUser, profiles } = useAdminUserContext();
  const [page, setPage] = useState<CapturedPage | null>(null);
  const [checkedHash, setCheckedHash] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingId, setListingId] = useState("");
  const [platform, setPlatform] = useState<Platform | "">("");
  const [views, setViews] = useState<number | "">("");
  const [date, setDate] = useState(todayLocal());
  const [lastRecorded, setLastRecorded] = useState<{
    listingId: string;
    platform: Platform;
    date: string;
    views: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const captured = readCapturedPage();
    const listingsRequest = captured
      ? getListings("property_address", true)
      : Promise.resolve({ data: [] as Listing[] });

    listingsRequest.then(({ data }) => {
      setPage(captured);
      setCheckedHash(true);
      if (!captured) return;

      setPlatform(platformFromUrl(captured.url));
      setViews(captured.views === "" ? "" : parseInt(captured.views));
      const open = data.filter((l: Listing) => l.status !== "sold");
      setListings(open);
      const match = findListingForPage(open, captured);
      if (match) setListingId(match.id);
    });
  }, []);

  useEffect(() => {
    if (!listingId || !platform) return;
    getPlatformViews(listingId).then(({ data }) => {
      // Newest first; find the latest row with a count for this platform
      const latest = (data as PlatformView[]).find((row) => row[`${platform}_views`] != null);
      setLastRecorded(
        latest
          ? { listingId, platform, date: latest.date, views: latest[`${platform}_views`]! }
          : null
      );
    });
  }, [listingId, platform]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!platform || views === "") return;
    setSaving(true);
    setError("");

    const { error: saveError } = await savePlatformViewCapture({
      listing_id: listingId,
      date,
      platform,
      views,
      logged_by: user?.id ?? null,
    });

    if (saveError) {
      setError(saveError);
    } else {
      setSaved(true);
    }
    setSaving(false);
  }

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";
  const selectedListing = listings.find((l) => l.id === listingId);

  if (!checkedHash) return null;

  if (!page) {
    return (
      <div className="max-w-sm mx-auto p-6 text-sm text-gray-600 space-y-3">
        <h1 className="text-lg font-semibold text-gray-900">Save views</h1>
        <p>
          Open a listing on Zillow, Redfin or Compass and click the
          {" "}<strong>Save views</strong> button in your bookmarks bar.
        </p>
        <Link href="/admin/capture-button" className="text-blue-600 hover:underline">
          Set up the button
        </Link>
      </div>
    );
  }

  if (saved && selectedListing && platform) {
    return (
      <div className="max-w-sm mx-auto p-6 space-y-4">
        <h1 className="text-lg font-semibold text-gray-900">Saved</h1>
        <p className="text-sm text-gray-600">
          {PLATFORM_LABELS[platform]}: {Number(views).toLocaleString()} views for{" "}
          {selectedListing.property_address} on {formatDate(date)}.
        </p>
        <button
          onClick={() => window.close()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition-colors"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto p-6">
      <h1 className="text-lg font-semibold text-gray-900">Save views</h1>
      <p className="text-xs text-gray-500 mt-1 mb-5 truncate" title={page.url}>
        From {hostnameOf(page.url) || "this page"}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>Logging as</label>
          <select
            value={user?.id ?? ""}
            onChange={(e) => setUser(profiles.find((p) => p.id === e.target.value) ?? null)}
            required
            className={inputClass}
          >
            <option value="">Select...</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Listing</label>
          <select
            value={listingId}
            onChange={(e) => setListingId(e.target.value)}
            required
            className={inputClass}
          >
            <option value="">-- Choose a listing --</option>
            {listings.map((l) => (
              <option key={l.id} value={l.id}>{l.property_address}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Site</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform | "")}
              required
              className={inputClass}
            >
              <option value="">Select...</option>
              {(Object.keys(PLATFORM_LABELS) as Platform[]).map((p) => (
                <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Total views</label>
          <input
            type="number"
            min="0"
            value={views}
            onChange={(e) => setViews(e.target.value === "" ? "" : parseInt(e.target.value))}
            required
            autoFocus={page.views === ""}
            className={inputClass}
            placeholder="Cumulative"
          />
          {page.views === "" && (
            <p className="text-xs text-amber-700 mt-1">
              Couldn&apos;t find a view count on that page. Type it in.
            </p>
          )}
          {lastRecorded?.listingId === listingId && lastRecorded.platform === platform && (
            <p className="text-xs text-gray-500 mt-1">
              Last recorded: {lastRecorded.views.toLocaleString()} on {formatDate(lastRecorded.date)}
            </p>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </form>
    </div>
  );
}
