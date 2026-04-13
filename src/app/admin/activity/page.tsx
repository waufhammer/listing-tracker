"use client";

import { useState, useEffect, FormEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface Listing {
  id: string;
  address: string;
}

interface ActivityEntry {
  id: string;
  listing_id: string;
  activity_date: string;
  activity_type: string;
  agent_name: string | null;
  is_repeat_visit: boolean;
  follow_up_sent: boolean;
  buyer_packet_requested: boolean;
  raw_feedback: string | null;
  display_feedback: string | null;
  feedback_visible: boolean;
  open_house_groups: number | null;
  created_at: string;
}

type ActivityType = "Buyer Showing" | "Agent Preview" | "Open House";

export default function ActivityEntryPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedListingId, setSelectedListingId] = useState("");
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [repeatBanner, setRepeatBanner] = useState(false);

  // Form state
  const [activityType, setActivityType] = useState<ActivityType>("Buyer Showing");
  const [activityDate, setActivityDate] = useState("");
  const [agentName, setAgentName] = useState("");
  const [isRepeatVisit, setIsRepeatVisit] = useState(false);
  const [followUpSent, setFollowUpSent] = useState(false);
  const [buyerPacketRequested, setBuyerPacketRequested] = useState(false);
  const [rawFeedback, setRawFeedback] = useState("");
  const [displayFeedback, setDisplayFeedback] = useState("");
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [openHouseGroups, setOpenHouseGroups] = useState<number | "">("");
  const [displayFeedbackTouched, setDisplayFeedbackTouched] = useState(false);

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
      .select("id, address")
      .order("address");
    if (data) setListings(data);
  }

  async function fetchEntries() {
    setLoading(true);
    const { data } = await supabase
      .from("activity_entries")
      .select("*")
      .eq("listing_id", selectedListingId)
      .order("activity_date", { ascending: false });
    if (data) setEntries(data);
    setLoading(false);
  }

  async function checkRepeatVisit(name: string) {
    if (!name.trim() || !selectedListingId) {
      setRepeatBanner(false);
      return;
    }
    const { data } = await supabase
      .from("activity_entries")
      .select("id")
      .eq("listing_id", selectedListingId)
      .ilike("agent_name", name.trim())
      .limit(1);
    if (data && data.length > 0) {
      setRepeatBanner(true);
      setIsRepeatVisit(true);
    } else {
      setRepeatBanner(false);
    }
  }

  function resetForm() {
    setActivityType("Buyer Showing");
    setActivityDate("");
    setAgentName("");
    setIsRepeatVisit(false);
    setFollowUpSent(false);
    setBuyerPacketRequested(false);
    setRawFeedback("");
    setDisplayFeedback("");
    setFeedbackVisible(false);
    setOpenHouseGroups("");
    setRepeatBanner(false);
    setDisplayFeedbackTouched(false);
  }

  function handleRawFeedbackChange(value: string) {
    setRawFeedback(value);
    if (!displayFeedbackTouched) {
      setDisplayFeedback(value);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);

    const entry: Record<string, unknown> = {
      listing_id: selectedListingId,
      activity_date: activityDate,
      activity_type: activityType,
      raw_feedback: rawFeedback || null,
      display_feedback: displayFeedback || null,
      feedback_visible: feedbackVisible,
    };

    if (activityType === "Open House") {
      entry.open_house_groups = openHouseGroups === "" ? null : openHouseGroups;
    } else {
      entry.agent_name = agentName || null;
      entry.is_repeat_visit = isRepeatVisit;
      entry.follow_up_sent = followUpSent;
      entry.buyer_packet_requested = buyerPacketRequested;
    }

    const { error } = await supabase.from("activity_entries").insert(entry);

    if (!error) {
      resetForm();
      setShowForm(false);
      fetchEntries();
    }
    setSaving(false);
  }

  const isAgentType = activityType === "Buyer Showing" || activityType === "Agent Preview";

  return (
    <div className="max-w-4xl">
      <h2 className="text-2xl font-semibold text-gray-900 mb-6">Activity Entry</h2>

      {/* Listing selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Select Listing
        </label>
        <select
          value={selectedListingId}
          onChange={(e) => {
            setSelectedListingId(e.target.value);
            setShowForm(false);
            resetForm();
          }}
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
        >
          <option value="">-- Choose a listing --</option>
          {listings.map((l) => (
            <option key={l.id} value={l.id}>
              {l.address}
            </option>
          ))}
        </select>
      </div>

      {selectedListingId && (
        <>
          {/* Add Entry button */}
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="mb-6 px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 transition-colors"
            >
              Add Entry
            </button>
          )}

          {/* Inline form */}
          {showForm && (
            <div className="mb-8 bg-white border border-gray-200 rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                New Activity Entry
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Activity type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Activity Type
                  </label>
                  <select
                    value={activityType}
                    onChange={(e) => setActivityType(e.target.value as ActivityType)}
                    className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  >
                    <option>Buyer Showing</option>
                    <option>Agent Preview</option>
                    <option>Open House</option>
                  </select>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={activityDate}
                    onChange={(e) => setActivityDate(e.target.value)}
                    required
                    className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  />
                </div>

                {isAgentType && (
                  <>
                    {/* Agent name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Agent Name
                      </label>
                      <input
                        type="text"
                        value={agentName}
                        onChange={(e) => setAgentName(e.target.value)}
                        onBlur={() => checkRepeatVisit(agentName)}
                        className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                      />
                    </div>

                    {/* Repeat visit banner */}
                    {repeatBanner && (
                      <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 px-4 py-2 rounded-md text-sm">
                        This agent has visited before
                      </div>
                    )}

                    {/* Checkboxes */}
                    <div className="flex flex-wrap gap-6">
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={isRepeatVisit}
                          onChange={(e) => setIsRepeatVisit(e.target.checked)}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-600"
                        />
                        Repeat Visit
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={followUpSent}
                          onChange={(e) => setFollowUpSent(e.target.checked)}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-600"
                        />
                        Follow-up Sent
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={buyerPacketRequested}
                          onChange={(e) => setBuyerPacketRequested(e.target.checked)}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-600"
                        />
                        Buyer Packet Requested
                      </label>
                    </div>
                  </>
                )}

                {activityType === "Open House" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Number of Groups
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={openHouseGroups}
                      onChange={(e) =>
                        setOpenHouseGroups(
                          e.target.value === "" ? "" : parseInt(e.target.value)
                        )
                      }
                      className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                    />
                  </div>
                )}

                {/* Raw feedback */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Raw Feedback
                  </label>
                  <textarea
                    value={rawFeedback}
                    onChange={(e) => handleRawFeedbackChange(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  />
                </div>

                {/* Display feedback */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display Feedback
                  </label>
                  <textarea
                    value={displayFeedback}
                    onChange={(e) => {
                      setDisplayFeedback(e.target.value);
                      setDisplayFeedbackTouched(true);
                    }}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Auto-populates from raw feedback. Edit independently if needed.
                  </p>
                </div>

                {/* Feedback visible toggle */}
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={feedbackVisible}
                    onChange={(e) => setFeedbackVisible(e.target.checked)}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-600"
                  />
                  Feedback Visible to Client
                </label>

                {/* Form actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {saving ? "Saving..." : "Save Entry"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md font-medium hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Entries table */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Activity Entries
              </h3>
            </div>
            {loading ? (
              <div className="px-6 py-8 text-center text-gray-500">
                Loading...
              </div>
            ) : entries.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                No activity entries yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-gray-600">
                    <tr>
                      <th className="px-6 py-3 font-medium">Date</th>
                      <th className="px-6 py-3 font-medium">Type</th>
                      <th className="px-6 py-3 font-medium">Agent</th>
                      <th className="px-6 py-3 font-medium">Repeat</th>
                      <th className="px-6 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {entries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3 text-gray-900">
                          {entry.activity_date}
                        </td>
                        <td className="px-6 py-3 text-gray-900">
                          {entry.activity_type}
                        </td>
                        <td className="px-6 py-3 text-gray-900">
                          {entry.agent_name || (entry.activity_type === "Open House" ? `${entry.open_house_groups ?? 0} groups` : "-")}
                        </td>
                        <td className="px-6 py-3">
                          {entry.is_repeat_visit && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              Repeat
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          <Link
                            href={`/admin/activity/${entry.id}/edit`}
                            className="text-green-600 hover:text-green-800 font-medium"
                          >
                            Edit
                          </Link>
                        </td>
                      </tr>
                    ))}
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
