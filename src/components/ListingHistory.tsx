"use client";

import { useState } from "react";
import { getChangeLogForListing } from "@/lib/actions";
import type { ChangeLogEntry } from "@/lib/change-log";

// History tab for a listing: every change to the listing, its activity,
// online views and sellers (change_log, 0008). Loaded on first open.

const TABLE_LABEL: Record<string, string> = {
  listings: "Listing",
  activity_entries: "Activity",
  platform_views: "Online views",
  listing_sellers: "Seller",
};

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "empty";
  if (typeof v === "string") return v.length > 80 ? `${v.slice(0, 80)}…` : v;
  return JSON.stringify(v);
}

function describeRow(row: Record<string, unknown> | null | undefined): string {
  if (!row) return "";
  return [row.date, row.type, row.agent_name, row.first_name, row.last_name, row.property_address]
    .filter((x) => x !== null && x !== undefined && x !== "")
    .join(" · ");
}

export default function ListingHistory({ listingId }: { listingId: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ChangeLogEntry[] | null>(null);
  const [error, setError] = useState("");

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && rows === null) {
      const { data, error } = await getChangeLogForListing(listingId);
      if (error) setError(error);
      setRows(data);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 mb-6">
      <button onClick={toggle} className="flex w-full items-center justify-between text-sm font-semibold text-gray-900">
        History
        <span className="text-xs font-medium text-gray-500">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="mt-3">
          {error && <p className="text-xs text-red-600">{error}</p>}
          {rows === null && !error && <p className="text-xs text-gray-400">Loading…</p>}
          {rows?.length === 0 && <p className="text-xs text-gray-400">No changes recorded yet.</p>}
          <ul className="max-h-96 overflow-y-auto divide-y divide-gray-100 text-xs">
            {rows?.map((r, i) => (
              <li key={`${r.at}-${i}`} className="py-2">
                <p className="text-gray-500">
                  {new Date(String(r.at)).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "numeric", day: "numeric", year: "2-digit", hour: "numeric", minute: "2-digit" })}
                  {" · "}
                  <span className="font-semibold text-gray-700">{String(r.actor)}</span>
                  {" · "}
                  {String(r.action)} {TABLE_LABEL[String(r.table)] ?? String(r.table)}
                  {"row" in r && r.row ? ` · ${describeRow(r.row as Record<string, unknown>)}` : ""}
                </p>
                {"changed" in r && (
                  <ul className="mt-1 space-y-0.5">
                    {Object.entries(r.changed).map(([k, v]) => (
                      <li key={k} className="text-gray-700">
                        <span className="text-gray-400">{k}:</span> {fmt(v.from)} &rarr; {fmt(v.to)}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
