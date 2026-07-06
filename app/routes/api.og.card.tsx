// /api/og/card — RESOURCE ROUTE (loader only, no component). Live Open Graph
// preview image for social shares: a normalized 1200x630 JPEG so every shared
// link gets a preview that WhatsApp/Facebook/LinkedIn will actually render
// (they refuse WebP and large files). In steady state middleware.ts serves
// the pre-baked R2 URL (via api/og/bake); this endpoint is the always-current
// fallback for not-yet-baked entities — occurrence-aware (`occ`) and
// cover-versioned (`v`).
//
// Delivered as a framework resource route, NOT a /api/*.ts function: under the
// react-router preset + Build Output API, Vercel does not route the top-level
// /api functions (they fall through to the SSR handler — see
// app/routes/api.revalidate.tsx for the full diagnosis). This was previously
// api/og/card.ts, silently broken in prod (confirmed returning the SPA's HTML
// shell instead of an image).
//
// Query params: kind=event|festival|image, id, occ, v (cache-buster), src (kind=image)
import { createHash } from "node:crypto";
import { supabase } from "@/integrations/supabase/client";
import {
  buildFallbackCard,
  buildImageCard,
  fetchImageBytes,
  firstString,
  formatOgDate,
  type OgCardData,
} from "../lib/ogCardRender";
import type { Route } from "./+types/api.og.card";

const SITE_URL = "https://www.bachatacalendar.co.uk";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveEventId(param: string): Promise<string | null> {
  if (UUID_RE.test(param)) return param;
  const { data, error } = await supabase.from("events").select("id").eq("slug", param).maybeSingle();
  if (error || !data) return null;
  return typeof data.id === "string" ? data.id : null;
}

async function fetchEventData(id: string, occ: string | null): Promise<OgCardData | null> {
  const target: Record<string, string> = { series_id: id };
  if (occ) target.occurrence_id = occ;
  const { data, error } = await supabase.rpc("event_view_p5" as never, {
    p_target: target,
    p_viewer: { role: "anon", shape: "snapshot_compat" },
  } as never);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snap: any = data;
  if (error || !snap || !snap.event) return null;
  const venue = snap.location_default?.venue;
  return {
    title: snap.event.name ?? "Bachata Event",
    dateLine: formatOgDate(snap.occurrence_effective?.starts_at ?? snap.event.date ?? null),
    venueLine: venue?.name ? `at ${venue.name}` : null,
    coverUrl: firstString(snap.event.cover_image_url) ?? firstString(venue?.image_url),
  };
}

async function fetchFestivalData(id: string): Promise<OgCardData | null> {
  const { data, error } = await supabase.rpc("get_public_festival_detail", { p_event_id: id });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fest: any = data;
  if (error || !fest || !fest.identity) return null;
  const venue = fest.location?.primaryVenue;
  return {
    title: fest.identity.name ?? "Bachata Festival",
    dateLine: formatOgDate(fest.dates?.startsAt ?? null),
    venueLine: venue?.name ? `at ${venue.name}` : null,
    coverUrl: firstString(fest.identity.posterUrl) ?? firstString(venue?.imageUrl),
  };
}

function makeEtag(kind: string, idParam: string, src: string, occ = "", v = ""): string {
  const h = createHash("sha1").update(`${kind}:${idParam}:${src}:${occ}:${v}`).digest("base64url").slice(0, 24);
  return `"${h}"`;
}

function imageResponse(buf: Buffer, etag: string): Response {
  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(buf.length),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800",
      ETag: etag,
    },
  });
}

function redirectToStatic(): Response {
  return new Response(null, {
    status: 302,
    headers: {
      "Cache-Control": "public, max-age=300",
      Location: `${SITE_URL}/og-image.jpg`,
    },
  });
}

export async function loader({ request }: Route.LoaderArgs): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams;
  const kind = q.get("kind") ?? "event";
  const idParam = q.get("id") ?? "";
  const src = q.get("src") ?? "";
  const occ = q.get("occ") ?? "";
  const v = q.get("v") ?? "";

  const etag = makeEtag(kind, idParam, src, occ, v);
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304 });
  }

  try {
    if (kind === "image") {
      if (!src) return redirectToStatic();
      const bytes = await fetchImageBytes(src);
      if (!bytes) return redirectToStatic();
      return imageResponse(await buildImageCard(bytes), etag);
    }
    if (!idParam) return redirectToStatic();
    const id = await resolveEventId(idParam);
    if (!id) return redirectToStatic();
    const cardData = kind === "festival" ? await fetchFestivalData(id) : await fetchEventData(id, occ || null);
    if (!cardData) return imageResponse(await buildFallbackCard(null, null, null), etag);
    // Hybrid: a flyer becomes the preview itself (no text/fonts); the branded
    // card is only the fallback for entities with no flyer.
    const coverBytes = cardData.coverUrl ? await fetchImageBytes(cardData.coverUrl) : null;
    if (!coverBytes) return imageResponse(await buildFallbackCard(cardData.title, cardData.dateLine, cardData.venueLine), etag);
    return imageResponse(await buildImageCard(coverBytes), etag);
  } catch (err) {
    console.error("[og/card] render_failed", err);
    return redirectToStatic();
  }
}
