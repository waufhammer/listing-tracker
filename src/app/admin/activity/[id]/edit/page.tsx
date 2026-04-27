"use client";

import { useState, useEffect, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ActivityType = "Buyer Showing" | "Agent Preview" | "Open House";

const dbToDisplay: Record<string, ActivityType> = {
  buyer_showing: "Buyer Showing",
  agent_preview: "Agent Preview",
  open_house: "Open House",
};

const displayToDb: Record<ActivityType, string> = {
  "Buyer Showing": "buyer_showing",
  "Agent Preview": "agent_preview",
  "Open House": "open_house",
};

export default function EditActivityEntryPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [listingId, setListingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [activityType, setActivityType] = useState<ActivityType>("Buyer Showing");
  const [activityDate, setActivityDate] = useState("");
  const [agentName, setAgentName] = useState("");
  const [isRepeatVisit, setIsRepeatVisit] = useState(false);
  const [followUpSent, setFollowUpSent] = useState(false);
  const [buyerPacketRequested, setBuyerPacketRequested] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [openHouseGroups, setOpenHouseGroups] = useState<number | "">("");
  const [loggedBy, setLoggedBy] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEntry() {
      const { data } = await supabase
        .from("activity_entries")
        .select("*")
        .eq("id", id)
        .single();

      if (data) {
        setListingId(data.listing_id || "");
        const rawType = data.type || data.activity_type || "";
        setActivityType(dbToDisplay[rawType] || rawType as ActivityType);
        setActivityDate(data.date || data.activity_date || "");
        setAgentName(data.agent_name || "");
        setIsRepeatVisit(data.is_repeat_visit || false);
        setFollowUpSent(data.follow_up_sent || false);
        setBuyerPacketRequested(data.buyer_packet_requested || false);
        setFeedback(data.display_feedback || data.raw_feedback || "");
        setFeedbackVisible(data.feedback_visible || false);
        setOpenHouseGroups(data.open_house_groups ?? "");
        setLoggedBy(data.logged_by ?? null);
      }
      setLoading(false);
    }
    fetchEntry();
  }, [id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);

    const updates: Record<string, unknown> = {
      type: displayToDb[activityType] || activityType,
      date: activityDate,
      display_feedback: feedback || null,
      feedback_visible: feedbackVisible,
    };

    if (activityType === "Open House") {
      updates.open_house_groups = openHouseGroups === "" ? null : openHouseGroups;
      updates.agent_name = null;
      updates.is_repeat_visit = false;
      updates.follow_up_sent = false;
      updates.buyer_packet_requested = false;
    } else {
      updates.agent_name = agentName || null;
      updates.is_repeat_visit = isRepeatVisit;
      updates.follow_up_sent = followUpSent;
      updates.buyer_packet_requested = buyerPacketRequested;
      updates.open_house_groups = null;
    }

    const { error } = await supabase
      .from("activity_entries")
      .update(updates)
      .eq("id", id);

    if (!error) {
      router.push(`/admin/activity?listing=${listingId}`);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this entry?")) return;
    setDeleting(true);

    const { error } = await supabase
      .from("activity_entries")
      .delete()
      .eq("id", id);

    if (!error) {
      router.push(`/admin/activity?listing=${listingId}`);
    }
    setDeleting(false);
  }

  if (loading) {
    return (
      <div className="max-w-2xl py-12 text-center text-gray-500">Loading...</div>
    );
  }

  const isAgentType = activityType === "Buyer Showing" || activityType === "Agent Preview";

  return (
    <div className="max-w-2xl">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors mb-4"
      >
        &larr; Back
      </button>
      <h2 className="text-2xl font-semibold text-gray-900 mb-6">
        Edit Activity Entry
      </h2>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        {loggedBy && (
          <p className="text-sm text-gray-500 mb-4">
            Logged by {loggedBy === "will" ? "Will" : "Assistant"}
          </p>
        )}
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
                  className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                />
              </div>

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
                  Disclosure Package Requested
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

          {/* Feedback */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Feedback
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
            />
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

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/activity")}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md font-medium hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="ml-auto px-4 py-2 bg-red-50 text-red-600 rounded-md font-medium hover:bg-red-100 disabled:opacity-50 transition-colors"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
