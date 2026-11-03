"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSeller, deleteSeller, getPageViewLog, getSellers, updateSeller } from "@/lib/actions";

interface Seller {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  sort_order: number;
}

interface ViewRow {
  id: string;
  viewed_at: string;
  user_agent: string | null;
}

const input =
  "rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500";

function formatViewTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function deviceLabel(ua: string | null): string {
  if (!ua) return "";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "Other";
}

/**
 * Sellers (who gets the weekly email), the client link, and the client link
 * view log. Views are logged only when someone opens the client link while
 * not logged into admin, so Will's own visits never show up here.
 */
export default function ListingSellersPanel({
  listingId,
  slug,
  status,
}: {
  listingId: string;
  slug: string;
  status: string;
}) {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [views, setViews] = useState<ViewRow[]>([]);
  const [draft, setDraft] = useState({ first_name: "", last_name: "", email: "" });
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ first_name: "", last_name: "", email: "" });
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showLog, setShowLog] = useState(false);

  const clientUrl = `https://listings.aufhammerhomes.com/${slug}`;

  async function load() {
    const [s, v] = await Promise.all([getSellers(listingId), getPageViewLog(listingId, 100)]);
    if (s.error) setError(s.error);
    setSellers(s.data as Seller[]);
    setViews(v.data as ViewRow[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  async function handleAdd() {
    if (!draft.first_name.trim()) return setError("First name is required.");
    setError("");
    const { error } = await createSeller({
      listing_id: listingId,
      first_name: draft.first_name.trim(),
      last_name: draft.last_name.trim() || null,
      email: draft.email.trim() || null,
      sort_order: sellers.length,
    });
    if (error) return setError(error);
    setDraft({ first_name: "", last_name: "", email: "" });
    load();
  }

  async function handleSave(id: string) {
    if (!editDraft.first_name.trim()) return setError("First name is required.");
    setError("");
    const { error } = await updateSeller(id, {
      first_name: editDraft.first_name.trim(),
      last_name: editDraft.last_name.trim() || null,
      email: editDraft.email.trim() || null,
    });
    if (error) return setError(error);
    setEditing(null);
    load();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Remove this seller?")) return;
    const { error } = await deleteSeller(id);
    if (error) return setError(error);
    load();
  }

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const last7 = views.filter((v) => new Date(v.viewed_at).getTime() >= weekAgo).length;

  return (
    <div className="grid gap-4 md:grid-cols-2 mb-6">
      {/* Sellers */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Sellers</h3>
          {status === "active" && (
            <Link
              href={`/admin/weekly-update?listing=${listingId}`}
              className="text-xs font-medium text-green-700 hover:text-green-900"
            >
              Weekly email preview &rarr;
            </Link>
          )}
        </div>
        {sellers.length === 0 && (
          <p className="text-xs text-gray-400 mb-3">No sellers yet. The weekly email goes to every seller listed here.</p>
        )}
        <ul className="space-y-2 mb-3">
          {sellers.map((s) =>
            editing === s.id ? (
              <li key={s.id} className="flex flex-wrap gap-2">
                <input className={`${input} w-24`} value={editDraft.first_name} placeholder="First"
                  onChange={(e) => setEditDraft({ ...editDraft, first_name: e.target.value })} />
                <input className={`${input} w-24`} value={editDraft.last_name} placeholder="Last"
                  onChange={(e) => setEditDraft({ ...editDraft, last_name: e.target.value })} />
                <input className={`${input} flex-1 min-w-40`} value={editDraft.email} placeholder="Email" type="email"
                  onChange={(e) => setEditDraft({ ...editDraft, email: e.target.value })} />
                <button onClick={() => handleSave(s.id)} className="text-xs font-semibold text-green-700">Save</button>
                <button onClick={() => setEditing(null)} className="text-xs text-gray-400">Cancel</button>
              </li>
            ) : (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <span>
                  <span className="text-gray-900">{s.first_name} {s.last_name}</span>{" "}
                  <span className={s.email ? "text-gray-500" : "text-red-600"}>{s.email || "no email"}</span>
                </span>
                <span className="flex gap-3">
                  <button
                    onClick={() => {
                      setEditing(s.id);
                      setEditDraft({ first_name: s.first_name, last_name: s.last_name ?? "", email: s.email ?? "" });
                    }}
                    className="text-xs text-gray-500 hover:text-gray-900"
                  >
                    Edit
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="text-xs text-gray-400 hover:text-red-600">Remove</button>
                </span>
              </li>
            )
          )}
        </ul>
        <div className="flex flex-wrap gap-2">
          <input className={`${input} w-24`} value={draft.first_name} placeholder="First"
            onChange={(e) => setDraft({ ...draft, first_name: e.target.value })} />
          <input className={`${input} w-24`} value={draft.last_name} placeholder="Last"
            onChange={(e) => setDraft({ ...draft, last_name: e.target.value })} />
          <input className={`${input} flex-1 min-w-40`} value={draft.email} placeholder="Email" type="email"
            onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
          <button onClick={handleAdd} className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700">
            Add
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>

      {/* Client link + view log */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Client link</h3>
        <div className="flex items-center gap-2 mb-1">
          <code className="text-xs text-gray-700 bg-gray-50 rounded px-2 py-1 truncate">{clientUrl.replace("https://", "")}</code>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(clientUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="text-xs font-medium text-green-700 hover:text-green-900"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Your own visits while logged into admin are not counted. Forwarded links count as the client.
        </p>
        <p className="text-sm text-gray-600">
          Last viewed:{" "}
          <span className="font-semibold text-gray-900">{views[0] ? formatViewTime(views[0].viewed_at) : "never"}</span>
        </p>
        <p className="text-sm text-gray-600 mb-2">
          Last 7 days: <span className="font-semibold text-gray-900">{last7}</span>{" "}
          <span className="text-gray-400">({views.length}{views.length === 100 ? "+" : ""} total)</span>
        </p>
        {views.length > 0 && (
          <button onClick={() => setShowLog(!showLog)} className="text-xs font-medium text-gray-500 hover:text-gray-900">
            {showLog ? "Hide view log" : "Show view log"}
          </button>
        )}
        {showLog && (
          <ul className="mt-2 max-h-56 overflow-y-auto divide-y divide-gray-100 text-xs">
            {views.map((v) => (
              <li key={v.id} className="flex justify-between py-1">
                <span className="text-gray-700">{formatViewTime(v.viewed_at)}</span>
                <span className="text-gray-400">{deviceLabel(v.user_agent)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
