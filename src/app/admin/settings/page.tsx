"use client";

import { useEffect, useState } from "react";
import { getSetting, setSetting } from "@/lib/actions";

const SIGNATURE_KEY = "email_signature_html";

export default function SettingsPage() {
  const [signature, setSignature] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    getSetting(SIGNATURE_KEY).then(({ value, error }) => {
      if (error) setStatus(error);
      setSignature(value ?? "");
    });
  }, []);

  async function save() {
    setStatus("Saving...");
    const { error } = await setSetting(SIGNATURE_KEY, signature);
    setStatus(error ? `Error: ${error}` : "Saved");
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Gmail signature</h2>
        <p className="text-xs text-gray-500 mb-3">
          Added below &quot;Cheers, Will + Kelly&quot; in every weekly seller email. HTML, copied from a sent email.
        </p>
        <textarea
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          rows={8}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
        />
        <div className="flex items-center gap-3 mt-3">
          <button onClick={save} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
            Save
          </button>
          <span className="text-xs text-gray-500">{status}</span>
        </div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mt-5 mb-2">Preview</p>
        <div className="rounded-lg border border-gray-100 p-3" dangerouslySetInnerHTML={{ __html: signature }} />
      </section>
    </div>
  );
}
