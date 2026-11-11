// Server-only flyer measures for the /event page's og:image
// (docs/design/whatsapp-whole-flyer.CONTRACT.md D2, D4 b2).
//
// Two callers, both reading the flyer the CARD ROUTE will read
// (fetchEventCardData's coverUrl, the same resolver) and sizing it with the SAME
// function the renderer uses, so og:image:width/height can never disagree with
// the bytes:
//   - measureWholeFlyerCanvas: the live, not-yet-baked whole-flyer path, called
//     by resolveOgCardImageSized under its 2500 ms budget;
//   - resolveOgTallPreview: the TEST-ONLY ?ogtest=tall card (#1517), kept
//     answered exactly as before until its named removal slice.
//
// `.server.ts` on purpose: it pulls in sharp, and React Router refuses to put a
// .server module in the client bundle, so a leaked import fails the build
// loudly rather than shipping sharp to phones.
//
// Any failure returns null. Never baked.
import { fetchEventCardData, fetchImageBytes, tallCardSizeFor, wholeFlyerCanvasFor } from "./ogCardRender";
import { coverVersionToken } from "../detailLoader";
import { sameHostImage } from "../sameHostImage";
import { SITE_ORIGIN } from "@/lib/seo";
import type { CanvasSize } from "./ogLayout";

export interface OgTallPreview {
  url: string;
  width: number;
  height: number;
}

/** The D1 canvas of the flyer /api/og/card would render for this event (or
 *  occurrence), or null on any miss. Never snap.event.imageUrl. */
export async function measureWholeFlyerCanvas(eventId: string, occId: string | null): Promise<CanvasSize | null> {
  try {
    const card = await fetchEventCardData(eventId, occId);
    if (!card?.coverUrl) return null;
    const bytes = await fetchImageBytes(card.coverUrl);
    if (!bytes) return null;
    return await wholeFlyerCanvasFor(bytes);
  } catch (err) {
    console.error("[og/wf] measure_failed", err);
    return null;
  }
}

export async function resolveOgTallPreview(opts: {
  eventId: string;
  occId: string | null;
  /** The page's cover (snap.event.imageUrl) -- the same `v=` token the normal
   *  live card URL carries. No cover, no tall card (mirrors resolveOgCardImage). */
  coverUrl: string | null | undefined;
  request: Request;
}): Promise<OgTallPreview | null> {
  try {
    const token = coverVersionToken(opts.coverUrl);
    if (!token) return null;
    const card = await fetchEventCardData(opts.eventId, opts.occId);
    if (!card?.coverUrl) return null;
    const bytes = await fetchImageBytes(card.coverUrl);
    if (!bytes) return null;
    const { width, height } = await tallCardSizeFor(bytes);
    const params = new URLSearchParams({ kind: "event", id: opts.eventId });
    if (opts.occId) params.set("occ", opts.occId);
    params.set("v", token);
    params.set("layout", "tall");
    const live = `${SITE_ORIGIN.replace(/\/$/, "")}/api/og/card?${params.toString()}`;
    return { url: sameHostImage(live, new URL(opts.request.url).origin), width, height };
  } catch (err) {
    console.error("[og/tall] preview_failed", err);
    return null;
  }
}
