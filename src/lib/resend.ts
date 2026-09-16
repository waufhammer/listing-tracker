// Thin wrapper around Resend for the flagged-agent approve/decline alert.
// Requires a Resend account + verified sending domain to actually deliver —
// that's an operational setup step outside what this code can do; without
// RESEND_API_KEY / SHOWING_ALERTS_FROM_EMAIL / SHOWING_ALERTS_TO_EMAIL set,
// callers get a clear error rather than a silent no-op.
import { Resend } from "resend";
import type { FlaggedAgentRow, ShowingEventRow } from "./showing-matching";

export async function sendFlaggedAgentAlert(params: {
  event: ShowingEventRow;
  agent: FlaggedAgentRow;
  logAsShowingUrl: string;
  notAShowingUrl: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SHOWING_ALERTS_FROM_EMAIL;
  const to = process.env.SHOWING_ALERTS_TO_EMAIL;
  if (!apiKey || !from || !to) {
    throw new Error(
      "RESEND_API_KEY, SHOWING_ALERTS_FROM_EMAIL, and SHOWING_ALERTS_TO_EMAIL must all be set to send flagged-agent alert emails."
    );
  }

  const { event, agent, logAsShowingUrl, notAShowingUrl } = params;
  const accessTime = event.access_time
    ? new Date(event.access_time).toLocaleString("en-US", {
        timeZone: "America/Los_Angeles",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "unknown time";

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to,
    subject: `Verify keybox access — ${event.raw_address}`,
    html: `
      <p>Keybox access was detected with no matching showing confirmation:</p>
      <ul>
        <li><strong>Listing:</strong> ${event.raw_address}</li>
        <li><strong>Agent:</strong> ${agent.name}</li>
        <li><strong>Time:</strong> ${accessTime}</li>
      </ul>
      <p>
        <a href="${logAsShowingUrl}">Log as showing</a>
        &nbsp;|&nbsp;
        <a href="${notAShowingUrl}">Not a showing</a>
      </p>
    `,
  });
  if (error) throw new Error(`Resend failed to send flagged-agent alert: ${error.message}`);
}
