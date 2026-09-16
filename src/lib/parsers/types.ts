export interface ParsedShowingConfirmed {
  ok: true;
  eventType: "showing_confirmed";
  rawAddress: string;
  agentName: string | null;
  agentBrokerage: string | null;
  agentPhone: string | null;
  agentEmail: string | null;
  scheduledTime: Date;
}

export interface ParsedKeyboxAccess {
  ok: true;
  eventType: "keybox_access";
  rawAddress: string;
  agentName: string | null;
  agentPhone: string | null;
  agentEmail: string | null;
  accessTime: Date;
  keyboxId: string | null;
}

// Recognized, but deliberately produces no showing_events row — e.g. a
// Supra "End of Showing Notification," which carries no info the v1
// matching logic needs beyond what the "New Showing Notification" already
// gave it as a `keybox_access` event.
export interface ParsedIgnorable {
  ok: true;
  eventType: "ignorable";
  reason: string;
}

export interface ParseFailure {
  ok: false;
  reason: string;
}

export type ParseResult = ParsedShowingConfirmed | ParsedKeyboxAccess | ParsedIgnorable | ParseFailure;
