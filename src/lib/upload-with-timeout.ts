import { uploadPropertyPhoto } from "@/lib/actions";

const CLIENT_TIMEOUT_MS = 25_000;

/**
 * Wraps the uploadPropertyPhoto server action in a client-side timeout.
 * Server Actions stream their response; if that stream ever stalls (dropped
 * connection, serverless cold-start hiccup, etc.) the awaiting fetch can hang
 * indefinitely with no error surfaced. Racing it here guarantees the caller's
 * UI always gets an answer.
 */
export async function uploadPhotoWithTimeout(
  file: File,
  slug: string
): Promise<{ url: string | null; error: string | null }> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("slug", slug);

  return Promise.race([
    uploadPropertyPhoto(fd),
    new Promise<{ url: null; error: string }>((resolve) =>
      setTimeout(
        () =>
          resolve({
            url: null,
            error: "Upload is taking longer than expected. Check your connection and try again.",
          }),
        CLIENT_TIMEOUT_MS
      )
    ),
  ]);
}
