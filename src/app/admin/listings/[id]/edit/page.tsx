"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface Note {
  id: string;
  content: string;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: "prepping", label: "Preparing to List" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "sold", label: "Sold" },
];

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}

export default function EditListingPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [clientName, setClientName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [slug, setSlug] = useState("");
  const [listDate, setListDate] = useState("");
  const [status, setStatus] = useState("prepping");
  const [pendingDate, setPendingDate] = useState("");
  const [soldDate, setSoldDate] = useState("");
  const [listPrice, setListPrice] = useState<number | "">("");
  const [salePrice, setSalePrice] = useState<number | "">("");
  const [offersReceived, setOffersReceived] = useState<number | "">("");
  const [zillowVisible, setZillowVisible] = useState(false);
  const [redfinVisible, setRedfinVisible] = useState(false);
  const [compassVisible, setCompassVisible] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // Notes state
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const notesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) fetchNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function fetchNotes() {
    const { data } = await supabase
      .from("listing_notes")
      .select("id, content, created_at")
      .eq("listing_id", id)
      .order("created_at", { ascending: true });
    if (data) setNotes(data);
  }

  async function handleAddNote() {
    if (!newNote.trim()) return;
    setSavingNote(true);
    const { error: noteError } = await supabase
      .from("listing_notes")
      .insert({ listing_id: id, content: newNote.trim() });
    if (!noteError) {
      setNewNote("");
      await fetchNotes();
      notesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    setSavingNote(false);
  }

  async function handleDeleteNote(noteId: string) {
    const { error: deleteErr } = await supabase
      .from("listing_notes")
      .delete()
      .eq("id", noteId);
    if (!deleteErr) setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }

  useEffect(() => {
    async function fetchListing() {
      const { data, error: fetchError } = await supabase
        .from("listings")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (fetchError || !data) {
        setError("Listing not found.");
        setLoading(false);
        return;
      }

      setClientName(data.client_name ?? "");
      setPropertyAddress(data.property_address ?? "");
      setSlug(data.slug ?? "");
      setListDate(data.list_date ?? "");
      setStatus(data.status ?? "prepping");
      setPendingDate(data.pending_date ?? "");
      setSoldDate(data.sold_date ?? "");
      setListPrice(data.list_price ?? "");
      setSalePrice(data.sale_price ?? "");
      setOffersReceived(data.offers_received ?? "");
      setZillowVisible(data.zillow_visible ?? false);
      setRedfinVisible(data.redfin_visible ?? false);
      setCompassVisible(data.compass_visible ?? false);
      setPhotoUrl(data.photo_url ?? null);
      setLoading(false);
    }

    fetchListing();
  }, [id]);

  const clientUrl = `listings.aufhammerhomes.com/${slug}`;

  function handleCopyUrl() {
    navigator.clipboard.writeText(`https://${clientUrl}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSlugChange(value: string) {
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!clientName.trim() || !propertyAddress.trim() || !slug.trim()) {
      setError("Client name, address, and slug are required.");
      return;
    }

    if (!isValidSlug(slug)) {
      setError(
        "Slug must be lowercase letters, numbers, and hyphens only (e.g. 'smith' or 'jones-family')."
      );
      return;
    }
    if (status === "pending" && !pendingDate) {
      setError("Pending date is required when status is Pending.");
      return;
    }
    if (status === "sold" && !soldDate) {
      setError("Sold date is required when status is Sold.");
      return;
    }

    setSubmitting(true);

    // Check slug uniqueness (exclude current listing)
    const { data: existing } = await supabase
      .from("listings")
      .select("id")
      .eq("slug", slug)
      .neq("id", id)
      .maybeSingle();

    if (existing) {
      setError("That slug is already in use. Please choose a different one.");
      setSubmitting(false);
      return;
    }

    // Upload new photo if provided
    let newPhotoUrl = photoUrl;
    if (photoFile) {
      const fileExt = photoFile.name.split(".").pop();
      const filePath = `${slug}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("property-photos")
        .upload(filePath, photoFile);

      if (uploadError) {
        setError(`Photo upload failed: ${uploadError.message}`);
        setSubmitting(false);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("property-photos").getPublicUrl(filePath);

      newPhotoUrl = publicUrl;
    }

    const updateData: Record<string, unknown> = {
      client_name: clientName.trim(),
      property_address: propertyAddress.trim(),
      slug,
      list_date: listDate || null,
      status,
      pending_date: pendingDate || null,
      sold_date: soldDate || null,
      list_price: listPrice === "" ? null : listPrice,
      sale_price: salePrice === "" ? null : salePrice,
      offers_received: offersReceived === "" ? null : offersReceived,
      zillow_visible: zillowVisible,
      redfin_visible: redfinVisible,
      compass_visible: compassVisible,
    };
    if (newPhotoUrl) updateData.photo_url = newPhotoUrl;

    const { error: updateError } = await supabase
      .from("listings")
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      setError(`Failed to update listing: ${updateError.message}`);
      setSubmitting(false);
      return;
    }

    router.push("/admin");
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      "Are you sure you want to delete this listing? This action cannot be undone."
    );
    if (!confirmed) return;

    setDeleting(true);

    const { error: deleteError } = await supabase
      .from("listings")
      .delete()
      .eq("id", id);

    if (deleteError) {
      setError(`Failed to delete listing: ${deleteError.message}`);
      setDeleting(false);
      return;
    }

    router.push("/admin");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            href="/admin"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            &larr; Back to Listings
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Edit Listing
          </h1>

          {/* Live client URL */}
          {slug && (
            <div className="mb-6 flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
              <span className="text-sm text-gray-600 truncate">
                {clientUrl}
              </span>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="ml-auto shrink-0 rounded-md bg-white border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Client Name */}
            <div>
              <label
                htmlFor="client_name"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Client Name
              </label>
              <input
                id="client_name"
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>

            {/* Property Address */}
            <div>
              <label
                htmlFor="property_address"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Property Address
              </label>
              <input
                id="property_address"
                type="text"
                value={propertyAddress}
                onChange={(e) => setPropertyAddress(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>

            {/* Slug */}
            <div>
              <label
                htmlFor="slug"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                URL Slug
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">
                  listings.aufhammerhomes.com/
                </span>
                <input
                  id="slug"
                  type="text"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Lowercase letters, numbers, and hyphens only.
              </p>
            </div>

            {/* List Date */}
            <div>
              <label
                htmlFor="list_date"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                List Date
              </label>
              <input
                id="list_date"
                type="date"
                value={listDate}
                onChange={(e) => setListDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              />
            </div>

            {/* Status */}
            <div>
              <label
                htmlFor="status"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Status
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Pending Date */}
            {status === "pending" && (
              <div>
                <label htmlFor="pending_date" className="block text-sm font-medium text-gray-700 mb-1">
                  Pending Date <span className="text-red-500">*</span>
                </label>
                <input
                  id="pending_date"
                  type="date"
                  value={pendingDate}
                  onChange={(e) => setPendingDate(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
            )}

            {/* Sold Date */}
            {status === "sold" && (
              <div>
                <label htmlFor="sold_date" className="block text-sm font-medium text-gray-700 mb-1">
                  Sold Date <span className="text-red-500">*</span>
                </label>
                <input
                  id="sold_date"
                  type="date"
                  value={soldDate}
                  onChange={(e) => setSoldDate(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
            )}

            {/* Pricing & Offers */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  List Price
                </label>
                <input
                  type="number"
                  min="0"
                  value={listPrice}
                  onChange={(e) => setListPrice(e.target.value === "" ? "" : parseInt(e.target.value))}
                  placeholder="e.g. 1250000"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sale Price
                </label>
                <input
                  type="number"
                  min="0"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value === "" ? "" : parseInt(e.target.value))}
                  placeholder="e.g. 1300000"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Offers Received
                </label>
                <input
                  type="number"
                  min="0"
                  value={offersReceived}
                  onChange={(e) => setOffersReceived(e.target.value === "" ? "" : parseInt(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>
            </div>

            {/* Photo Upload */}
            <div>
              <label
                htmlFor="photo"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Property Photo
              </label>
              {photoUrl && !photoFile && (
                <div className="mb-2">
                  <img
                    src={photoUrl}
                    alt="Property"
                    className="h-32 w-auto rounded-lg object-cover border border-gray-200"
                  />
                </div>
              )}
              <input
                id="photo"
                type="file"
                accept="image/*"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-green-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-green-700 hover:file:bg-green-100"
              />
              {photoUrl && (
                <p className="mt-1 text-xs text-gray-400">
                  Upload a new file to replace the current photo.
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
                <Link
                  href="/admin"
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancel
                </Link>
              </div>

              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
              >
                {deleting ? "Deleting..." : "Delete Listing"}
              </button>
            </div>
          </form>
        </div>
        {/* ── Internal Notes ─────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Internal Notes
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Only visible to admins. Not shown on the client dashboard.
          </p>

          {/* Notes list */}
          {notes.length === 0 ? (
            <p className="text-sm text-gray-400 mb-4">No notes yet.</p>
          ) : (
            <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="group bg-gray-50 border border-gray-100 rounded-lg px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap flex-1">
                      {note.content}
                    </p>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors text-sm leading-none opacity-0 group-hover:opacity-100 shrink-0"
                      title="Delete note"
                    >
                      &times;
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(note.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              ))}
              <div ref={notesEndRef} />
            </div>
          )}

          {/* Add note */}
          <div className="flex gap-2">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleAddNote();
                }
              }}
              placeholder="Add a note..."
              rows={2}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
            />
            <button
              onClick={handleAddNote}
              disabled={savingNote || !newNote.trim()}
              className="self-end rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {savingNote ? "..." : "Add"}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">Cmd+Enter to save</p>
        </div>
      </div>
    </div>
  );
}
