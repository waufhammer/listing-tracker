"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import {
  getFlaggedAgents,
  createFlaggedAgent,
  updateFlaggedAgent,
  deleteFlaggedAgent,
} from "@/lib/showing-actions";
import type { FlaggedAgentRow } from "@/lib/showing-matching";

export default function FlaggedAgentsPage() {
  const [agents, setAgents] = useState<FlaggedAgentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function fetchAgents() {
    setLoading(true);
    const { data, error: fetchError } = await getFlaggedAgents();
    setAgents(data);
    setError(fetchError ?? "");
    setLoading(false);
  }

  useEffect(() => {
    fetchAgents();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error: createError } = await createFlaggedAgent({
      name,
      phone: phone || undefined,
      email: email || undefined,
      reason: reason || undefined,
    });
    if (createError) {
      setError(createError);
    } else {
      setError("");
      setName("");
      setPhone("");
      setEmail("");
      setReason("");
      setShowForm(false);
      fetchAgents();
    }
    setSaving(false);
  }

  async function handleToggleActive(agent: FlaggedAgentRow) {
    await updateFlaggedAgent(agent.id, { active: !agent.active });
    fetchAgents();
  }

  async function handleDelete(id: string) {
    await deleteFlaggedAgent(id);
    fetchAgents();
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">Flagged Agents</h2>
        <Link href="/admin/showing-verification" className="text-sm text-green-600 hover:text-green-800 font-medium">
          Back to dashboard
        </Link>
      </div>

      <p className="text-sm text-gray-600 mb-6">
        Agents on this list (Will himself, or any Aufhammer Homes agent who might host an open
        house) whose keybox access has no matching showing confirmation get routed to an
        approve/decline email instead of being silently left as unconfirmed access.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
      )}

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="mb-6 px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 transition-colors"
        >
          Add Agent
        </button>
      )}

      {showForm && (
        <div className="mb-8 bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">New Flagged Agent</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone (as it appears in Supra emails)</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. self, aufhammer_agent"
                className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="px-4 sm:px-6 py-8 text-center text-gray-500">Loading...</div>
        ) : agents.length === 0 ? (
          <div className="px-4 sm:px-6 py-8 text-center text-gray-500">No flagged agents yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {agents.map((a) => (
              <div key={a.id} className="px-4 sm:px-6 py-3 text-sm flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900">
                    {a.name}
                    {!a.active && <span className="ml-2 text-xs text-gray-400">(inactive)</span>}
                  </div>
                  <div className="text-gray-600 text-xs">
                    {[a.phone, a.email, a.reason].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <div className="flex gap-3 shrink-0">
                  <button
                    onClick={() => handleToggleActive(a)}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    {a.active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="text-xs text-red-500 hover:text-red-700 underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
