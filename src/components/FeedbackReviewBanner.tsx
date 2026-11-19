"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getLegacyVisibleFeedback } from "@/lib/actions";

/** Admin home: link to the one-time review while any legacy feedback is left. */
export default function FeedbackReviewBanner() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    getLegacyVisibleFeedback().then(({ data }) => setCount(data.length));
  }, []);
  if (count === 0) return null;
  return (
    <Link
      href="/admin/feedback-review"
      className="mb-6 block rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 hover:bg-amber-100"
    >
      <strong>{count}</strong> visible feedback {count === 1 ? "entry" : "entries"} shown to clients before approvals
      existed: review once &rarr;
    </Link>
  );
}
