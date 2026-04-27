"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const STATUS_OPTIONS = [
  { value: "prepping", label: "Preparing to List" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "sold", label: "Sold" },
];

function slugify(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? "";
  return last
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}

export default function NewListingPage() {
  const router = useRouter();
  const [clientName, setClientName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [slug, setSlug] = useState("");
  const [listDate, setListDate] = useState("");
  const [status, setStatus] = useState("prepping");
  const [zillowVisible, setZillowVisible] = useState(false);
  const [redfinVisible, setRedfinVisible] = useState(false);
  const [compassVisible, setCompassVisible] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const slugManuallyEdited = useRef(false);

  // Auto-suggest slug from client name
  useEffect(() => {
    if (!slugManuallyEdited.current) {
      setSlug(slugify(clientName));
    }
  }, [clientName]);

  function handleSlugChange(value: string) {
    slugManuallyEdited.current = true;
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

    setSubmitting(true);

    // Check slug uniqueness
    const { data: existing } = await supabase
      .from("listings")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existing) {
      setError("That slug is already in use. Please choose a different one.");
      setSubmitting(false);
      return;
    }

    // Upload photo if provided
    let photoUrl: string | null = null;
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

      photoUrl = publicUrl;
    }

    // Insert listing
    const listingData: Record<string, unknown> = {
      client_name: clientName.trim(),
      property_address: propertyAddress.trim(),
      slug,
      list_date: listDate || null,
      status,
      zillow_visible: zillowVisible,
      redfin_visible: redfinVisible,
      compass_visible: compassVisible,
    };
    if (photoUrl) listingData.photo_url = photoUrl;

    const { error: insertError } = await supabase.from("listings").insert(listingData);

    if (insertError) {
      setError(`Failed to create listing: ${insertError.message}`);
      setSubmitting(false);
      return;
    }

    router.push("/admin");
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
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            New Listing
          </h1>

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
                placeholder="John Smith"
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
                placeholder="123 Main St, City, ST 12345"
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
                  placeholder="smith"
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

            {/* Visibility checkboxes */}
            <div className="flex flex-col sm:flex-row gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={zillowVisible}
                  onChange={(e) => setZillowVisible(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                Zillow Visible
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={redfinVisible}
                  onChange={(e) => setRedfinVisible(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                Redfin Visible
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={compassVisible}
                  onChange={(e) => setCompassVisible(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                Compass Visible
              </label>
            </div>

            {/* Photo Upload */}
            <div>
              <label
                htmlFor="photo"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Property Photo
              </label>
              <input
                id="photo"
                type="file"
                accept="image/*"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-green-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-green-700 hover:file:bg-green-100"
              />
            </div>

            {/* Submit */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? "Creating..." : "Create Listing"}
              </button>
              <Link
                href="/admin"
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
