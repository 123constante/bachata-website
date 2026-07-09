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
// POST body: { entityType|entity_type, entityId|entity_id, tags? }
//   - entityType + entityId (a UUID) → the tags are derived (mirrors the routes).
//   - tags: string[] — explicit tags, overrides the derived list (bulk/manual).
import { invalidateByTag } from "@vercel/functions";
import { isEntityType, purgeTagsFor } from "../cacheTags";
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
    tags = purgeTagsFor(entityType, entityId);
  }
  if (!tags.length) return json({ ok: false, reason: "no tags to invalidate" }, 400);
  tags = tags.slice(0, 128); // Vercel allows up to 128 tags per cached response.

  try {
    // Soft invalidate: serve stale instantly, revalidate in the background. No
    // token — runs with the deployment's ambient identity, current environment.
    await invalidateByTag(tags);
    return json({ ok: true, tags }, 200);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[revalidate] invalidateByTag failed", msg);
    // 502 → the DB webhook can safely retry (invalidation is idempotent).
    return json({ ok: false, reason: msg, tags }, 502);
  }
}
