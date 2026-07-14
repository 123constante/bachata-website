// /api/og/bake — RESOURCE ROUTE (action only, no component). Renders an
// event/festival OG card ONCE and stores it in R2 as an immutable URL, then
// records it via set_og_image_v1. Invoked by a DB trigger when a cover
// changes (+ the pg_cron retry sweep + the backfill script). middleware.ts
// then serves the stored R2 URL instead of rendering live.
//
// Delivered as a framework resource route, NOT a /api/*.ts function — see
// app/routes/api.revalidate.tsx for the full diagnosis of why. This was
// previously api/og/bake.ts, silently broken in prod (every invocation fell
// through to the SSR handler instead of running, so no new OG image has been
// baked to R2 since this broke — every event/festival with a cover changed
// since then has been serving whatever /api/og/card's live fallback returns,
// which was ALSO broken, to social link-preview crawlers).
//
// Auth: Bearer OG_BAKE_SECRET (shared with the DB trigger via Vault).
// POST body: { entity_type: 'event'|'festival', entity_id: uuid, occurrence_id?: uuid|null }
import { createHash } from "node:crypto";
import {
  buildFallbackCard,
  buildImageCard,
  fetchEventCardData,
  fetchFestivalCardData,
  fetchImageBytes,
  resolveOgEventId,
  type OgCardData,
} from "../lib/ogCardRender";
import type { Route } from "./+types/api.og.bake";

const SUPABASE_URL = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY ?? "";
const BAKE_SECRET = process.env.OG_BAKE_SECRET ?? "";

type EntityType = "event" | "festival";

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

// Presign a PUT (storage-sign-upload edge fn) then upload the bytes — the
// path the Website uses for cover uploads (src/lib/uploadToR2.ts).
async function uploadJpeg(path: string, bytes: Buffer): Promise<string | null> {
  const sign = await fetch(`${SUPABASE_URL}/functions/v1/storage-sign-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify({ bucket: "events", path, contentType: "image/jpeg" }),
  });
  if (!sign.ok) return null;
  const signed = (await sign.json()) as { ok?: boolean; uploadUrl?: string; publicUrl?: string };
  if (!signed?.ok || !signed.uploadUrl || !signed.publicUrl) return null;
  const put = await fetch(signed.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: bytes });
  return put.ok ? signed.publicUrl : null;
}

async function recordResult(
  entityType: EntityType, entityId: string, occurrenceId: string | null,
  coverSourceUrl: string | null, imageUrl: string | null, status: "ready" | "error", error: string | null,
): Promise<void> {
  if (!SUPABASE_SERVICE_KEY) return;
  await fetch(`${SUPABASE_URL}/rest/v1/rpc/set_og_image_v1`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
    body: JSON.stringify({
      p_entity_type: entityType, p_entity_id: entityId, p_occurrence_id: occurrenceId,
      p_cover_source_url: coverSourceUrl, p_image_url: imageUrl, p_status: status, p_error: error,
    }),
  }).catch(() => { /* best-effort */ });
}

export async function action({ request }: Route.ActionArgs): Promise<Response> {
  if (request.method !== "POST") return json({ ok: false, reason: "POST required" }, 405);
  if (!BAKE_SECRET || request.headers.get("authorization") !== `Bearer ${BAKE_SECRET}`) {
    return json({ ok: false, reason: "unauthorized" }, 401);
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  const entityType: EntityType = body.entity_type === "festival" ? "festival" : "event";
  const rawId = typeof body.entity_id === "string" ? body.entity_id : "";
  const occurrenceId = typeof body.occurrence_id === "string" && body.occurrence_id ? body.occurrence_id : null;
  if (!rawId) return json({ ok: false, reason: "entity_id required" }, 400);

  let entityId = rawId;
  try {
    const id = await resolveOgEventId(rawId);
    if (!id) throw new Error("could not resolve entity id");
    entityId = id;

    const cardData = entityType === "festival" ? await fetchFestivalCardData(id) : await fetchEventCardData(id, occurrenceId);
    if (!cardData) throw new Error("no card data");

    const coverBytes = cardData.coverUrl ? await fetchImageBytes(cardData.coverUrl) : null;
    const jpeg = coverBytes ? await buildImageCard(coverBytes) : await buildFallbackCard(cardData.title, cardData.dateLine, cardData.venueLine);

    const coverTag = cardData.coverUrl ? createHash("sha1").update(cardData.coverUrl).digest("hex").slice(0, 16) : "fallback";
    const occTag = occurrenceId ?? "default";
    const path = `og/${entityType}/${id}-${occTag}-${coverTag}.jpg`;

    const publicUrl = await uploadJpeg(path, jpeg);
    if (!publicUrl) throw new Error("R2 upload failed");

    await recordResult(entityType, entityId, occurrenceId, cardData.coverUrl, publicUrl, "ready", null);
    return json({ ok: true, image_url: publicUrl }, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await recordResult(entityType, entityId, occurrenceId, null, null, "error", msg);
    console.error("[og/bake] failed", msg);
    return json({ ok: false, reason: msg }, 500);
  }
}
