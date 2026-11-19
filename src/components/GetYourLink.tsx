"use client";

import { FormEvent, useState } from "react";

// Shown on a client page without access, and on /link-expired. The reply is
// the same whether or not the email is on file, so it can't be used to find
// out who the sellers are.

export default function GetYourLink({
  slug,
  contactEmail,
  contactPhone,
  expired = false,
}: {
  slug?: string;
  contactEmail: string;
  contactPhone: string | null;
  expired?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/client-link/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, email: email.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      setMessage(body.message ?? "Something went wrong. Please call or email Will.");
    } catch {
      setMessage("Something went wrong. Please call or email Will.");
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Aufhammer Homes" className="h-20 mb-8" />
      <h1 className="text-xl font-semibold text-gray-900 mb-2">
        {expired ? "This link is no longer active" : "Get your link"}
      </h1>
      <p className="text-sm text-gray-500 max-w-sm mb-6">
        Listing pages are private. Enter the email address we have on file for you and we&apos;ll send
        your personal link.
      </p>
      {message ? (
        <p className="text-sm text-gray-900 max-w-sm mb-6" role="status">{message}</p>
      ) : (
        <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-3 mb-6">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-900 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {busy ? "Sending…" : "Email me my link"}
          </button>
        </form>
      )}
      <p className="text-xs text-gray-400">
        Questions? Contact Will Aufhammer
        {contactPhone && (
          <>
            {" "}at <a href={`tel:${contactPhone.replace(/[^0-9+]/g, "")}`} className="underline">{contactPhone}</a>
          </>
        )}{" "}
        {contactPhone ? "or" : "at"} <a href={`mailto:${contactEmail}`} className="underline">{contactEmail}</a>.
      </p>
    </div>
  );
}
