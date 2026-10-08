// /api/revalidate — RESOURCE ROUTE (no default export). Purges a detail page's
// Vercel edge cache by tag on content change. Invoked by the Supabase DB webhook
// (the apply_aggregate_write_p5 hook + the standalone save RPCs) with the entity
// that changed; maps it to the same Vercel-Cache-Tag the route stamped (see
// ../detailLoader + ../routes/*), then soft-invalidates via invalidateByTag
// (serve-stale-then-revalidate-in-background, no stampede).
//
// Delivered as a framework resource route, NOT a /api/*.ts serverless function:
// under the react-router preset + Build Output API, Vercel does not route the
// top-level /api functions (they fall through to the SSR handler). The RR SSR
// function IS deployed, so an action here is the reliable endpoint.
//
// Purge uses @vercel/functions `invalidateByTag`, which runs with the function's
// AMBIENT Vercel identity — no API token needed — and invalidates the current
// environment's cache (preview→preview, prod→prod).
//
// Auth: Bearer REVALIDATE_SECRET (shared with the DB webhook via Supabase Vault).
// POST body: { entityType|entity_type, entityId|entity_id, citySlug?, tags? }
//   - entityType + entityId (a UUID) → the tags are derived (mirrors the routes).
//   - citySlug (optional): when the DB webhook resolved the write's city
//     (event_series_p5.default_city_id / occurrence override), scope an
//     event/festival purge to that city's tag instead of the site-wide
//     HOME_FEED/SEO_LANDING tags — see purgeTagsFor in ../cacheTags.
//   - tags: string[] — explicit tags, overrides the derived list (bulk/manual).
//   - slug (optional): the entity's canonical slug, when the sender knows it.
//     Used only by the Cloudflare purge below (a hidden/archived event no
//     longer resolves to its slug through the public resolver).
//
// Hidden events (2026-10-08 takedown re-walk): when an event/festival write
// leaves the series off the public page gate (archived, draft, pending_review:
// resolve_public_event_ref_v1 returns null), the soft invalidate is WRONG -- it
// hands the next visitor the stale page, title and all, while the background
// re-render 404s (the 404 is no-store; nothing says it evicts the stale copy).
// Those writes hard-delete the tags instead (dangerouslyDeleteByTag), so the
// next request renders the 404. A failed visibility lookup takes the same
// branch: a cold render is the cheap side of not knowing.
//
// Cloudflare: after the Vercel purge succeeds, the same tags are purged from
// Cloudflare's HTML cache by URL (../cloudflarePurge), in waitUntil so the
// response never waits on it. Best-effort; a logged no-op without
// CLOUDFLARE_API_TOKEN / CLOUDFLARE_ZONE_ID. See docs/ops/cloudflare-purge.md.
import { dangerouslyDeleteByTag, invalidateByTag, waitUntil } from "@vercel/functions";
import { resolvePublicEventRef } from "@/lib/seo/resolvePublicEventRef";
import { isEntityType, purgeTagsFor } from "../cacheTags";
import { cloudflareEnvFromProcess, cloudflareSkipReason, runCloudflarePurge } from "../cloudflarePurge";
import type { Route } from "./+types/api.revalidate";

const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET ?? "";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// entityType → cache tags to invalidate. The mapping lives in ../cacheTags
// (purgeTagsFor) alongside the STAMP helpers the routes use, so the two sides
// can't drift — cacheTags.test.ts asserts every purge tag has a stamping route.
function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

// True when the event no longer has a public page (or we cannot tell).
async function eventPageHidden(entityId: string): Promise<boolean> {
  try {
    return (await resolvePublicEventRef(entityId, "throw")) === null;
  } catch (err) {
    console.warn("[revalidate] visibility lookup failed; hard-deleting", err instanceof Error ? err.message : String(err));
    return true;
  }
}

// Fire-and-forget: hands the Cloudflare purge to waitUntil and returns at once.
// Nothing here may throw into the action -- the Vercel result is the response.
function scheduleCloudflarePurge(tags: string[], slugHints: Record<string, string>): void {
  try {
    const env = cloudflareEnvFromProcess();
    const skip = cloudflareSkipReason(env);
    if (skip) {
      console.warn(`[cf-purge] skipped: ${skip}`);
      return;
    }
    const task = runCloudflarePurge(tags, {
      env,
      fetch: (input, init) => fetch(input, init),
      getResolver: async () =>
        (await import("../lib/cloudflarePurgeResolver")).supabaseCloudflareResolver,
      slugHints,
    }).catch((err) => console.error("[cf-purge] failed", err instanceof Error ? err.message : String(err)));
    waitUntil(task);
  } catch (err) {
    console.error("[cf-purge] could not schedule", err instanceof Error ? err.message : String(err));
  }
}

export async function action({ request }: Route.ActionArgs): Promise<Response> {
  if (request.method !== "POST") return json({ ok: false, reason: "POST required" }, 405);
  if (!REVALIDATE_SECRET || request.headers.get("authorization") !== `Bearer ${REVALIDATE_SECRET}`) {
    return json({ ok: false, reason: "unauthorized" }, 401);
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const entityType = (body.entityType ?? body.entity_type) as string | undefined;
  const entityId = (body.entityId ?? body.entity_id) as string | undefined;
  const citySlug = (body.citySlug ?? body.city_slug) as string | undefined;
  const slugHint = typeof body.slug === "string" ? body.slug : undefined;
  const explicitTags = Array.isArray(body.tags)
    ? (body.tags as unknown[]).filter((t): t is string => typeof t === "string" && t.length > 0)
    : null;

  // Explicit tags win; otherwise derive from entityType + entityId.
  let tags: string[];
  if (explicitTags && explicitTags.length) {
    tags = explicitTags;
  } else {
    if (!entityType || !isEntityType(entityType)) {
      return json({ ok: false, reason: "invalid or missing entityType" }, 400);
    }
    if (!entityId || !UUID_RE.test(entityId)) {
      return json({ ok: false, reason: "invalid or missing entityId (expected UUID)" }, 400);
    }
    tags = purgeTagsFor(entityType, entityId, citySlug);
  }
  if (!tags.length) return json({ ok: false, reason: "no tags to invalidate" }, 400);
  tags = tags.slice(0, 128); // Vercel allows up to 128 tags per cached response.

  const hidden =
    !explicitTags?.length &&
    (entityType === "event" || entityType === "festival") &&
    !!entityId &&
    (await eventPageHidden(entityId));

  try {
    // Soft invalidate: serve stale instantly, revalidate in the background. No
    // token — runs with the deployment's ambient identity, current environment.
    // A hidden event is hard-deleted instead (see the header).
    if (hidden) await dangerouslyDeleteByTag(tags);
    else await invalidateByTag(tags);
    scheduleCloudflarePurge(
      tags,
      slugHint && entityId && UUID_RE.test(entityId) ? { [entityId]: slugHint } : {},
    );
    return json({ ok: true, tags }, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[revalidate] invalidateByTag failed", msg);
    // 502 → the DB webhook can safely retry (invalidation is idempotent).
    return json({ ok: false, reason: msg, tags }, 502);
  }
}
