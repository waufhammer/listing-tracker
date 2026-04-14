"use client";

import { useState } from "react";

interface ActivityLogEntry {
  id: string;
  date: string;
  formattedDate: string;
  type: string;
  agent_name?: string | null;
  is_repeat_visit?: boolean;
  buyer_packet_requested?: boolean;
  display_feedback?: string | null;
  feedback_visible?: boolean;
  open_house_groups?: number | null;
}

interface ActivityTypeConfig {
  label: string;
  color: string;
  dotColor: string;
}

interface ActivityLogProps {
  entries: ActivityLogEntry[];
  activityTypeConfig: Record<string, ActivityTypeConfig>;
}

const INITIAL_COUNT = 10;

export default function ActivityLog({ entries, activityTypeConfig }: ActivityLogProps) {
  const [showAll, setShowAll] = useState(false);

  if (entries.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center">
        <p className="text-gray-300 text-sm">No activity recorded yet</p>
      </div>
    );
  }

  const visible = showAll ? entries : entries.slice(0, INITIAL_COUNT);
  const hasMore = entries.length > INITIAL_COUNT;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div
        className={`divide-y divide-gray-50 ${
          !showAll && hasMore ? "max-h-[520px] overflow-y-auto" : ""
        }`}
      >
        {visible.map((entry) => {
          const config = activityTypeConfig[entry.type] ?? {
            label: entry.type,
            dotColor: "bg-gray-400",
          };
          return (
            <div key={entry.id} className="px-4 py-3">
              <div className="flex items-start gap-2.5">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${config.dotColor}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-medium text-gray-900">{config.label}</span>
                    <span className="text-xs text-gray-400">{entry.formattedDate}</span>
                    {entry.is_repeat_visit && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700 border border-amber-200">Repeat</span>
                    )}
                    {entry.buyer_packet_requested && (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-green-700 border border-green-200">Disclosure Sent</span>
                    )}
                  </div>
                  {entry.agent_name && (
                    <p className="text-sm text-gray-500 mt-0.5">{entry.agent_name}</p>
                  )}
                  {entry.open_house_groups != null && (
                    <p className="text-sm text-gray-500 mt-0.5">{entry.open_house_groups} group{entry.open_house_groups !== 1 ? "s" : ""}</p>
                  )}
                  {entry.feedback_visible && entry.display_feedback && (
                    <p className="text-sm text-gray-400 italic mt-1">{entry.display_feedback}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {hasMore && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full py-3 text-sm font-medium text-gray-500 hover:text-gray-700 border-t border-gray-100 transition-colors"
        >
          See all {entries.length} entries
        </button>
      )}
      {hasMore && showAll && (
        <button
          onClick={() => setShowAll(false)}
          className="w-full py-3 text-sm font-medium text-gray-500 hover:text-gray-700 border-t border-gray-100 transition-colors"
        >
          Show less
        </button>
      )}
    </div>
  );
}
