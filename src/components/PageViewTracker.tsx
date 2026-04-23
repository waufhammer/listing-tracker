"use client";

import { useEffect } from "react";

export default function PageViewTracker({ listingId }: { listingId: string }) {
  useEffect(() => {
    fetch("/api/page-views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listing_id: listingId }),
    });
  }, [listingId]);

  return null;
}
