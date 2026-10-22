"use client";

import { useEffect, useRef } from "react";

// Bookmarklet run on a Zillow/Redfin/Compass page. It reads the first
// "1,168 views" style count from the page text and opens /admin/capture in a
// popup with the page details in the hash. Saving happens in the popup, on
// this site, so it uses the normal admin login — no key in the button.
function bookmarkletFor(origin: string) {
  const script = `(function(){
var m=(document.body.innerText||"").match(/([\\d,]+)\\s+views?\\b/i);
var d={u:location.href,t:document.title,v:m?m[1].replace(/,/g,""):""};
window.open(${JSON.stringify(origin)}+"/admin/capture#"+encodeURIComponent(JSON.stringify(d)),"listing_tracker_capture","width=440,height=640");
})();`;
  return "javascript:" + encodeURIComponent(script.replace(/\n/g, ""));
}

export default function CaptureButtonPage() {
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    // React refuses javascript: URLs in href, so set it on the element directly
    linkRef.current?.setAttribute("href", bookmarkletFor(window.location.origin));
  }, []);

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-semibold text-gray-900 mb-2">
        Capture Button
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        A button for your browser&apos;s bookmarks bar that saves a listing&apos;s
        view count from Zillow, Redfin or Compass straight into Platform Views.
        Each person installs it once on their own computer.
      </p>

      <div className="mb-8 bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Install</h3>
        <ol className="list-decimal list-inside space-y-3 text-sm text-gray-700">
          <li>
            Show your bookmarks bar if it&apos;s hidden: <strong>Cmd+Shift+B</strong> in
            Chrome, Edge or Safari.
          </li>
          <li>
            Drag this button up onto the bookmarks bar:
            <div className="mt-3 mb-1">
              <a
                ref={linkRef}
                onClick={(e) => {
                  e.preventDefault();
                  alert("Drag this button to your bookmarks bar instead of clicking it.");
                }}
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 cursor-move transition-colors"
              >
                Save views
              </a>
            </div>
          </li>
        </ol>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Use</h3>
        <ol className="list-decimal list-inside space-y-3 text-sm text-gray-700">
          <li>
            Open the listing on Zillow or Redfin, or its Compass Insights page.
          </li>
          <li>
            Click <strong>Save views</strong> in your bookmarks bar. A small window
            opens with the listing, site and view count filled in.
          </li>
          <li>
            Check the number against the page, fix it if needed, and click
            <strong> Save</strong>.
          </li>
        </ol>
        <p className="text-sm text-gray-500 mt-4">
          You need to be logged in to this admin in the same browser. If the
          window shows the login page, log in, close it, and click the button
          again. Entries are logged under the &ldquo;Logging as&rdquo; name.
        </p>
      </div>
    </div>
  );
}
