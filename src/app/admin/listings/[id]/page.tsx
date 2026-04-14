"use client";

import { useState, useEffect, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────

interface Listing {
  id: string;
  client_name: string;
  property_address: string;
  slug: string;
  status: string;
  list_date: string | null;
  zillow_visible: boolean;
  redfin_visible: boolean;
  compass_visible: boolean;
  realtor_visible: boolean;
  photo_url: string | null;
}

interface ActivityEntry {
  id: string;
  listing_id: string;
  date: string;
  type: string;
  agent_name: string | null;
  is_repeat_visit: boolean;
  follow_up_sent: boolean;
  buyer_packet_requested: boolean;
  raw_feedback: string | null;
  display_feedback: string | null;
  feedback_visible: boolean;
  open_house_groups: number | null;
}

interface PlatformView {
  id: string;
  listing_id: string;
  date: string;
  zillow_views: number | null;
  redfin_views: number | null;
  compass_views: number | null;
  realtor_views: number | null;
}

type ActivityType = "Buyer Showing" | "Agent Preview" | "Open House";

const activityTypeToDb: Record<ActivityType, string> = {
  "Buyer Showing": "buyer_showing",
  "Agent Preview": "agent_preview",
  "Open House": "open_house",
};

const dbTypeToLabel: Record<string, string> = {
  buyer_showing: "Buyer Showing",
  agent_preview: "Agent Preview",
  open_house: "Open House",
};

const typeDotColor: Record<string, string> = {
  buyer_showing: "bg-blue-500",
  agent_preview: "bg-gray-500",
  open_house: "bg-amber-500",
};

const STATUS_OPTIONS = [
  { value: "prepping", label: "Prepping" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "sold", label: "Sold" },
];

const statusColor: Record<string, string> = {
  prepping: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
  pending: "bg-blue-100 text-blue-800",
  sold: "bg-gray-100 text-gray-800",
};

// ── Bulk row type ────────────────────────────────────────────────────────────

interface BulkRow {
  key: number;
  activityType: ActivityType;
  activityDate: string;
  agentName: string;
  openHouseGroups: number | "";
  feedback: string;
}

let bulkNextKey = 1;

function createEmptyBulkRow(): BulkRow {
  return {
    key: bulkNextKey++,
    activityType: "Buyer Showing",
    activityDate: new Date().toISOString().split("T")[0],
    agentName: "",
    openHouseGroups: "",
    feedback: "",
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysOnMarket(listDate: string | null): number | null {
  if (!listDate) return null;
  const start = new Date(listDate);
  const now = new Date();
  const diff = Math.floor(
    (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );
  return diff >= 0 ? diff : null;
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  // ── Core data ──────────────────────────────────────────────────────────
  const [listing, setListing] = useState<Listing | null>(null);
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [views, setViews] = useState<PlatformView[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  // ── Section collapse state ─────────────────────────────────────────────
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showBulkEntry, setShowBulkEntry] = useState(false);
  const [showEditListing, setShowEditListing] = useState(false);

  // ── Single activity entry form ─────────────────────────────────────────
  const [singleType, setSingleType] = useState<ActivityType>("Buyer Showing");
  const [singleDate, setSingleDate] = useState("");
  const [singleAgent, setSingleAgent] = useState("");
  const [singleRepeat, setSingleRepeat] = useState(false);
  const [singleFollowUp, setSingleFollowUp] = useState(false);
  const [singlePacket, setSinglePacket] = useState(false);
  const [singleRawFeedback, setSingleRawFeedback] = useState("");
  const [singleDisplayFeedback, setSingleDisplayFeedback] = useState("");
  const [singleDisplayTouched, setSingleDisplayTouched] = useState(false);
  const [singleFeedbackVisible, setSingleFeedbackVisible] = useState(false);
  const [singleOpenHouseGroups, setSingleOpenHouseGroups] = useState<number | "">("");
  const [savingSingle, setSavingSingle] = useState(false);
  const [singleError, setSingleError] = useState("");
  const [repeatBanner, setRepeatBanner] = useState(false);

  // ── Bulk entry ─────────────────────────────────────────────────────────
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([createEmptyBulkRow()]);
  const [savingBulk, setSavingBulk] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [bulkSavedCount, setBulkSavedCount] = useState<number | null>(null);

  // ── Platform views form ────────────────────────────────────────────────
  const [viewDate, setViewDate] = useState(new Date().toISOString().split("T")[0]);
  const [zillowViewCount, setZillowViewCount] = useState<number | "">("");
  const [redfinViewCount, setRedfinViewCount] = useState<number | "">("");
  const [compassViewCount, setCompassViewCount] = useState<number | "">("");
  const [realtorViewCount, setRealtorViewCount] = useState<number | "">("");
  const [savingViews, setSavingViews] = useState(false);
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editViewData, setEditViewData] = useState<Record<string, number | "">>({});
  const [savingViewEdit, setSavingViewEdit] = useState(false);

  // ── Edit listing form ──────────────────────────────────────────────────
  const [editClientName, setEditClientName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editListDate, setEditListDate] = useState("");
  const [editStatus, setEditStatus] = useState("prepping");
  const [editZillow, setEditZillow] = useState(false);
  const [editRedfin, setEditRedfin] = useState(false);
  const [editCompass, setEditCompass] = useState(false);
  const [editPhotoUrl, setEditPhotoUrl] = useState<string | null>(null);
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingListing, setDeletingListing] = useState(false);
  const [editError, setEditError] = useState("");

  // ── Data fetching ──────────────────────────────────────────────────────

  async function fetchListing() {
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      setPageError(error?.message || "Listing not found.");
      setLoading(false);
      return;
    }

    setListing(data as Listing);
    // Populate edit form
    setEditClientName(data.client_name ?? "");
    setEditAddress(data.property_address ?? "");
    setEditSlug(data.slug ?? "");
    setEditListDate(data.list_date ?? "");
    setEditStatus(data.status ?? "prepping");
    setEditZillow(data.zillow_visible ?? false);
    setEditRedfin(data.redfin_visible ?? false);
    setEditCompass(data.compass_visible ?? false);
    setEditPhotoUrl(data.photo_url ?? null);
  }

  async function fetchEntries() {
    const { data } = await supabase
      .from("activity_entries")
      .select("*")
      .eq("listing_id", id)
      .order("date", { ascending: false });
    if (data) setEntries(data);
  }

  async function fetchViews() {
    const { data } = await supabase
      .from("platform_views")
      .select("*")
      .eq("listing_id", id)
      .order("date", { ascending: false });
    if (data) setViews(data);
  }

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      await Promise.all([fetchListing(), fetchEntries(), fetchViews()]);
      setLoading(false);
    }
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Computed stats ─────────────────────────────────────────────────────

  const buyerShowingCount = entries.filter((e) => e.type === "buyer_showing").length;
  const agentPreviewCount = entries.filter((e) => e.type === "agent_preview").length;
  const openHouseCount = entries.filter((e) => e.type === "open_house").length;
  const dom = listing ? daysOnMarket(listing.list_date) : null;

  const hasPlatforms =
    listing?.zillow_visible || listing?.redfin_visible || listing?.compass_visible || listing?.realtor_visible;
  const latestView = views.length > 0 ? views[0] : null;
  const totalPlatformViews =
    (latestView?.zillow_views ?? 0) +
    (latestView?.redfin_views ?? 0) +
    (latestView?.compass_views ?? 0) +
    (latestView?.realtor_views ?? 0);

  // ── Single entry handlers ──────────────────────────────────────────────

  function resetSingleForm() {
    setSingleType("Buyer Showing");
    setSingleDate("");
    setSingleAgent("");
    setSingleRepeat(false);
    setSingleFollowUp(false);
    setSinglePacket(false);
    setSingleRawFeedback("");
    setSingleDisplayFeedback("");
    setSingleDisplayTouched(false);
    setSingleFeedbackVisible(false);
    setSingleOpenHouseGroups("");
    setSingleError("");
    setRepeatBanner(false);
  }

  function handleSingleRawFeedbackChange(value: string) {
    setSingleRawFeedback(value);
    if (!singleDisplayTouched) {
      setSingleDisplayFeedback(value);
    }
  }

  async function checkRepeatVisit(name: string) {
    if (!name.trim()) {
      setRepeatBanner(false);
      return;
    }
    const { data } = await supabase
      .from("activity_entries")
      .select("id")
      .eq("listing_id", id)
      .ilike("agent_name", name.trim())
      .limit(1);
    if (data && data.length > 0) {
      setRepeatBanner(true);
      setSingleRepeat(true);
    } else {
      setRepeatBanner(false);
    }
  }

  async function handleSingleSubmit(e: FormEvent) {
    e.preventDefault();
    setSavingSingle(true);
    setSingleError("");

    const entry: Record<string, unknown> = {
      listing_id: id,
      date: singleDate,
      type: activityTypeToDb[singleType],
      raw_feedback: singleRawFeedback || null,
      display_feedback: singleDisplayFeedback || null,
      feedback_visible: singleFeedbackVisible,
    };

    if (singleType === "Open House") {
      entry.open_house_groups = singleOpenHouseGroups === "" ? null : singleOpenHouseGroups;
    } else {
      entry.agent_name = singleAgent || null;
      entry.is_repeat_visit = singleRepeat;
      entry.follow_up_sent = singleFollowUp;
      entry.buyer_packet_requested = singlePacket;
    }

    const { error } = await supabase.from("activity_entries").insert(entry);

    if (error) {
      setSingleError(error.message);
    } else {
      resetSingleForm();
      setShowAddEntry(false);
      await fetchEntries();
    }
    setSavingSingle(false);
  }

  // ── Bulk entry handlers ────────────────────────────────────────────────

  function updateBulkRow(key: number, updates: Partial<BulkRow>) {
    setBulkRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...updates } : r))
    );
  }

  function removeBulkRow(key: number) {
    setBulkRows((prev) => {
      const next = prev.filter((r) => r.key !== key);
      return next.length === 0 ? [createEmptyBulkRow()] : next;
    });
  }

  function addBulkRow() {
    const last = bulkRows[bulkRows.length - 1];
    setBulkRows((prev) => [
      ...prev,
      {
        ...createEmptyBulkRow(),
        activityDate: last?.activityDate ?? new Date().toISOString().split("T")[0],
        activityType: last?.activityType ?? "Buyer Showing",
      },
    ]);
  }

  async function handleBulkSubmit() {
    setSavingBulk(true);
    setBulkError("");
    setBulkSavedCount(null);

    const valid = bulkRows.every((r) => r.activityDate);
    if (!valid) {
      setBulkError("Every row needs a date.");
      setSavingBulk(false);
      return;
    }

    const payload = bulkRows.map((r) => {
      const entry: Record<string, unknown> = {
        listing_id: id,
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

    const { error } = await supabase.from("activity_entries").insert(payload);

    if (error) {
      setBulkError(error.message);
    } else {
      setBulkSavedCount(payload.length);
      setBulkRows([createEmptyBulkRow()]);
      await fetchEntries();
    }
    setSavingBulk(false);
  }

  // ── Platform views handler ─────────────────────────────────────────────

  async function handleViewsSubmit(e: FormEvent) {
    e.preventDefault();
    setSavingViews(true);

    const row: Record<string, unknown> = {
      listing_id: id,
      date: viewDate,
    };
    if (listing?.zillow_visible) row.zillow_views = zillowViewCount === "" ? null : zillowViewCount;
    if (listing?.redfin_visible) row.redfin_views = redfinViewCount === "" ? null : redfinViewCount;
    if (listing?.compass_visible) row.compass_views = compassViewCount === "" ? null : compassViewCount;
    if (listing?.realtor_visible) row.realtor_views = realtorViewCount === "" ? null : realtorViewCount;

    const { error } = await supabase.from("platform_views").insert(row);

    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      setViewDate(new Date().toISOString().split("T")[0]);
      setZillowViewCount("");
      setRedfinViewCount("");
      setCompassViewCount("");
      setRealtorViewCount("");
      await fetchViews();
    }
    setSavingViews(false);
  }

  // ── Platform views edit/delete handlers ────────────────────────────────

  function startEditView(v: PlatformView) {
    setEditingViewId(v.id);
    setEditViewData({
      zillow_views: v.zillow_views ?? "",
      redfin_views: v.redfin_views ?? "",
      compass_views: v.compass_views ?? "",
      realtor_views: v.realtor_views ?? "",
    });
  }

  async function handleSaveViewEdit(viewId: string) {
    setSavingViewEdit(true);
    const updates: Record<string, unknown> = {};
    if (listing?.zillow_visible) updates.zillow_views = editViewData.zillow_views === "" ? null : editViewData.zillow_views;
    if (listing?.redfin_visible) updates.redfin_views = editViewData.redfin_views === "" ? null : editViewData.redfin_views;
    if (listing?.compass_visible) updates.compass_views = editViewData.compass_views === "" ? null : editViewData.compass_views;
    if (listing?.realtor_visible) updates.realtor_views = editViewData.realtor_views === "" ? null : editViewData.realtor_views;

    const { error } = await supabase.from("platform_views").update(updates).eq("id", viewId);
    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      setEditingViewId(null);
      await fetchViews();
    }
    setSavingViewEdit(false);
  }

  async function handleDeleteView(viewId: string) {
    if (!confirm("Delete this view entry?")) return;
    const { error } = await supabase.from("platform_views").delete().eq("id", viewId);
    if (!error) await fetchViews();
  }

  // ── Edit listing handler ───────────────────────────────────────────────

  function handleSlugChange(value: string) {
    setEditSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    setEditError("");

    if (!editClientName.trim() || !editAddress.trim() || !editSlug.trim()) {
      setEditError("Client name, address, and slug are required.");
      return;
    }
    if (!isValidSlug(editSlug)) {
      setEditError("Slug must be lowercase letters, numbers, and hyphens only.");
      return;
    }

    setSavingEdit(true);

    // Check slug uniqueness
    const { data: existing } = await supabase
      .from("listings")
      .select("id")
      .eq("slug", editSlug)
      .neq("id", id)
      .maybeSingle();

    if (existing) {
      setEditError("That slug is already in use.");
      setSavingEdit(false);
      return;
    }

    // Upload photo if provided
    let newPhotoUrl = editPhotoUrl;
    if (editPhotoFile) {
      const fileExt = editPhotoFile.name.split(".").pop();
      const filePath = `${editSlug}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("property-photos")
        .upload(filePath, editPhotoFile);

      if (uploadError) {
        setEditError(`Photo upload failed: ${uploadError.message}`);
        setSavingEdit(false);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("property-photos").getPublicUrl(filePath);

      newPhotoUrl = publicUrl;
    }

    const updateData: Record<string, unknown> = {
      client_name: editClientName.trim(),
      property_address: editAddress.trim(),
      slug: editSlug,
      list_date: editListDate || null,
      status: editStatus,
      zillow_visible: editZillow,
      redfin_visible: editRedfin,
      compass_visible: editCompass,
    };
    if (newPhotoUrl) updateData.photo_url = newPhotoUrl;

    const { error } = await supabase
      .from("listings")
      .update(updateData)
      .eq("id", id);

    if (error) {
      setEditError(`Failed to update: ${error.message}`);
      setSavingEdit(false);
      return;
    }

    setSavingEdit(false);
    setEditPhotoFile(null);
    await fetchListing();
    setShowEditListing(false);
  }

  async function handleDeleteListing() {
    if (!window.confirm("Are you sure you want to delete this listing? This cannot be undone.")) return;
    setDeletingListing(true);

    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) {
      setEditError(`Failed to delete: ${error.message}`);
      setDeletingListing(false);
      return;
    }

    router.push("/admin");
  }

  // ── Loading / Error states ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-12 text-center text-gray-500">
        Loading...
      </div>
    );
  }

  if (pageError || !listing) {
    return (
      <div className="max-w-5xl mx-auto py-12 text-center">
        <p className="text-red-600 mb-4">{pageError || "Listing not found."}</p>
        <Link href="/admin" className="text-green-600 hover:text-green-800 font-medium">
          Back to Listings
        </Link>
      </div>
    );
  }

  const isSingleAgentType = singleType === "Buyer Showing" || singleType === "Agent Preview";

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back link + heading */}
      <div className="mb-6">
        <Link
          href="/admin"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          &larr; Back to Listings
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {listing.property_address}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {listing.client_name}
            <span
              className={`ml-3 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                statusColor[listing.status] ?? "bg-gray-100 text-gray-800"
              }`}
            >
              {listing.status}
            </span>
          </p>
        </div>
        <Link
          href={`/${listing.slug}`}
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 transition-colors"
        >
          View Client Page ↗
        </Link>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          1. SUMMARY STATS
      ════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Buyer Showings" value={buyerShowingCount} />
        <StatCard label="Agent Previews" value={agentPreviewCount} />
        <StatCard label="Open Houses" value={openHouseCount} />
        <StatCard label="Days on Market" value={dom ?? "--"} />
        {hasPlatforms && (
          <StatCard label="Total Platform Views" value={totalPlatformViews} />
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          2. ACTIVITY LOG
      ════════════════════════════════════════════════════════════════════ */}
      <section className="mb-8">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Activity and Feedback
            </h2>
          </div>
          {entries.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No activity entries yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {entries.map((entry) => {
                const feedbackExcerpt = entry.display_feedback
                  ? entry.display_feedback.length > 60
                    ? entry.display_feedback.slice(0, 60) + "..."
                    : entry.display_feedback
                  : "";
                return (
                  <div
                    key={entry.id}
                    className="px-6 py-3 flex items-center gap-3 text-sm hover:bg-gray-50"
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        typeDotColor[entry.type] ?? "bg-gray-400"
                      }`}
                    />
                    <span className="font-medium text-gray-900 whitespace-nowrap">
                      {dbTypeToLabel[entry.type] ?? entry.type}
                    </span>
                    <span className="text-gray-400">|</span>
                    <span className="text-gray-700 whitespace-nowrap">
                      {entry.date}
                    </span>
                    <span className="text-gray-400">|</span>
                    <span className="text-gray-700 truncate">
                      {entry.agent_name ||
                        (entry.type === "open_house"
                          ? `${entry.open_house_groups ?? 0} groups`
                          : "--")}
                    </span>
                    {feedbackExcerpt && (
                      <>
                        <span className="text-gray-400">|</span>
                        <span className="text-gray-500 truncate hidden sm:inline">
                          {feedbackExcerpt}
                        </span>
                      </>
                    )}
                    <div className="ml-auto flex items-center gap-2 shrink-0">
                      {entry.is_repeat_visit && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          Repeat
                        </span>
                      )}
                      <button
                        onClick={async () => {
                          const newVal = !entry.buyer_packet_requested;
                          await supabase.from("activity_entries").update({ buyer_packet_requested: newVal }).eq("id", entry.id);
                          await fetchEntries();
                        }}
                        className="inline-flex items-center gap-2 cursor-pointer"
                        title={entry.buyer_packet_requested ? "Click to mark as not sent" : "Click to mark as sent"}
                      >
                        <span className={`text-xs font-medium ${entry.buyer_packet_requested ? "text-green-700" : "text-gray-400"}`}>
                          Buyer Disclosure Package
                        </span>
                        <div className={`relative w-8 h-[18px] rounded-full transition-colors ${entry.buyer_packet_requested ? "bg-green-500" : "bg-gray-300"}`}>
                          <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform ${entry.buyer_packet_requested ? "left-[16px]" : "left-[2px]"}`} />
                        </div>
                      </button>
                      <Link
                        href={`/admin/activity/${entry.id}/edit`}
                        className="text-green-600 hover:text-green-800 font-medium"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          3. ADD SINGLE ACTIVITY ENTRY (collapsible)
      ════════════════════════════════════════════════════════════════════ */}
      <section className="mb-8">
        <button
          onClick={() => {
            setShowAddEntry(!showAddEntry);
            if (!showAddEntry) resetSingleForm();
          }}
          className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3"
        >
          <span className={`transition-transform ${showAddEntry ? "rotate-90" : ""}`}>
            &#9654;
          </span>
          Add Activity Entry
        </button>

        {showAddEntry && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            {singleError && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                {singleError}
              </div>
            )}
            <form onSubmit={handleSingleSubmit} className="space-y-4">
              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Activity Type
                </label>
                <select
                  value={singleType}
                  onChange={(e) => setSingleType(e.target.value as ActivityType)}
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
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                  required
                  className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                />
              </div>

              {/* Agent-specific fields */}
              {isSingleAgentType && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Agent Name
                    </label>
                    <input
                      type="text"
                      value={singleAgent}
                      onChange={(e) => setSingleAgent(e.target.value)}
                      onBlur={() => checkRepeatVisit(singleAgent)}
                      className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                    />
                  </div>

                  {repeatBanner && (
                    <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 px-4 py-2 rounded-md text-sm">
                      This agent has visited before
                    </div>
                  )}

                  <div className="flex flex-wrap gap-6">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={singleRepeat}
                        onChange={(e) => setSingleRepeat(e.target.checked)}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-600"
                      />
                      Repeat Visit
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={singleFollowUp}
                        onChange={(e) => setSingleFollowUp(e.target.checked)}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-600"
                      />
                      Follow-up Sent
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={singlePacket}
                        onChange={(e) => setSinglePacket(e.target.checked)}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-600"
                      />
                      Disclosure Package Requested
                    </label>
                  </div>
                </>
              )}

              {/* Open house groups */}
              {singleType === "Open House" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Number of Groups
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={singleOpenHouseGroups}
                    onChange={(e) =>
                      setSingleOpenHouseGroups(
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
                  value={singleRawFeedback}
                  onChange={(e) => handleSingleRawFeedbackChange(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                />
              </div>

              {/* Display feedback */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Feedback (Client-Facing)
                </label>
                <textarea
                  value={singleDisplayFeedback}
                  onChange={(e) => {
                    setSingleDisplayFeedback(e.target.value);
                    setSingleDisplayTouched(true);
                  }}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Auto-populates from raw feedback. Edit to customize what the client sees.
                </p>
              </div>

              {/* Feedback visible */}
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={singleFeedbackVisible}
                  onChange={(e) => setSingleFeedbackVisible(e.target.checked)}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-600"
                />
                Feedback Visible to Client
              </label>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={savingSingle}
                  className="px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {savingSingle ? "Saving..." : "Save Entry"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddEntry(false);
                    resetSingleForm();
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          4. BULK ACTIVITY ENTRY (collapsible)
      ════════════════════════════════════════════════════════════════════ */}
      <section className="mb-8">
        <button
          onClick={() => {
            setShowBulkEntry(!showBulkEntry);
            if (!showBulkEntry) {
              setBulkError("");
              setBulkSavedCount(null);
            }
          }}
          className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3"
        >
          <span className={`transition-transform ${showBulkEntry ? "rotate-90" : ""}`}>
            &#9654;
          </span>
          Bulk Activity Entry
        </button>

        {showBulkEntry && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {bulkSavedCount !== null && (
              <div className="mx-6 mt-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
                Saved {bulkSavedCount} {bulkSavedCount === 1 ? "entry" : "entries"} successfully.
              </div>
            )}
            {bulkError && (
              <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                {bulkError}
              </div>
            )}

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
                  {bulkRows.map((row, i) => {
                    const isAgent =
                      row.activityType === "Buyer Showing" || row.activityType === "Agent Preview";
                    return (
                      <tr key={row.key} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                        <td className="px-4 py-3">
                          <select
                            value={row.activityType}
                            onChange={(e) =>
                              updateBulkRow(row.key, {
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
                              updateBulkRow(row.key, { activityDate: e.target.value })
                            }
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent text-sm"
                          />
                        </td>
                        <td className="px-4 py-3">
                          {isAgent ? (
                            <input
                              type="text"
                              placeholder="Agent name"
                              value={row.agentName}
                              onChange={(e) =>
                                updateBulkRow(row.key, { agentName: e.target.value })
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
                                updateBulkRow(row.key, {
                                  openHouseGroups:
                                    e.target.value === "" ? "" : parseInt(e.target.value),
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
                              updateBulkRow(row.key, { feedback: e.target.value })
                            }
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent text-sm"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => removeBulkRow(row.key)}
                            className="text-gray-400 hover:text-red-500 transition-colors text-lg leading-none"
                            title="Remove row"
                          >
                            &times;
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 flex flex-wrap items-center gap-3 border-t border-gray-100">
              <button
                onClick={addBulkRow}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md font-medium hover:bg-gray-200 transition-colors text-sm"
              >
                + Add Row
              </button>
              <button
                onClick={handleBulkSubmit}
                disabled={savingBulk || bulkRows.length === 0}
                className="px-5 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 disabled:opacity-50 transition-colors text-sm"
              >
                {savingBulk
                  ? "Saving..."
                  : `Save ${bulkRows.length} ${bulkRows.length === 1 ? "Entry" : "Entries"}`}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          5. PLATFORM VIEWS
      ════════════════════════════════════════════════════════════════════ */}
      {hasPlatforms && (
        <section className="mb-8">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Platform Views
              </h2>
            </div>

            {/* Add new view entry */}
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Add View Entry
              </h3>
              <form onSubmit={handleViewsSubmit} className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={viewDate}
                    onChange={(e) => setViewDate(e.target.value)}
                    required
                    className="px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  />
                </div>
                {listing.zillow_visible && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Zillow Views
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={zillowViewCount}
                      onChange={(e) =>
                        setZillowViewCount(e.target.value === "" ? "" : parseInt(e.target.value))
                      }
                      placeholder="Cumulative"
                      className="w-28 px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                    />
                  </div>
                )}
                {listing.redfin_visible && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Redfin Views
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={redfinViewCount}
                      onChange={(e) =>
                        setRedfinViewCount(e.target.value === "" ? "" : parseInt(e.target.value))
                      }
                      placeholder="Cumulative"
                      className="w-28 px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                    />
                  </div>
                )}
                {listing.compass_visible && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Compass Views
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={compassViewCount}
                      onChange={(e) =>
                        setCompassViewCount(e.target.value === "" ? "" : parseInt(e.target.value))
                      }
                      placeholder="Cumulative"
                      className="w-28 px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                    />
                  </div>
                )}
                {listing.realtor_visible && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Realtor Views
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={realtorViewCount}
                      onChange={(e) =>
                        setRealtorViewCount(e.target.value === "" ? "" : parseInt(e.target.value))
                      }
                      placeholder="Cumulative"
                      className="w-28 px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                    />
                  </div>
                )}
                <button
                  type="submit"
                  disabled={savingViews}
                  className="px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 disabled:opacity-50 transition-colors text-sm"
                >
                  {savingViews ? "Saving..." : "Add Entry"}
                </button>
              </form>
            </div>

            {/* View history table */}
            {views.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                No platform views entries yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-gray-600">
                    <tr>
                      <th className="px-6 py-3 font-medium">Date</th>
                      {listing.zillow_visible && (
                        <th className="px-6 py-3 font-medium">Zillow</th>
                      )}
                      {listing.redfin_visible && (
                        <th className="px-6 py-3 font-medium">Redfin</th>
                      )}
                      {listing.compass_visible && (
                        <th className="px-6 py-3 font-medium">Compass</th>
                      )}
                      {listing.realtor_visible && (
                        <th className="px-6 py-3 font-medium">Realtor</th>
                      )}
                      <th className="px-6 py-3 font-medium w-28"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {views.map((v) => {
                      const isEditing = editingViewId === v.id;
                      return (
                      <tr key={v.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3 text-gray-900">{v.date}</td>
                        {listing.zillow_visible && (
                          <td className="px-6 py-3">
                            {isEditing ? (
                              <input type="number" min="0" value={editViewData.zillow_views} onChange={(e) => setEditViewData({ ...editViewData, zillow_views: e.target.value === "" ? "" : parseInt(e.target.value) })} className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600" />
                            ) : (
                              <span className="text-gray-700">{v.zillow_views ?? "--"}</span>
                            )}
                          </td>
                        )}
                        {listing.redfin_visible && (
                          <td className="px-6 py-3">
                            {isEditing ? (
                              <input type="number" min="0" value={editViewData.redfin_views} onChange={(e) => setEditViewData({ ...editViewData, redfin_views: e.target.value === "" ? "" : parseInt(e.target.value) })} className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600" />
                            ) : (
                              <span className="text-gray-700">{v.redfin_views ?? "--"}</span>
                            )}
                          </td>
                        )}
                        {listing.compass_visible && (
                          <td className="px-6 py-3">
                            {isEditing ? (
                              <input type="number" min="0" value={editViewData.compass_views} onChange={(e) => setEditViewData({ ...editViewData, compass_views: e.target.value === "" ? "" : parseInt(e.target.value) })} className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600" />
                            ) : (
                              <span className="text-gray-700">{v.compass_views ?? "--"}</span>
                            )}
                          </td>
                        )}
                        {listing.realtor_visible && (
                          <td className="px-6 py-3">
                            {isEditing ? (
                              <input type="number" min="0" value={editViewData.realtor_views} onChange={(e) => setEditViewData({ ...editViewData, realtor_views: e.target.value === "" ? "" : parseInt(e.target.value) })} className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600" />
                            ) : (
                              <span className="text-gray-700">{v.realtor_views ?? "--"}</span>
                            )}
                          </td>
                        )}
                        <td className="px-6 py-3 text-right">
                          {isEditing ? (
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => handleSaveViewEdit(v.id)} disabled={savingViewEdit} className="text-xs font-medium text-green-600 hover:text-green-800">{savingViewEdit ? "..." : "Save"}</button>
                              <button onClick={() => setEditingViewId(null)} className="text-xs font-medium text-gray-400 hover:text-gray-600">Cancel</button>
                            </div>
                          ) : (
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => startEditView(v)} className="text-xs font-medium text-green-600 hover:text-green-800">Edit</button>
                              <button onClick={() => handleDeleteView(v.id)} className="text-xs font-medium text-red-500 hover:text-red-700">Delete</button>
                            </div>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          6. EDIT LISTING (collapsible)
      ════════════════════════════════════════════════════════════════════ */}
      <section className="mb-12">
        <button
          onClick={() => {
            setShowEditListing(!showEditListing);
            setEditError("");
          }}
          className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3"
        >
          <span className={`transition-transform ${showEditListing ? "rotate-90" : ""}`}>
            &#9654;
          </span>
          Edit Listing
        </button>

        {showEditListing && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            {editError && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                {editError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-5">
              {/* Client Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Name
                </label>
                <input
                  type="text"
                  value={editClientName}
                  onChange={(e) => setEditClientName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>

              {/* Property Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Property Address
                </label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL Slug
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">
                    listings.aufhammerhomes.com/
                  </span>
                  <input
                    type="text"
                    value={editSlug}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  List Date
                </label>
                <input
                  type="date"
                  value={editListDate}
                  onChange={(e) => setEditListDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Platform visibility */}
              <div className="flex flex-col sm:flex-row gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={editZillow}
                    onChange={(e) => setEditZillow(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  Zillow Visible
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={editRedfin}
                    onChange={(e) => setEditRedfin(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  Redfin Visible
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={editCompass}
                    onChange={(e) => setEditCompass(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  Compass Visible
                </label>
              </div>

              {/* Photo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Property Photo
                </label>
                {editPhotoUrl && !editPhotoFile && (
                  <div className="mb-2">
                    <img
                      src={editPhotoUrl}
                      alt="Property"
                      className="h-32 w-auto rounded-lg object-cover border border-gray-200"
                    />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEditPhotoFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-green-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-green-700 hover:file:bg-green-100"
                />
                {editPhotoUrl && (
                  <p className="mt-1 text-xs text-gray-400">
                    Upload a new file to replace the current photo.
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 border-t border-gray-200">
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {savingEdit ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEditListing(false)}
                    className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleDeleteListing}
                  disabled={deletingListing}
                  className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
                >
                  {deletingListing ? "Deleting..." : "Delete Listing"}
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
