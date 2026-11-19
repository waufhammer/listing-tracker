"use client";

import { useEffect, useState } from "react";
import { getUnsentClientLinkRequests } from "@/lib/actions";

// Admin home: sellers who asked for their link with "Email me my link" but
// weren't emailed (no RESEND_API_KEY, a send failure, or the hourly limit).
// Will sends these by hand. Rows drop off after 14 days.

type Req = {
  id: string;
  email: string;
  created_at: string;
  listings: { property_address: string; client_link_token: string } | null;
};

export default function ClientLinkRequests() {
  const [rows, setRows] = useState<Req[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    getUnsentClientLinkRequests().then(({ data }) => setRows(data as unknown as Req[]));
  }, []);

  if (rows.length === 0) return null;
  return (
    <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <h2 className="text-sm font-semibold text-amber-900 mb-2">Sellers asking for their link</h2>
      <ul className="space-y-1 text-sm">
        {rows.map((r) => {
          const url = r.listings ? `https://listings.aufhammerhomes.com/s/${r.listings.client_link_token}` : null;
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3">
              <span className="text-gray-900">{r.email}</span>
              <span className="text-gray-500">{r.listings?.property_address}</span>
              <span className="text-xs text-gray-400">
                {new Date(r.created_at).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
              {url && (
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(url);
                    setCopied(r.id);
                    setTimeout(() => setCopied(null), 1500);
                  }}
                  className="text-xs font-medium text-green-700 hover:text-green-900"
                >
                  {copied === r.id ? "Copied" : "Copy link"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
