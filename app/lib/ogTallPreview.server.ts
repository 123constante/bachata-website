// TEST-ONLY og:image for /event/<id>?ogtest=tall (docs/briefs/og-tall-card-test.md).
//
// Answers one question: does WhatsApp draw a TALLER link card when og:image is
// not 1200x630? The page points og:image at the live /api/og/card?...&layout=tall
// and must declare the size the card will actually be, which depends on the
// flyer's own ratio -- so this reads the flyer the card endpoint will read
// (fetchEventCardData's coverUrl, same resolver) and sizes it with the SAME
// function the renderer uses (tallCardSizeFor).
//
// `.server.ts` on purpose: it pulls in sharp, and React Router refuses to put a
// .server module in the client bundle, so a leaked import fails the build
// loudly rather than shipping sharp to phones.
//
// Any failure returns null and the page keeps its normal og:image. Never baked.
import { fetchEventCardData, fetchImageBytes, tallCardSizeFor } from "./ogCardRender";
import { coverVersionToken } from "../detailLoader";
import { sameHostImage } from "../sameHostImage";
import { SITE_ORIGIN } from "@/lib/seo";

export interface OgTallPreview {
  url: string;
  width: number;
  height: number;
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
