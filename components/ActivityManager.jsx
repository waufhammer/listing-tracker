'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const TYPES = ['Buyer Showing', 'Open House', 'Agent Preview'];

const TYPE_STYLES = {
  'Buyer Showing': 'bg-green-50 text-green-700',
  'Open House': 'bg-blue-50 text-blue-700',
  'Agent Preview': 'bg-purple-50 text-purple-700',
};

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const BLANK = {
  date: new Date().toISOString().slice(0, 10),
  type: 'Buyer Showing',
  agentName: '',
  followUpSent: false,
  buyerPacketRequested: false,
  feedback: '',
  openHouseGroups: '',
};

export default function ActivityManager({ activities: initial, listingId }) {
  const router = useRouter();
  const [activities, setActivities] = useState(initial);
  const [modal, setModal] = useState(null); // null | 'new' | activity object (for edit)
  const [form, setForm] = useState(BLANK);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  function openNew() {
    setForm(BLANK);
    setError('');
    setModal('new');
  }

  function openEdit(a) {
    setForm({
      date: a.date || '',
      type: a.type || 'Buyer Showing',
      agentName: a.agentName || '',
      followUpSent: a.followUpSent || false,
      buyerPacketRequested: a.buyerPacketRequested || false,
      feedback: a.feedback || '',
      openHouseGroups: a.openHouseGroups || '',
    });
    setError('');
    setModal(a);
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.date) { setError('Date is required.'); return; }
    setLoading(true);
    setError('');
    try {
      const isEdit = modal !== 'new';
      const url = isEdit ? `/api/activity/${modal.id}` : '/api/activity';
      const method = isEdit ? 'PATCH' : 'POST';
      const body = { ...form, ...(isEdit ? {} : { listingId }) };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const updated = await res.json();

      if (isEdit) {
        setActivities((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      } else {
        setActivities((prev) => [updated, ...prev]);
      }
      setModal(null);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    setLoading(true);
    try {
      await fetch(`/api/activity/${id}`, { method: 'DELETE' });
      setActivities((prev) => prev.filter((a) => a.id !== id));
      setDeleteConfirm(null);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-brand-dark">Activity Log</h2>
        <button onClick={openNew} className="btn-primary flex items-center gap-1.5 text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Log Activity
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        {activities.length === 0 ? (
          <div className="text-center py-12 text-brand-gray-text text-sm">No activity logged yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-gray-medium">
                {['Date', 'Type', 'Agent', 'Follow-up', 'Buyer Packet', 'Feedback', ''].map((h) => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-brand-gray-text uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activities.map((a, i) => (
                <tr key={a.id} className={`border-b border-brand-gray-medium last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50'}`}>
                  <td className="py-3 px-4 whitespace-nowrap text-brand-dark">{fmt(a.date)}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${TYPE_STYLES[a.type] || 'bg-gray-100 text-gray-600'}`}>
                      {a.type || '—'}
                    </span>
                    {a.type === 'Open House' && a.openHouseGroups > 0 && (
                      <span className="ml-1 text-xs text-brand-gray-text">({a.openHouseGroups} grp)</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-brand-dark">{a.agentName || '—'}</td>
                  <td className="py-3 px-4 text-center">{a.followUpSent ? <span className="text-brand-green font-bold">✓</span> : <span className="text-gray-300">—</span>}</td>
                  <td className="py-3 px-4 text-center">{a.buyerPacketRequested ? <span className="text-brand-green font-bold">✓</span> : <span className="text-gray-300">—</span>}</td>
                  <td className="py-3 px-4 text-brand-gray-text max-w-xs">
                    <span className="line-clamp-2">{a.feedback || '—'}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(a)} className="text-xs text-brand-gray-text hover:text-brand-dark underline">Edit</button>
                      <button onClick={() => setDeleteConfirm(a.id)} className="text-xs text-red-400 hover:text-red-600 underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-brand-gray-medium sticky top-0 bg-white">
              <h2 className="text-lg font-semibold">{modal === 'new' ? 'Log New Activity' : 'Edit Activity'}</h2>
              <button onClick={() => setModal(null)} className="text-brand-gray-text hover:text-brand-dark">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Date *</label>
                  <input type="date" name="date" value={form.date} onChange={handleChange} className="form-input" required />
                </div>
                <div>
                  <label className="form-label">Type *</label>
                  <select name="type" value={form.type} onChange={handleChange} className="form-input">
                    {TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Agent Name</label>
                <input name="agentName" value={form.agentName} onChange={handleChange} className="form-input" placeholder="e.g. Jane Smith" />
              </div>

              {form.type === 'Open House' && (
                <div>
                  <label className="form-label"># of Open House Groups</label>
                  <input type="number" min="0" name="openHouseGroups" value={form.openHouseGroups} onChange={handleChange} className="form-input" placeholder="0" />
                </div>
              )}

              <div>
                <label className="form-label">Feedback Received</label>
                <textarea name="feedback" value={form.feedback} onChange={handleChange} className="form-input" rows={3} placeholder="Buyer feedback notes..." />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" name="followUpSent" checked={form.followUpSent} onChange={handleChange} className="w-4 h-4 accent-brand-green" />
                  <span className="text-sm text-brand-dark">Follow-up text sent</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" name="buyerPacketRequested" checked={form.buyerPacketRequested} onChange={handleChange} className="w-4 h-4 accent-brand-green" />
                  <span className="text-sm text-brand-dark">Agent requested buyer packet</span>
                </label>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-3 pt-2 border-t border-brand-gray-medium">
                <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  {loading ? 'Saving...' : modal === 'new' ? 'Save Activity' : 'Update Activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
            <p className="text-brand-dark font-medium mb-2">Delete this activity?</p>
            <p className="text-sm text-brand-gray-text mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} disabled={loading} className="btn-danger flex-1">
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
