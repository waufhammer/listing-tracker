"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { approveLegacyFeedback, getLegacyVisibleFeedback, hideFeedback } from "@/lib/actions";

// One-time review of feedback that was already visible to clients before
// approvals existed (marked 'legacy' by 0007_feedback_approval.sql). Re-read
// each one for buyer names, family status, age or other protected details.

type Row = {
  id: string;
  date: string;
  type: string;
  agent_name: string | null;
  display_feedback: string | null;
  raw_feedback: string | null;
  listing_id: string;
  listings: { property_address: string } | null;
};

const TYPE_LABEL: Record<string, string> = {
  buyer_showing: "Buyer showing",
  agent_preview: "Agent preview",
  open_house: "Open house",
};

export default function FeedbackReviewPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const { data, error } = await getLegacyVisibleFeedback();
    if (error) setError(error);
    setRows(data as unknown as Row[]);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function act(fn: (id: string) => Promise<{ error: string | null }>, id: string) {
    const { error } = await fn(id);
    if (error) return setError(error);
    setRows((r) => (r ?? []).filter((x) => x.id !== id));
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Review visible feedback</h1>
      <p className="text-sm text-gray-500 mb-6">
        These were visible to clients before feedback approvals existed. Check each for buyer names, family status, age
        or other protected details. <strong>Looks good</strong> keeps it visible; <strong>Hide</strong> takes it off the
        client page and weekly email (the text is kept, and you can edit and show it again).
      </p>
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {rows === null && <p className="text-sm text-gray-400">Loading…</p>}
      {rows?.length === 0 && <p className="text-sm text-gray-500">Nothing left to review.</p>}
      <ul className="space-y-3">
        {rows?.map((r) => (
          <li key={r.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500 mb-1">
              {r.listings?.property_address} · {r.date} · {TYPE_LABEL[r.type] ?? r.type}
              {r.agent_name ? ` · ${r.agent_name}` : ""}
            </p>
            <p className="text-sm text-gray-900 whitespace-pre-wrap mb-3">{r.display_feedback}</p>
            <div className="flex gap-4 text-sm">
              <button onClick={() => act(approveLegacyFeedback, r.id)} className="font-semibold text-green-700 hover:text-green-900">
                Looks good
              </button>
              <button onClick={() => act(hideFeedback, r.id)} className="font-semibold text-red-700 hover:text-red-900">
                Hide
              </button>
              <Link href={`/admin/activity/${r.id}/edit`} className="text-gray-500 hover:text-gray-900">
                Edit
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
