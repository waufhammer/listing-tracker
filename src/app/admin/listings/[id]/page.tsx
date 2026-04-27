"use client";

import { useState, useEffect, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAdminUser } from "@/lib/admin-user-context";

// ── Types ────────────────────────────────────────────────────────────────────

interface Listing {
  id: string;
  client_name: string;
  property_address: string;
  slug: string;
  status: string;
  list_date: string | null;
  pending_date: string | null;
  sold_date: string | null;
  zillow_visible: boolean;
  redfin_visible: boolean;
  compass_visible: boolean;
  platform_views_public: boolean;
  photo_url: string | null;
  list_price: number | null;
  sale_price: number | null;
  offers_received: number | null;
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
  display_feedback: string | null;
  feedback_visible: boolean;
  open_house_groups: number | null;
  logged_by: string | null;
}

interface PlatformView {
  id: string;
  listing_id: string;
  date: string;
  zillow_views: number | null;
  redfin_views: number | null;
  compass_views: number | null;
  logged_by: string | null;
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
  { value: "prepping", label: "Preparing to List" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "sold", label: "Sold" },
];

const statusColor: Record<string, string> = {
  prepping: "bg-blue-100 text-blue-800",
  active: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  sold: "bg-red-100 text-red-800",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysOnMarket(listDate: string | null, pendingDate?: string | null): number | null {
  if (!listDate) return null;
  const start = new Date(listDate);
  const end = pendingDate ? new Date(pendingDate) : new Date();
  const diff = Math.floor(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
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
  const adminUser = useAdminUser();
  const id = params.id as string;

  // ── Core data ──────────────────────────────────────────────────────────
  const [listing, setListing] = useState<Listing | null>(null);
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [views, setViews] = useState<PlatformView[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  // ── Section collapse state ─────────────────────────────────────────────
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showEditListing, setShowEditListing] = useState(false);
  const [showPlatformViews, setShowPlatformViews] = useState(false);

  // ── Single activity entry form ─────────────────────────────────────────
  const [singleType, setSingleType] = useState<ActivityType>("Buyer Showing");
  const [singleDate, setSingleDate] = useState("");
  const [singleAgent, setSingleAgent] = useState("");
  const [singleRepeat, setSingleRepeat] = useState(false);
  const [singleFollowUp, setSingleFollowUp] = useState(false);
  const [singlePacket, setSinglePacket] = useState(false);
  const [singleFeedback, setSingleFeedback] = useState("");
  const [singleFeedbackVisible, setSingleFeedbackVisible] = useState(false);
  const [singleOpenHouseGroups, setSingleOpenHouseGroups] = useState<number | "">("");
  const [savingSingle, setSavingSingle] = useState(false);
  const [singleError, setSingleError] = useState("");
  const [repeatBanner, setRepeatBanner] = useState(false);

  // ── Platform views form ────────────────────────────────────────────────
  const [viewDate, setViewDate] = useState(new Date().toISOString().split("T")[0]);
  const [zillowViewCount, setZillowViewCount] = useState<number | "">("");
  const [redfinViewCount, setRedfinViewCount] = useState<number | "">("");
  const [compassViewCount, setCompassViewCount] = useState<number | "">("");
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
  const [editPendingDate, setEditPendingDate] = useState("");
  const [editSoldDate, setEditSoldDate] = useState("");
  const [editListPrice, setEditListPrice] = useState<number | "">("");
  const [editSalePrice, setEditSalePrice] = useState<number | "">("");
  const [editOffersReceived, setEditOffersReceived] = useState<number | "">("");
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
    setEditPendingDate(data.pending_date ?? "");
    setEditSoldDate(data.sold_date ?? "");
    setEditListPrice(data.list_price ?? "");
    setEditSalePrice(data.sale_price ?? "");
    setEditOffersReceived(data.offers_received ?? "");
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
  const dom = listing ? daysOnMarket(listing.list_date, listing.pending_date) : null;

  const latestView = views.length > 0 ? views[0] : null;
  const totalPlatformViews =
    (latestView?.zillow_views ?? 0) +
    (latestView?.redfin_views ?? 0) +
    (latestView?.compass_views ?? 0);

  // ── Single entry handlers ──────────────────────────────────────────────

  function resetSingleForm() {
    setSingleType("Buyer Showing");
    setSingleDate("");
    setSingleAgent("");
    setSingleRepeat(false);
    setSingleFollowUp(false);
    setSinglePacket(false);
    setSingleFeedback("");
    setSingleFeedbackVisible(false);
    setSingleOpenHouseGroups("");
    setSingleError("");
    setRepeatBanner(false);
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
      display_feedback: singleFeedback || null,
      feedback_visible: singleFeedbackVisible,
      logged_by: adminUser?.id ?? null,
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

  // ── Platform views handler ─────────────────────────────────────────────

  async function handleViewsSubmit(e: FormEvent) {
    e.preventDefault();
    setSavingViews(true);

    const row: Record<string, unknown> = {
      listing_id: id,
      date: viewDate,
    };
    row.zillow_views = zillowViewCount === "" ? null : zillowViewCount;
    row.redfin_views = redfinViewCount === "" ? null : redfinViewCount;
    row.compass_views = compassViewCount === "" ? null : compassViewCount;
    row.logged_by = adminUser?.id ?? null;

    const { error } = await supabase.from("platform_views").insert(row);

    if (error) {
      alert(`Error: ${error.message}`);
    } else {
      setViewDate(new Date().toISOString().split("T")[0]);
      setZillowViewCount("");
      setRedfinViewCount("");
      setCompassViewCount("");
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
    });
  }

  async function handleSaveViewEdit(viewId: string) {
    setSavingViewEdit(true);
    const updates: Record<string, unknown> = {
      zillow_views: editViewData.zillow_views === "" ? null : editViewData.zillow_views,
      redfin_views: editViewData.redfin_views === "" ? null : editViewData.redfin_views,
      compass_views: editViewData.compass_views === "" ? null : editViewData.compass_views,
    };

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
    if (editStatus === "pending" && !editPendingDate) {
      setEditError("Pending date is required when status is Pending.");
      return;
    }
    if (editStatus === "sold" && !editSoldDate) {
      setEditError("Sold date is required when status is Sold.");
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
      pending_date: editPendingDate || null,
      sold_date: editSoldDate || null,
      zillow_visible: editZillow,
      redfin_visible: editRedfin,
      compass_visible: editCompass,
      list_price: editListPrice === "" ? null : editListPrice,
      sale_price: editSalePrice === "" ? null : editSalePrice,
      offers_received: editOffersReceived === "" ? null : editOffersReceived,
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
      {/* Heading */}

      <div className="mb-4">
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

      {/* ════════════════════════════════════════════════════════════════════
          1. COMPACT STATS
      ════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-gray-600 mb-5">
        <span><span className="font-semibold text-gray-900">{buyerShowingCount}</span> Showings</span>
        <span><span className="font-semibold text-gray-900">{agentPreviewCount}</span> Previews</span>
        <span><span className="font-semibold text-gray-900">{openHouseCount}</span> Open Houses</span>
        <span><span className="font-semibold text-gray-900">{dom ?? "--"}</span> DOM</span>
        <span><span className="font-semibold text-gray-900">{totalPlatformViews}</span> Platform Views</span>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          2. ACTION BUTTONS
      ════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-wrap gap-3 mb-8">
        <button
          onClick={() => router.push("/admin")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          &larr; Back
        </button>
        <Link
          href={`/${listing.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 transition-colors"
        >
          View Client Page ↗
        </Link>
        <button
          onClick={() => {
            setShowAddEntry(!showAddEntry);
            if (!showAddEntry) resetSingleForm();
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 transition-colors"
        >
          Enter Activity
        </button>
        <button
          onClick={() => setShowPlatformViews(!showPlatformViews)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700 transition-colors"
        >
          Enter Platform Views
        </button>
        <button
          onClick={() => {
            setShowEditListing(!showEditListing);
            setEditError("");
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          Edit Listing
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          2. ACTIVITY LOG
      ════════════════════════════════════════════════════════════════════ */}
      <section className="mb-8">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
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
                    className="px-4 sm:px-6 py-3 text-sm hover:bg-gray-50"
                  >
                    {/* Desktop: inline row */}
                    <div className="hidden sm:flex items-center gap-3">
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
                          <span className="text-gray-500 truncate">
                            {feedbackExcerpt}
                          </span>
                        </>
                      )}
                      {entry.logged_by && (
                        <span className="text-xs text-gray-400 shrink-0">
                          {entry.logged_by === "will" ? "W" : "VA"}
                        </span>
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
                            Disclosure Pkg
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
                    {/* Mobile: stacked card */}
                    <div className="sm:hidden space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              typeDotColor[entry.type] ?? "bg-gray-400"
                            }`}
                          />
                          <span className="font-medium text-gray-900">
                            {dbTypeToLabel[entry.type] ?? entry.type}
                          </span>
                          {entry.is_repeat_visit && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              Repeat
                            </span>
                          )}
                        </div>
                        <Link
                          href={`/admin/activity/${entry.id}/edit`}
                          className="text-green-600 hover:text-green-800 font-medium text-xs"
                        >
                          Edit
                        </Link>
                      </div>
                      <div className="flex items-center justify-between text-gray-600">
                        <span>
                          {entry.date}
                          {entry.logged_by && (
                            <span className="ml-2 text-xs text-gray-400">
                              by {entry.logged_by === "will" ? "Will" : "VA"}
                            </span>
                          )}
                        </span>
                        <span className="truncate ml-2">
                          {entry.agent_name ||
                            (entry.type === "open_house"
                              ? `${entry.open_house_groups ?? 0} groups`
                              : "")}
                        </span>
                      </div>
                      {feedbackExcerpt && (
                        <p className="text-gray-500 text-xs truncate">{feedbackExcerpt}</p>
                      )}
                      <div className="flex items-center justify-between">
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
                            Disclosure Pkg
                          </span>
                          <div className={`relative w-8 h-[18px] rounded-full transition-colors ${entry.buyer_packet_requested ? "bg-green-500" : "bg-gray-300"}`}>
                            <div className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform ${entry.buyer_packet_requested ? "left-[16px]" : "left-[2px]"}`} />
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          3. ADD SINGLE ACTIVITY ENTRY (modal)
      ════════════════════════════════════════════════════════════════════ */}
      {showAddEntry && (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => { setShowAddEntry(false); resetSingleForm(); }} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Enter Activity</h2>
              <button onClick={() => { setShowAddEntry(false); resetSingleForm(); }} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
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

              {/* Feedback */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Feedback
                </label>
                <textarea
                  value={singleFeedback}
                  onChange={(e) => setSingleFeedback(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                />
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
        </div>
      </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          4. PLATFORM VIEWS (modal)
      ════════════════════════════════════════════════════════════════════ */}
      {showPlatformViews && (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowPlatformViews(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Platform Views
              </h2>
              <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <span>{listing.platform_views_public ? "Visible to client" : "Hidden from client"}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={listing.platform_views_public}
                  onClick={async () => {
                    const newVal = !listing.platform_views_public;
                    const { error } = await supabase.from("listings").update({ platform_views_public: newVal }).eq("id", listing.id);
                    if (!error) setListing({ ...listing, platform_views_public: newVal });
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${listing.platform_views_public ? "bg-green-600" : "bg-gray-300"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${listing.platform_views_public ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </label>
              <button onClick={() => setShowPlatformViews(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
              </div>
            </div>

            {/* Add new view entry */}
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Add View Entry
              </h3>
              <form onSubmit={handleViewsSubmit} className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={viewDate}
                    onChange={(e) => setViewDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Zillow
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={zillowViewCount}
                    onChange={(e) =>
                      setZillowViewCount(e.target.value === "" ? "" : parseInt(e.target.value))
                    }
                    placeholder="Cumulative"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Redfin
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={redfinViewCount}
                    onChange={(e) =>
                      setRedfinViewCount(e.target.value === "" ? "" : parseInt(e.target.value))
                    }
                    placeholder="Cumulative"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Compass
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={compassViewCount}
                    onChange={(e) =>
                      setCompassViewCount(e.target.value === "" ? "" : parseInt(e.target.value))
                    }
                    placeholder="Cumulative"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <button
                    type="submit"
                    disabled={savingViews}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 disabled:opacity-50 transition-colors text-sm"
                  >
                    {savingViews ? "Saving..." : "Add Entry"}
                  </button>
                </div>
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
                      <th className="px-3 sm:px-6 py-3 font-medium">Date</th>
                      <th className="px-3 sm:px-6 py-3 font-medium">Zillow</th>
                      <th className="px-3 sm:px-6 py-3 font-medium">Redfin</th>
                      <th className="px-3 sm:px-6 py-3 font-medium">Compass</th>
                      <th className="px-3 sm:px-6 py-3 font-medium w-20 sm:w-28"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {views.map((v) => {
                      const isEditing = editingViewId === v.id;
                      return (
                      <tr key={v.id} className="hover:bg-gray-50">
                        <td className="px-3 sm:px-6 py-3 text-gray-900">
                          {v.date}
                          {v.logged_by && (
                            <span className="ml-2 text-xs text-gray-400">{v.logged_by === "will" ? "W" : "VA"}</span>
                          )}
                        </td>
                        <td className="px-3 sm:px-6 py-3">
                            {isEditing ? (
                              <input type="number" min="0" value={editViewData.zillow_views} onChange={(e) => setEditViewData({ ...editViewData, zillow_views: e.target.value === "" ? "" : parseInt(e.target.value) })} className="w-16 sm:w-24 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600" />
                            ) : (
                              <span className="text-gray-700">{v.zillow_views ?? "--"}</span>
                            )}
                          </td>
                        <td className="px-3 sm:px-6 py-3">
                            {isEditing ? (
                              <input type="number" min="0" value={editViewData.redfin_views} onChange={(e) => setEditViewData({ ...editViewData, redfin_views: e.target.value === "" ? "" : parseInt(e.target.value) })} className="w-16 sm:w-24 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600" />
                            ) : (
                              <span className="text-gray-700">{v.redfin_views ?? "--"}</span>
                            )}
                          </td>
                        <td className="px-3 sm:px-6 py-3">
                            {isEditing ? (
                              <input type="number" min="0" value={editViewData.compass_views} onChange={(e) => setEditViewData({ ...editViewData, compass_views: e.target.value === "" ? "" : parseInt(e.target.value) })} className="w-16 sm:w-24 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600" />
                            ) : (
                              <span className="text-gray-700">{v.compass_views ?? "--"}</span>
                            )}
                          </td>
                        <td className="px-3 sm:px-6 py-3 text-right">
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
        </div>
      </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          6. EDIT LISTING (modal)
      ════════════════════════════════════════════════════════════════════ */}
      {showEditListing && (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => { setShowEditListing(false); setEditError(""); }} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Edit Listing</h2>
              <button onClick={() => { setShowEditListing(false); setEditError(""); }} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
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

              {/* Pending Date */}
              {editStatus === "pending" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pending Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={editPendingDate}
                    onChange={(e) => setEditPendingDate(e.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </div>
              )}

              {/* Sold Date */}
              {editStatus === "sold" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sold Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={editSoldDate}
                    onChange={(e) => setEditSoldDate(e.target.value)}
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
                    value={editListPrice}
                    onChange={(e) => setEditListPrice(e.target.value === "" ? "" : parseInt(e.target.value))}
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
                    value={editSalePrice}
                    onChange={(e) => setEditSalePrice(e.target.value === "" ? "" : parseInt(e.target.value))}
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
                    value={editOffersReceived}
                    onChange={(e) => setEditOffersReceived(e.target.value === "" ? "" : parseInt(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </div>
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
        </div>
      </div>
      )}
    </div>
  );
}

