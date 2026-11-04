"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getListings, getWeeklyEmailPreview } from "@/lib/actions";
import { mondayOnOrBefore, pacificToday, addDays, type WeeklyEmail } from "@/lib/weekly-email";

interface ListingRow {
  id: string;
  property_address: string;
  status: string;
}

function WeeklyUpdatePreview() {
  const params = useSearchParams();
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [listingId, setListingId] = useState(params.get("listing") ?? "");
  // Default: the email for this week's Monday (covers last Mon-Sun).
  const [sendDate, setSendDate] = useState(mondayOnOrBefore(pacificToday()));
  const [email, setEmail] = useState<WeeklyEmail | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getListings("property_address", true).then(({ data }) => {
      const active = (data as ListingRow[]).filter((l) => l.status === "active");
      setListings(active);
      if (!listingId && active[0]) setListingId(active[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!listingId) return;
    setError("");
    getWeeklyEmailPreview(listingId, sendDate).then(({ email, error }) => {
      setEmail(email);
      if (error) setError(error);
    });
  }, [listingId, sendDate]);

  async function copyHtml() {
    if (!email) return;
    // Copy as rich text so it pastes into Gmail formatted.
    const item = new ClipboardItem({
      "text/html": new Blob([email.html], { type: "text/html" }),
      "text/plain": new Blob([email.text], { type: "text/plain" }),
    });
    await navigator.clipboard.write([item]);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Weekly seller update</h1>
      <p className="text-sm text-gray-500 mb-6">
        Preview of the Monday email for each Active listing. Each email covers the previous Monday through Sunday.
      </p>

      <div className="flex flex-wrap items-end gap-4 mb-6">
        <label className="text-sm text-gray-700">
          <span className="block mb-1 font-medium">Listing</span>
          <select
            value={listingId}
            onChange={(e) => setListingId(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {listings.map((l) => (
              <option key={l.id} value={l.id}>{l.property_address}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-gray-700">
          <span className="block mb-1 font-medium">Monday</span>
          <span className="flex items-center gap-2">
            <button onClick={() => setSendDate(addDays(sendDate, -7))} className="rounded border border-gray-300 px-2 py-1.5 text-sm">&larr;</button>
            <input
              type="date"
              value={sendDate}
              onChange={(e) => e.target.value && setSendDate(mondayOnOrBefore(e.target.value))}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            />
            <button onClick={() => setSendDate(addDays(sendDate, 7))} className="rounded border border-gray-300 px-2 py-1.5 text-sm">&rarr;</button>
          </span>
        </label>
        <button
          onClick={copyHtml}
          disabled={!email}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {copied ? "Copied" : "Copy email"}
        </button>
      </div>

      {listings.length === 0 && <p className="text-sm text-gray-500">No Active listings.</p>}
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {email && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-5 py-3 text-sm space-y-0.5">
            <p><span className="text-gray-400 w-16 inline-block">Subject</span> <span className="text-gray-900">{email.subject}</span></p>
            <p><span className="text-gray-400 w-16 inline-block">To</span> {email.to.join(", ") || <span className="text-red-600">no seller emails</span>}</p>
            <p><span className="text-gray-400 w-16 inline-block">CC</span> {email.cc.join(", ") || <span className="text-gray-400">none (test mode)</span>}</p>
          </div>
          {email.warnings.length > 0 && (
            <ul className="border-b border-amber-100 bg-amber-50 px-5 py-2 text-xs text-amber-800 list-disc list-inside">
              {email.warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          )}
          <div className="px-5 py-4" dangerouslySetInnerHTML={{ __html: email.html }} />
          <p className="border-t border-gray-100 px-5 py-2 text-xs text-gray-400">Gmail adds your saved signature below this when the draft is created.</p>
        </div>
      )}
    </div>
  );
}

export default function WeeklyUpdatePage() {
  return (
    <Suspense>
      <WeeklyUpdatePreview />
    </Suspense>
  );
}
