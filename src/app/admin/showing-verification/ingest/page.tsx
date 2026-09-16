"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { manualIngestEmail, type ManualIngestResult } from "@/lib/showing-actions";

type SourceType = "showingtime" | "supra";

export default function IngestPage() {
  const [sourceType, setSourceType] = useState<SourceType>("showingtime");
  const [rawText, setRawText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ManualIngestResult | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setResult(null);

    const { data, error: ingestError } = await manualIngestEmail(rawText, sourceType);
    if (ingestError) {
      setError(ingestError);
    } else {
      setResult(data);
    }
    setSubmitting(false);
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">Paste Email</h2>
        <Link href="/admin/showing-verification" className="text-sm text-green-600 hover:text-green-800 font-medium">
          Back to dashboard
        </Link>
      </div>

      <p className="text-sm text-gray-600 mb-6">
        Paste a raw ShowingTime or Supra email (the HTML source for ShowingTime, or the plain
        text for Supra) to run it through the parser and matching pipeline manually — this is
        how the feature is tested and debugged until live Gmail ingestion is wired up.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as SourceType)}
            className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
          >
            <option value="showingtime">ShowingTime (showing confirmed)</option>
            <option value="supra">Supra (keybox access)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Raw email content</label>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={12}
            required
            placeholder={sourceType === "showingtime" ? "Paste the ShowingTime email's HTML source..." : "Paste the Supra email's plain text..."}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !rawText.trim()}
          className="px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Parsing..." : "Parse & Ingest"}
        </button>
      </form>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          <strong>Parse failed:</strong> {error}
        </div>
      )}

      {result && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Result</h3>

          <div>
            <div className="text-xs uppercase text-gray-500 font-medium mb-1">Parsed fields</div>
            <pre className="p-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-700 whitespace-pre-wrap break-words">
              {JSON.stringify(result.parsed, null, 2)}
            </pre>
          </div>

          {result.event && (
            <div>
              <div className="text-xs uppercase text-gray-500 font-medium mb-1">Resulting event</div>
              <div className="text-sm text-gray-700 space-y-0.5">
                <div>Status: <span className="font-medium">{result.event.status}</span></div>
                <div>Listing matched: <span className="font-medium">{result.event.listing_id ? "yes" : "no (needs_review)"}</span></div>
                {result.matched && <div>Paired with existing event: <span className="font-medium">{result.matched.id}</span></div>}
              </div>
            </div>
          )}

          {result.flaggedAgent && (
            <div>
              <div className="text-xs uppercase text-gray-500 font-medium mb-1">Flagged agent match</div>
              <div className="text-sm text-gray-700">
                {result.flaggedAgent.name} ({result.flaggedAgent.reason ?? "no reason recorded"}) —{" "}
                {result.alertSent ? "alert email sent" : result.alertError ? `alert failed: ${result.alertError}` : "alert not sent"}
              </div>
            </div>
          )}

          {!result.event && !result.flaggedAgent && (
            <div className="text-sm text-gray-500">Recognized but produced no showing_events row (see parsed fields above).</div>
          )}
        </div>
      )}
    </div>
  );
}
