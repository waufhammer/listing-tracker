"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Listing {
  id: string;
  property_address: string;
}

type ActivityType = "Buyer Showing" | "Agent Preview" | "Open House";

const activityTypeToDb: Record<ActivityType, string> = {
  "Buyer Showing": "buyer_showing",
  "Agent Preview": "agent_preview",
  "Open House": "open_house",
};

interface BulkRow {
  key: number;
  activityType: ActivityType;
  activityDate: string;
  agentName: string;
  openHouseGroups: number | "";
  feedback: string;
}

let nextKey = 1;

function createEmptyRow(): BulkRow {
  return {
    key: nextKey++,
    activityType: "Buyer Showing",
    activityDate: new Date().toISOString().split("T")[0],
    agentName: "",
    openHouseGroups: "",
    feedback: "",
  };
}

export default function BulkActivityPage() {
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedListingId, setSelectedListingId] = useState("");
  const [rows, setRows] = useState<BulkRow[]>([createEmptyRow()]);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchListings() {
      const { data } = await supabase
        .from("listings")
        .select("id, property_address, status")
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
    fetchListings();
  }, []);

  function updateRow(key: number, updates: Partial<BulkRow>) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...updates } : r))
    );
  }

  function removeRow(key: number) {
    setRows((prev) => {
      const next = prev.filter((r) => r.key !== key);
      return next.length === 0 ? [createEmptyRow()] : next;
    });
  }

  function addRow() {
    // Copy the date and type from the last row for convenience
    const last = rows[rows.length - 1];
    setRows((prev) => [
      ...prev,
      {
        ...createEmptyRow(),
        activityDate: last?.activityDate ?? new Date().toISOString().split("T")[0],
        activityType: last?.activityType ?? "Buyer Showing",
      },
    ]);
  }

  async function handleSubmit() {
    if (!selectedListingId) return;

    // Validate
    const valid = rows.every((r) => r.activityDate);
    if (!valid) {
      setError("Every row needs a date.");
      return;
    }

    setSaving(true);
    setError(null);
    setSavedCount(null);

    const entries = rows.map((r) => {
      const entry: Record<string, unknown> = {
        listing_id: selectedListingId,
        date: r.activityDate,
        type: activityTypeToDb[r.activityType],
      };

      if (r.activityType === "Open House") {
        entry.open_house_groups = r.openHouseGroups === "" ? null : r.openHouseGroups;
      } else {
        entry.agent_name = r.agentName || null;
      }

      if (r.feedback.trim()) {
        entry.raw_feedback = r.feedback.trim();
        entry.display_feedback = r.feedback.trim();
      }

      return entry;
    });

    const { error: insertError } = await supabase
      .from("activity_entries")
      .insert(entries);

    if (insertError) {
      setError(insertError.message);
    } else {
      setSavedCount(entries.length);
      setRows([createEmptyRow()]);
    }

    setSaving(false);
  }

  const isAgentType = (type: ActivityType) =>
    type === "Buyer Showing" || type === "Agent Preview";

  return (
    <div className="max-w-5xl">
      <h2 className="text-2xl font-semibold text-gray-900 mb-6">Bulk Activity Entry</h2>

      {/* Listing selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Select Listing
        </label>
        <select
          value={selectedListingId}
          onChange={(e) => {
            setSelectedListingId(e.target.value);
            setSavedCount(null);
            setError(null);
          }}
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
          {/* Success banner */}
          {savedCount !== null && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
              <span>Saved {savedCount} {savedCount === 1 ? "entry" : "entries"} successfully.</span>
              <button
                onClick={() => router.push("/admin")}
                className="px-4 py-1.5 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
              >
                Done
              </button>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Bulk entry table */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="px-4 py-3 font-medium w-10">#</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Agent / Groups</th>
                    <th className="px-4 py-3 font-medium">Feedback</th>
                    <th className="px-4 py-3 font-medium w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row, i) => (
                    <tr key={row.key} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-3">
                        <select
                          value={row.activityType}
                          onChange={(e) =>
                            updateRow(row.key, {
                              activityType: e.target.value as ActivityType,
                            })
                          }
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent text-sm"
                        >
                          <option>Buyer Showing</option>
                          <option>Agent Preview</option>
                          <option>Open House</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="date"
                          value={row.activityDate}
                          onChange={(e) =>
                            updateRow(row.key, { activityDate: e.target.value })
                          }
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-3">
                        {isAgentType(row.activityType) ? (
                          <input
                            type="text"
                            placeholder="Agent name"
                            value={row.agentName}
                            onChange={(e) =>
                              updateRow(row.key, { agentName: e.target.value })
                            }
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent text-sm"
                          />
                        ) : (
                          <input
                            type="number"
                            min="0"
                            placeholder="# groups"
                            value={row.openHouseGroups}
                            onChange={(e) =>
                              updateRow(row.key, {
                                openHouseGroups:
                                  e.target.value === ""
                                    ? ""
                                    : parseInt(e.target.value),
                              })
                            }
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent text-sm"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          placeholder="Optional feedback"
                          value={row.feedback}
                          onChange={(e) =>
                            updateRow(row.key, { feedback: e.target.value })
                          }
                          className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent text-sm"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => removeRow(row.key)}
                          className="text-gray-400 hover:text-red-500 transition-colors text-lg leading-none"
                          title="Remove row"
                        >
                          &times;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={addRow}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md font-medium hover:bg-gray-200 transition-colors text-sm"
            >
              + Add Row
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || rows.length === 0}
              className="px-5 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 disabled:opacity-50 transition-colors text-sm"
            >
              {saving
                ? "Saving..."
                : `Save ${rows.length} ${rows.length === 1 ? "Entry" : "Entries"}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
