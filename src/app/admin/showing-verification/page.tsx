"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getShowingEvents,
  getUpcomingShowings,
  resolveShowingEvent,
} from "@/lib/showing-actions";
import type { ShowingEventRow, ShowingEventStatus } from "@/lib/showing-matching";

const STATUS_LABEL: Record<ShowingEventStatus, string> = {
  scheduled: "Scheduled",
  confirmed_occurred: "Confirmed",
  unconfirmed_occurred: "Unconfirmed access",
  no_show: "No-show",
  needs_review: "Needs review",
  excluded_self_or_open_house: "Excluded (self/open house)",
};

const STATUS_COLOR: Record<ShowingEventStatus, string> = {
  scheduled: "bg-blue-100 text-blue-800",
  confirmed_occurred: "bg-green-100 text-green-800",
  unconfirmed_occurred: "bg-orange-100 text-orange-800",
  no_show: "bg-red-100 text-red-800",
  needs_review: "bg-yellow-100 text-yellow-800",
  excluded_self_or_open_house: "bg-gray-100 text-gray-700",
};

const RESOLVABLE_STATUSES: ShowingEventStatus[] = [
  "confirmed_occurred",
  "unconfirmed_occurred",
  "no_show",
  "needs_review",
  "excluded_self_or_open_house",
];

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function ShowingVerificationPage() {
  const [events, setEvents] = useState<ShowingEventRow[]>([]);
  const [upcoming, setUpcoming] = useState<ShowingEventRow[]>([]);
  const [includeResolved, setIncludeResolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeResolved]);

  async function fetchAll() {
    setLoading(true);
    const [{ data: eventData, error: eventError }, { data: upcomingData }] = await Promise.all([
      getShowingEvents({ includeResolved }),
      getUpcomingShowings(),
    ]);
    setEvents(eventData);
    setUpcoming(upcomingData);
    setError(eventError ?? "");
    setLoading(false);
  }

  async function handleResolve(id: string, status: ShowingEventStatus) {
    const { error: resolveError } = await resolveShowingEvent(id, status);
    if (resolveError) {
      setError(resolveError);
      return;
    }
    fetchAll();
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">Showing Verification</h2>
        <div className="flex gap-3">
          <Link
            href="/admin/showing-verification/flagged-agents"
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            Flagged Agents
          </Link>
          <Link
            href="/admin/showing-verification/ingest"
            className="px-3 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
          >
            Paste Email
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
      )}

      {upcoming.length > 0 && (
        <div className="mb-8 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Upcoming showings</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {upcoming.map((e) => (
              <div key={e.id} className="px-4 sm:px-6 py-3 text-sm flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 truncate">{e.raw_address}</div>
                  <div className="text-gray-600">{e.agent_name ?? "Unknown agent"} · {formatTime(e.scheduled_time)}</div>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium shrink-0 ml-2 ${STATUS_COLOR.scheduled}`}>
                  {STATUS_LABEL.scheduled}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">
            {includeResolved ? "Full log" : "Needs attention"}
          </h3>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={includeResolved}
              onChange={(e) => setIncludeResolved(e.target.checked)}
              className="rounded border-gray-300 text-green-600 focus:ring-green-600"
            />
            Show full log
          </label>
        </div>

        {loading ? (
          <div className="px-4 sm:px-6 py-8 text-center text-gray-500">Loading...</div>
        ) : events.length === 0 ? (
          <div className="px-4 sm:px-6 py-8 text-center text-gray-500">
            {includeResolved ? "No showing events yet." : "Nothing needs attention."}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {events.map((e) => (
              <div key={e.id} className="px-4 sm:px-6 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate">{e.raw_address}</div>
                    <div className="text-gray-600">
                      {e.agent_name ?? "Unknown agent"} ·{" "}
                      {e.event_type === "showing_confirmed" ? formatTime(e.scheduled_time) : formatTime(e.access_time)}
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium shrink-0 ${STATUS_COLOR[e.status]}`}>
                    {STATUS_LABEL[e.status]}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    {expandedId === e.id ? "Hide source" : "Show source"}
                  </button>
                  <select
                    value=""
                    onChange={(ev) => {
                      const status = ev.target.value as ShowingEventStatus;
                      if (status) handleResolve(e.id, status);
                    }}
                    className="text-xs border border-gray-300 rounded px-2 py-1 text-gray-700"
                  >
                    <option value="">Resolve as...</option>
                    {RESOLVABLE_STATUSES.filter((s) => s !== e.status).map((s) => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                </div>
                {expandedId === e.id && (
                  <pre className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600 whitespace-pre-wrap break-words">
                    {e.raw_email_snippet ?? "(no snippet stored)"}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
