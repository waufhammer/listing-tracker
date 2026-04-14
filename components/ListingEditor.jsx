'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ListingEditor({ listing }) {
  const router = useRouter();
  const [form, setForm] = useState({
    address: listing.address || '',
    listingDate: listing.listingDate || '',
    listPrice: listing.listPrice || '',
    status: listing.status || 'Active',
    zillowUrl: listing.zillowUrl || '',
    redfinUrl: listing.redfinUrl || '',
  });
  const [views, setViews] = useState({
    zillowViews: listing.zillowViews ?? '',
    redfinViews: listing.redfinViews ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [savingViews, setSavingViews] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedViews, setSavedViews] = useState(false);
  const [error, setError] = useState('');

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/listings/${listing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateViews(e) {
    e.preventDefault();
    setSavingViews(true);
    setError('');
    const today = new Date().toISOString().slice(0, 10);
    try {
      const res = await fetch(`/api/listings/${listing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zillowViews: views.zillowViews !== '' ? Number(views.zillowViews) : null,
          redfinViews: views.redfinViews !== '' ? Number(views.redfinViews) : null,
          zillowViewsUpdated: today,
          redfinViewsUpdated: today,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSavedViews(true);
      setTimeout(() => setSavedViews(false), 2500);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingViews(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Listing details card */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-brand-dark mb-4">Listing Details</h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="form-label">Property Address</label>
            <input name="address" value={form.address} onChange={handleChange} className="form-input" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Listing Date</label>
              <input type="date" name="listingDate" value={form.listingDate} onChange={handleChange} className="form-input" />
            </div>
            <div>
              <label className="form-label">List Price</label>
              <input name="listPrice" value={form.listPrice} onChange={handleChange} className="form-input" placeholder="$950,000" />
            </div>
          </div>
          <div>
            <label className="form-label">Status</label>
            <select name="status" value={form.status} onChange={handleChange} className="form-input">
              {['Active', 'Coming Soon', 'Under Contract', 'Sold', 'Withdrawn'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Zillow URL</label>
            <input name="zillowUrl" value={form.zillowUrl} onChange={handleChange} className="form-input" placeholder="https://zillow.com/..." />
          </div>
          <div>
            <label className="form-label">Redfin URL</label>
            <input name="redfinUrl" value={form.redfinUrl} onChange={handleChange} className="form-input" placeholder="https://redfin.com/..." />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Online views card */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-brand-dark mb-1">Online Views</h3>
        <p className="text-xs text-brand-gray-text mb-4">Enter the current view counts from Zillow and Redfin. Today's date will be saved automatically.</p>
        <form onSubmit={handleUpdateViews} className="space-y-4">
          <div>
            <label className="form-label">Zillow Views</label>
            <input
              type="number"
              min="0"
              value={views.zillowViews}
              onChange={(e) => setViews((v) => ({ ...v, zillowViews: e.target.value }))}
              className="form-input"
              placeholder="e.g. 1,240"
            />
          </div>
          <div>
            <label className="form-label">Redfin Views</label>
            <input
              type="number"
              min="0"
              value={views.redfinViews}
              onChange={(e) => setViews((v) => ({ ...v, redfinViews: e.target.value }))}
              className="form-input"
              placeholder="e.g. 840"
            />
          </div>
          <button type="submit" disabled={savingViews} className="btn-primary w-full">
            {savingViews ? 'Updating...' : savedViews ? '✓ Updated!' : 'Update View Counts'}
          </button>
        </form>
      </div>
    </div>
  );
}
