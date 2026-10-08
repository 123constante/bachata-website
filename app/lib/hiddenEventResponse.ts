// The ONE response for an event URL the public resolver hides, shared by
// /event/:id and /festival/:id. A taken-down (archived) series answers 410 Gone
// so search engines drop it promptly; draft / pending_review / a paused series
// with no past date / an unknown slug stay 404. Both noindex, and both no-store
// (finalizeDocumentCacheHeaders strips edge caching from every >= 400), so a
// restore serves 200 on the next request. The status itself is
// eventPageSeoPolicy's call (hiddenEventStatus).
//
// The lifecycle needs the service-role read (anon cannot see the series). A
// failed lookup is a 404: never a 410 on a guess, and never a 500 for a page
// that is not public either way.
import { hiddenEventStatus } from "@/lib/seo/eventPageSeoPolicy";
import { hiddenEventLifecycle } from "./hiddenEventLookup";

export async function hiddenEventResponse(param: string, noun = "Event"): Promise<Response> {
  let lifecycle: string | null = null;
  try {
    lifecycle = await hiddenEventLifecycle(param);
  } catch (err) {
    console.warn("[hidden-event] lifecycle lookup failed", err instanceof Error ? err.message : String(err));
  }
  const status = hiddenEventStatus(lifecycle);
  return new Response(status === 410 ? `${noun} removed` : `${noun} not found`, {
    status,
    headers: { "X-Robots-Tag": "noindex" },
  });
}
