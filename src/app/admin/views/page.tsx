"use client";

import { useState, useEffect, FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { useAdminUser } from "@/lib/admin-user-context";

interface Listing {
  id: string;
  property_address: string;
  compass_visible?: boolean;
}

interface PlatformView {
  id: string;
  listing_id: string;
  date: string;
  zillow_views: number | null;
  redfin_views: number | null;
  compass_views: number | null;
  logged_by: string | null;
}

export default function PlatformViewsPage() {
  const adminUser = useAdminUser();
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedListingId, setSelectedListingId] = useState("");
  const [entries, setEntries] = useState<PlatformView[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // New entry form
  const [viewDate, setViewDate] = useState(new Date().toISOString().split("T")[0]);
  const [zillowViews, setZillowViews] = useState<number | "">("");
  const [redfinViews, setRedfinViews] = useState<number | "">("");
  const [compassViews, setCompassViews] = useState<number | "">("");

  // Inline edit state (keyed by entry id)
  const [editState, setEditState] = useState<
    Record<string, { date: string; zillow_views: number | ""; redfin_views: number | ""; compass_views: number | "" }>
  >({});
  const [savingRow, setSavingRow] = useState<string | null>(null);
  const [deletingRow, setDeletingRow] = useState<string | null>(null);

  useEffect(() => {
    fetchListings();
  }, []);

  useEffect(() => {
    if (selectedListingId) {
      fetchEntries();
    } else {
      setEntries([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedListingId]);

  async function fetchListings() {
    const { data } = await supabase
      .from("listings")
      .select("id, property_address, status, compass_visible")
      .order("property_address");
    if (data) {
      setListings(data);
      const active = data.filter((l) => l.status === "active");
      if (active.length === 1) {
        setSelectedListingId(active[0].id);
      } else if (data.length === 1) {
        setSelectedListingId(data[0].id);
      }
    }
  }

  async function fetchEntries() {
    setLoading(true);
    const { data } = await supabase
      .from("platform_views")
      .select("*")
      .eq("listing_id", selectedListingId)
      .order("date", { ascending: false });
    if (data) {
      setEntries(data);
      // Initialize edit state
      const state: typeof editState = {};
      data.forEach((entry: PlatformView) => {
        state[entry.id] = {
          date: entry.date,
          zillow_views: entry.zillow_views ?? "",
          redfin_views: entry.redfin_views ?? "",
          compass_views: entry.compass_views ?? "",
        };
      });
      setEditState(state);
    }
    setLoading(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { error: insertError } = await supabase.from("platform_views").insert({
      listing_id: selectedListingId,
      date: viewDate,
      zillow_views: zillowViews === "" ? null : zillowViews,
      redfin_views: redfinViews === "" ? null : redfinViews,
      compass_views: compassViews === "" ? null : compassViews,
      logged_by: adminUser?.id ?? null,
    });

    if (insertError) {
      alert(`Error: ${insertError.message}`);
    } else {
      setViewDate(new Date().toISOString().split("T")[0]);
      setZillowViews("");
      setRedfinViews("");
      setCompassViews("");
      fetchEntries();
    }
    setSaving(false);
  }

  function updateEditState(
    id: string,
    field: string,
    value: string | number
  ) {
    setEditState((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }

  async function handleSaveRow(id: string) {
    const row = editState[id];
    if (!row) return;
    setSavingRow(id);

    await supabase
      .from("platform_views")
      .update({
        date: row.date,
        zillow_views: row.zillow_views === "" ? null : row.zillow_views,
        redfin_views: row.redfin_views === "" ? null : row.redfin_views,
        compass_views: row.compass_views === "" ? null : row.compass_views,
      })
      .eq("id", id);

    setSavingRow(null);
    fetchEntries();
  }

  async function handleDeleteRow(id: string) {
    if (!confirm("Delete this entry?")) return;
    setDeletingRow(id);

    await supabase.from("platform_views").delete().eq("id", id);

    setDeletingRow(null);
    fetchEntries();
  }

  const selectedListing = listings.find((l) => l.id === selectedListingId);
  const showCompass = selectedListing?.compass_visible ?? false;

  return (
    <div className="max-w-4xl">
      <h2 className="text-2xl font-semibold text-gray-900 mb-6">
        Platform Views
      </h2>

      {/* Listing selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Select Listing
        </label>
        <select
          value={selectedListingId}
          onChange={(e) => setSelectedListingId(e.target.value)}
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
        >
          <option value="">-- Choose a listing --</option>
          {listings.map((l) => (
            <option key={l.id} value={l.id}>
              {l.property_address}
            </option>
          ))}
        </select>
      </div>

      {selectedListingId && (
        <>
          {/* Add new entry form */}
          <div className="mb-8 bg-white border border-gray-200 rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Add Views Entry
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={viewDate}
                    onChange={(e) => setViewDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Zillow Views
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={zillowViews}
                    onChange={(e) =>
                      setZillowViews(
                        e.target.value === "" ? "" : parseInt(e.target.value)
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                    placeholder="Cumulative"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Redfin Views
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={redfinViews}
                    onChange={(e) =>
                      setRedfinViews(
                        e.target.value === "" ? "" : parseInt(e.target.value)
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                    placeholder="Cumulative"
                  />
                </div>
                {showCompass && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Compass Views
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={compassViews}
                      onChange={(e) =>
                        setCompassViews(
                          e.target.value === "" ? "" : parseInt(e.target.value)
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                      placeholder="Cumulative"
                    />
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : "Add Entry"}
              </button>
            </form>
          </div>

          {/* Existing entries table */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                View History
              </h3>
            </div>
            {loading ? (
              <div className="px-4 sm:px-6 py-8 text-center text-gray-500">
                Loading...
              </div>
            ) : entries.length === 0 ? (
              <div className="px-4 sm:px-6 py-8 text-center text-gray-500">
                No platform views entries yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-gray-600">
                    <tr>
                      <th className="px-3 sm:px-6 py-3 font-medium">Date</th>
                      <th className="px-3 sm:px-6 py-3 font-medium">Zillow</th>
                      <th className="px-3 sm:px-6 py-3 font-medium">Redfin</th>
                      {showCompass && (
                        <th className="px-3 sm:px-6 py-3 font-medium">Compass</th>
                      )}
                      <th className="px-3 sm:px-6 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {entries.map((entry) => {
                      const row = editState[entry.id];
                      if (!row) return null;
                      return (
                        <tr key={entry.id} className="hover:bg-gray-50">
                          <td className="px-3 sm:px-6 py-3">
                            <input
                              type="date"
                              value={row.date}
                              onChange={(e) =>
                                updateEditState(entry.id, "date", e.target.value)
                              }
                              className="px-2 py-1 border border-gray-300 rounded text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                            />
                            {entry.logged_by && (
                              <span className="ml-2 text-xs text-gray-400">{entry.logged_by === "will" ? "Will" : "Admin"}</span>
                            )}
                          </td>
                          <td className="px-3 sm:px-6 py-3">
                            <input
                              type="number"
                              min="0"
                              value={row.zillow_views}
                              onChange={(e) =>
                                updateEditState(
                                  entry.id,
                                  "zillow_views",
                                  e.target.value === "" ? "" : parseInt(e.target.value)
                                )
                              }
                              className="w-full sm:w-24 px-2 py-1 border border-gray-300 rounded text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                            />
                          </td>
                          <td className="px-3 sm:px-6 py-3">
                            <input
                              type="number"
                              min="0"
                              value={row.redfin_views}
                              onChange={(e) =>
                                updateEditState(
                                  entry.id,
                                  "redfin_views",
                                  e.target.value === "" ? "" : parseInt(e.target.value)
                                )
                              }
                              className="w-full sm:w-24 px-2 py-1 border border-gray-300 rounded text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                            />
                          </td>
                          {showCompass && (
                            <td className="px-3 sm:px-6 py-3">
                              <input
                                type="number"
                                min="0"
                                value={row.compass_views}
                                onChange={(e) =>
                                  updateEditState(
                                    entry.id,
                                    "compass_views",
                                    e.target.value === "" ? "" : parseInt(e.target.value)
                                  )
                                }
                                className="w-full sm:w-24 px-2 py-1 border border-gray-300 rounded text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                              />
                            </td>
                          )}
                          <td className="px-3 sm:px-6 py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveRow(entry.id)}
                                disabled={savingRow === entry.id}
                                className="px-3 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                              >
                                {savingRow === entry.id ? "..." : "Save"}
                              </button>
                              <button
                                onClick={() => handleDeleteRow(entry.id)}
                                disabled={deletingRow === entry.id}
                                className="px-3 py-1 bg-red-50 text-red-600 rounded text-xs font-medium hover:bg-red-100 disabled:opacity-50 transition-colors"
                              >
                                {deletingRow === entry.id ? "..." : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
