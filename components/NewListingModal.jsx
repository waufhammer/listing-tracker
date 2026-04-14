'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewListingModal({ baseUrl }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdLink, setCreatedLink] = useState('');
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    address: '',
    listingDate: '',
    listPrice: '',
    status: 'Active',
    zillowUrl: '',
    redfinUrl: '',
  });

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.address.trim()) { setError('Property address is required.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const listing = await res.json();
      const link = `${baseUrl}/listing/${listing.token}`;
      setCreatedLink(link);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(createdLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClose() {
    setOpen(false);
    setCreatedLink('');
    setCopied(false);
    setError('');
    setForm({ address: '', listingDate: '', listPrice: '', status: 'Active', zillowUrl: '', redfinUrl: '' });
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        New Listing
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-brand-gray-medium">
              <h2 className="text-lg font-semibold text-brand-dark">
                {createdLink ? '🎉 Listing Created!' : 'New Listing'}
              </h2>
              <button onClick={handleClose} className="text-brand-gray-text hover:text-brand-dark">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {createdLink ? (
              <div className="px-6 py-6 space-y-4">
                <p className="text-sm text-brand-gray-text">Your listing has been created. Share this link with your client:</p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={createdLink}
                    className="form-input flex-1 bg-gray-50 text-xs"
                  />
                  <button onClick={copyLink} className="btn-primary whitespace-nowrap">
                    {copied ? '✓ Copied!' : 'Copy Link'}
                  </button>
                </div>
                <button onClick={handleClose} className="btn-secondary w-full mt-2">Done</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
                <div>
                  <label className="form-label">Property Address *</label>
                  <input name="address" value={form.address} onChange={handleChange} className="form-input" placeholder="123 Main St, Seattle, WA 98101" required />
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
                    <option>Active</option>
                    <option>Coming Soon</option>
                    <option>Under Contract</option>
                    <option>Sold</option>
                    <option>Withdrawn</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Zillow URL (optional)</label>
                  <input name="zillowUrl" value={form.zillowUrl} onChange={handleChange} className="form-input" placeholder="https://zillow.com/..." />
                </div>
                <div>
                  <label className="form-label">Redfin URL (optional)</label>
                  <input name="redfinUrl" value={form.redfinUrl} onChange={handleChange} className="form-input" placeholder="https://redfin.com/..." />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex gap-3 pt-2 border-t border-brand-gray-medium">
                  <button type="button" onClick={handleClose} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" disabled={loading} className="btn-primary flex-1">
                    {loading ? 'Creating...' : 'Create Listing'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
