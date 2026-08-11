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
  buildImageCard,
  fetchEventCardData,
  fetchFestivalCardData,
  fetchImageBytes,
  resolveOgEventId,
} from "../lib/ogCardRender";
import { decideBakePersist } from "../lib/ogBakePolicy";
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
    const coverUrl = cardData?.coverUrl ?? null;
    const coverBytes = coverUrl ? await fetchImageBytes(coverUrl) : null;

    // Finding 1f. A bake either produces THIS ENTITY'S card or it produces
    // nothing -- see app/lib/ogBakePolicy.ts for why persisting the branded
    // fallback was a permanent, unobservable poisoning rather than a graceful
    // degrade. Everything below this line runs only on the persist path.
    const decision = decideBakePersist({
      hasCardData: Boolean(cardData),
      hasCoverUrl: Boolean(coverUrl),
      // .length, not truthiness. fetchImageBytes returns Buffer.from(ab) for
      // ANY 200, and a zero-byte Buffer is a truthy object -- so a CDN
      // answering 200 Content-Length: 0 for a deleted cover would persist,
      // throw inside sharp, and surface as a 500 naming the renderer for what
      // is a storage problem.
      hasCoverBytes: (coverBytes?.length ?? 0) > 0,
    });
    if (!decision.persist) {
      // The real cover URL, not null: status 'error' already stops
      // get_og_image_v1 serving the row, so the token costs nothing to keep
      // and an operator reading og_render can see WHICH url would not fetch.
      //
      // Three properties of set_og_image_v1 this depends on, stated because
      // two of them cut the other way and an earlier draft of this comment
      // claimed the write was non-destructive across the board:
      //   image_url is COALESCE(EXCLUDED, existing), so a previously-baked
      //     object URL SURVIVES. Harmless only while the read path filters on
      //     status = 'ready' -- that filter is load-bearing, not an optimisation.
      //   cover_source_url and cover_hash are assigned UNCONDITIONALLY, so the
      //     two reasons that carry a null coverUrl (card-data-unavailable,
      //     cover-absent) erase the row's record of which cover was baked. It
      //     re-heals on the next successful bake, which rewrites both.
      //   attempts increments on every 'error' and _og_enqueue does NOT reset
      //     it, so an entity that refuses 5 times exhausts _og_sweep's budget
      //     permanently: a later cover upload gets ONE net.http_post and no
      //     retry if it is lost. Measured 2026-08-11 at 1 flyer-less event of
      //     67 active, and the consequence is a LIVE-rendered correct card
      //     rather than a broken one, so it is queued (residual 1f-b: reset
      //     attempts in _og_enqueue, an admin migration) not patched here.
      await recordResult(entityType, entityId, occurrenceId, coverUrl, null, "error", decision.reason);
      console.warn("[og/bake] refused to persist a degraded card", entityType, entityId, decision.reason);
      // 422, not 500: the request was well-formed and the pipeline is healthy
      // -- this entity is not bakeable right now. Distinguishable in a Vercel
      // log from the catch below, which is a genuine fault. The DB sweep fires
      // and forgets, so this status is read by humans and backfill runs only.
      // BOTH keys. Every other non-2xx on this route (401, 400, 500) answers
      // { ok, reason }, so a log pipeline reading body.reason would print
      // undefined for what is now the most common non-2xx the route emits.
      // `refused` is the addition that lets a caller tell a refusal from a
      // fault without parsing the message; `reason` keeps the existing shape.
      return json({ ok: false, refused: decision.reason, reason: decision.reason }, 422);
    }

    // Non-null by the decision above; the casts state that rather than re-test.
    const jpeg = await buildImageCard(coverBytes as Buffer);

    // No "fallback" tag any more, and its absence is load-bearing: the object
    // key is now, by construction, always <id>-<occ|default>-<16 hex of the
    // cover URL>. check-og-images.mjs asserts exactly that shape on the live
    // og:image. Measured against all 253 live og_render rows on 2026-08-11:
    // 248 match, and the 5 that do not are the 5 persisted fallback cards.
    //
    // HOW FAR that external check reaches, and it is much less far than a
    // first draft of this comment claimed. Round-2 review measured it:
    //   The OLD code used the "fallback" tag ONLY when the cover URL was
    //   absent. A cover that existed but would not FETCH -- the 5s timeout
    //   that is the headline scenario in ogBakePolicy.ts -- baked the branded
    //   card under a perfectly well-formed cover-keyed name, which the key
    //   rule passes.
    //   And a "-fallback.jpg" object can never be a page's og:image anyway:
    //   set_og_image_v1 stores cover_hash = _og_cover_token(NULL) = NULL for
    //   those rows, and get_og_image_v1 only matches when the page's non-null
    //   cover token IS NOT DISTINCT FROM cover_hash. Verified live on
    //   2026-08-11: the one flyer-less active event serves /og-image.jpg, not
    //   a baked object.
    // So the key rule has NO reachable true positive against today's data. It
    // is a NAMING-INVARIANT tripwire -- it reds if this line ever writes a key
    // shape the guard does not recognise -- and it is not, and must not be
    // read as, a detector for the 1f poison. The refusal below is the whole of
    // that defence.
    const coverTag = createHash("sha1").update(coverUrl as string).digest("hex").slice(0, 16);
    const occTag = occurrenceId ?? "default";
    const path = `og/${entityType}/${id}-${occTag}-${coverTag}.jpg`;

    const publicUrl = await uploadJpeg(path, jpeg);
    if (!publicUrl) throw new Error("R2 upload failed");

    await recordResult(entityType, entityId, occurrenceId, coverUrl, publicUrl, "ready", null);
    return json({ ok: true, image_url: publicUrl }, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await recordResult(entityType, entityId, occurrenceId, null, null, "error", msg);
    console.error("[og/bake] failed", msg);
    return json({ ok: false, reason: msg }, 500);
  }
}
