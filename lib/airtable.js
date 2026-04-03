const BASE_URL = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}`;
const LISTINGS = process.env.AIRTABLE_LISTINGS_TABLE || 'Listings';
const ACTIVITY = process.env.AIRTABLE_ACTIVITY_TABLE || 'Activity';

function headers() {
  return {
    Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function airtableFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: headers(),
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Airtable error ${res.status}: ${err}`);
  }
  return res.json();
}

// ─── Listings ─────────────────────────────────────────────────────────────────

export async function getListings() {
  const data = await airtableFetch(
    `/${encodeURIComponent(LISTINGS)}?sort%5B0%5D%5Bfield%5D=Listing+Date&sort%5B0%5D%5Bdirection%5D=desc`
  );
  return data.records.map(normalizeListingRecord);
}

export async function getListing(id) {
  const data = await airtableFetch(`/${encodeURIComponent(LISTINGS)}/${id}`);
  return normalizeListingRecord(data);
}

export async function getListingByToken(token) {
  const formula = encodeURIComponent(`{Public Token}="${token}"`);
  const data = await airtableFetch(
    `/${encodeURIComponent(LISTINGS)}?filterByFormula=${formula}`
  );
  if (!data.records.length) return null;
  return normalizeListingRecord(data.records[0]);
}

export async function createListing(fields) {
  const data = await airtableFetch(`/${encodeURIComponent(LISTINGS)}`, {
    method: 'POST',
    body: JSON.stringify({ fields }),
  });
  return normalizeListingRecord(data);
}

export async function updateListing(id, fields) {
  const data = await airtableFetch(`/${encodeURIComponent(LISTINGS)}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields }),
  });
  return normalizeListingRecord(data);
}

function normalizeListingRecord(record) {
  return {
    id: record.id,
    address: record.fields['Property Address'] || '',
    listingDate: record.fields['Listing Date'] || null,
    listPrice: record.fields['List Price'] || '',
    status: record.fields['Status'] || 'Active',
    token: record.fields['Public Token'] || '',
    zillowUrl: record.fields['Zillow URL'] || '',
    redfinUrl: record.fields['Redfin URL'] || '',
    zillowViews: record.fields['Zillow Views'] ?? null,
    redfinViews: record.fields['Redfin Views'] ?? null,
    zillowViewsUpdated: record.fields['Zillow Views Updated'] || null,
    redfinViewsUpdated: record.fields['Redfin Views Updated'] || null,
  };
}

// ─── Activity ─────────────────────────────────────────────────────────────────

export async function getActivities(listingId) {
  const formula = encodeURIComponent(`FIND("${listingId}", ARRAYJOIN({Listing}))`);
  const data = await airtableFetch(
    `/${encodeURIComponent(ACTIVITY)}?filterByFormula=${formula}&sort%5B0%5D%5Bfield%5D=Date&sort%5B0%5D%5Bdirection%5D=desc`
  );
  return data.records.map(normalizeActivityRecord);
}

export async function createActivity(fields) {
  const data = await airtableFetch(`/${encodeURIComponent(ACTIVITY)}`, {
    method: 'POST',
    body: JSON.stringify({ fields }),
  });
  return normalizeActivityRecord(data);
}

export async function updateActivity(id, fields) {
  const data = await airtableFetch(`/${encodeURIComponent(ACTIVITY)}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields }),
  });
  return normalizeActivityRecord(data);
}

export async function deleteActivity(id) {
  await airtableFetch(`/${encodeURIComponent(ACTIVITY)}/${id}`, {
    method: 'DELETE',
  });
}

function normalizeActivityRecord(record) {
  return {
    id: record.id,
    date: record.fields['Date'] || null,
    type: record.fields['Type'] || '',
    agentName: record.fields['Agent Name'] || '',
    followUpSent: record.fields['Follow Up Text Sent'] || false,
    buyerPacketRequested: record.fields['Agent Requested Buyer Packet'] || false,
    feedback: record.fields['Feedback'] || '',
    openHouseGroups: record.fields['Open House Groups'] ?? null,
    listingId: record.fields['Listing']?.[0] || null,
  };
}

// ─── Summary Stats ────────────────────────────────────────────────────────────

export function computeSummary(activities, listingDate) {
  const buyerShowings = activities.filter((a) => a.type === 'Buyer Showing');
  const agentPreviews = activities.filter((a) => a.type === 'Agent Preview');
  const openHouses = activities.filter((a) => a.type === 'Open House');

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentShowings = buyerShowings.filter(
    (a) => a.date && new Date(a.date) >= sevenDaysAgo
  );

  const buyerPackets = activities.filter((a) => a.buyerPacketRequested).length;

  const openHouseGroups = openHouses.reduce(
    (sum, a) => sum + (a.openHouseGroups || 0),
    0
  );

  const dom = listingDate
    ? Math.floor((Date.now() - new Date(listingDate)) / (1000 * 60 * 60 * 24))
    : null;

  return {
    buyerShowings: buyerShowings.length,
    agentPreviews: agentPreviews.length,
    openHouseGroups,
    recentShowings: recentShowings.length,
    buyerPackets,
    daysOnMarket: dom,
  };
}
