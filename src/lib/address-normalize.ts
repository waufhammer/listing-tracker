// Normalizes free-text addresses from incoming showing/keybox emails so
// they can be matched against `listings.property_address`. That column is
// street-only in this app (e.g. "410 N 178th Pl" — no city/state/zip,
// since every listing is in the Seattle area for a single agent), while
// event addresses do include city/state/zip. The comparison key below is
// therefore intentionally street-only on both sides: it's the only part
// both formats reliably share.

const STATE_NAME_TO_ABBR: Record<string, string> = {
  alabama: "al", alaska: "ak", arizona: "az", arkansas: "ar", california: "ca",
  colorado: "co", connecticut: "ct", delaware: "de", florida: "fl", georgia: "ga",
  hawaii: "hi", idaho: "id", illinois: "il", indiana: "in", iowa: "ia",
  kansas: "ks", kentucky: "ky", louisiana: "la", maine: "me", maryland: "md",
  massachusetts: "ma", michigan: "mi", minnesota: "mn", mississippi: "ms",
  missouri: "mo", montana: "mt", nebraska: "ne", nevada: "nv",
  "new hampshire": "nh", "new jersey": "nj", "new mexico": "nm", "new york": "ny",
  "north carolina": "nc", "north dakota": "nd", ohio: "oh", oklahoma: "ok",
  oregon: "or", pennsylvania: "pa", "rhode island": "ri", "south carolina": "sc",
  "south dakota": "sd", tennessee: "tn", texas: "tx", utah: "ut", vermont: "vt",
  virginia: "va", washington: "wa", "west virginia": "wv", wisconsin: "wi",
  wyoming: "wy",
};

const STREET_SUFFIX_TO_ABBR: Record<string, string> = {
  street: "st", avenue: "ave", drive: "dr", lane: "ln", place: "pl",
  boulevard: "blvd", court: "ct", road: "rd", circle: "cir", terrace: "ter",
  parkway: "pkwy", trail: "trl", highway: "hwy",
};

const DIRECTIONAL_TO_ABBR: Record<string, string> = {
  north: "n", south: "s", east: "e", west: "w",
  northeast: "ne", northwest: "nw", southeast: "se", southwest: "sw",
};

export interface NormalizedAddress {
  /** Canonical "street number + street name" key, comparable across sources. */
  streetKey: string;
  zip: string | null;
}

export function normalizeAddress(raw: string): NormalizedAddress {
  let s = raw.toLowerCase();

  // Expand full state names before punctuation stripping (multi-word
  // states need the space intact to match).
  for (const [name, abbr] of Object.entries(STATE_NAME_TO_ABBR)) {
    s = s.replace(new RegExp(`\\b${name}\\b`, "g"), abbr);
  }

  // Pull a trailing zip (optionally zip+4) out, then drop it — city/
  // state/zip is never part of the street key. Anchored to the END of the
  // string specifically: a bare `\d{5}` match anywhere would also catch a
  // 5-digit leading street number ("24211 88th Pl W" has no zip at all,
  // but "24211" looks like one) and truncate the whole address.
  const zipMatch = s.match(/\b(\d{5})(-\d{4})?\s*$/);
  const zip = zipMatch ? zipMatch[1] : null;
  if (zipMatch?.index !== undefined) s = s.slice(0, zipMatch.index);

  // Drop a unit/suite marker and the token after it — unit formatting
  // varies too much ("Unit# C", "#203", "Apt 4") to match on reliably, and
  // listings.property_address has no separate unit field to compare against.
  s = s.replace(/,?\s*(unit#?|apt|apartment|suite|ste|#)\s*[\w-]*/gi, " ");

  // Whatever's left before the first remaining comma is the street; a
  // trailing city (uncommaed, e.g. "...Ave W Seattle") can't be
  // distinguished from a street word here, but listings never carry a
  // city suffix, so this mainly matters for stripping city off the event
  // side when it *was* comma-separated.
  const commaIdx = s.indexOf(",");
  if (commaIdx !== -1) s = s.slice(0, commaIdx);

  s = s.replace(/[^\w\s]/g, " ");

  const words = s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => STREET_SUFFIX_TO_ABBR[w] ?? DIRECTIONAL_TO_ABBR[w] ?? w);

  return { streetKey: words.join(" ").trim(), zip };
}

export interface ListingMatch {
  listingId: string;
  confidence: number;
}

// Token-overlap similarity, weighted so the leading street number matters
// most: two different streets rarely share a house number too, so a
// number mismatch short-circuits to zero. A confidence floor plus a
// required margin over the runner-up keeps ambiguous/close calls from
// silently picking the wrong listing — they fall through to needs_review.
function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const aWords = a.split(" ");
  const bWords = b.split(" ");
  if (aWords[0] !== bWords[0]) return 0;
  const bRest = new Set(bWords.slice(1));
  const shared = aWords.slice(1).filter((w) => bRest.has(w)).length;
  const total = Math.max(aWords.length - 1, bWords.length - 1, 1);
  return 0.5 + 0.5 * (shared / total);
}

const MIN_CONFIDENCE = 0.7;
const MIN_MARGIN = 0.05;

export function matchListingForAddress(
  normalized: NormalizedAddress,
  listings: { id: string; property_address: string }[]
): ListingMatch | null {
  const scored = listings
    .map((l) => ({ id: l.id, score: similarity(normalized.streetKey, normalizeAddress(l.property_address).streetKey) }))
    .filter((l) => l.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < MIN_CONFIDENCE) return null;

  const runnerUp = scored[1];
  if (runnerUp && runnerUp.score >= best.score - MIN_MARGIN) return null;

  return { listingId: best.id, confidence: best.score };
}
