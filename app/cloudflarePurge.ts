// Cloudflare HTML purge for content writes -- the second half of /api/revalidate.
//
// WHY. Cloudflare sits in front of Vercel and caches HTML for ~300s (the
// "HTML for humans" cache rule, edge TTL override). invalidateByTag reaches
// Vercel's CDN only, so after a cancellation Cloudflare kept serving the old
// page for up to ~5 minutes (docs/ops/vercel-html-caching-2026-10-08.md). This
// module turns the SAME cache tags the Vercel purge uses into the public URLs
// those tags stand for, and purges them from Cloudflare by URL.
//
// HOW IT IS CALLED. app/routes/api.revalidate.tsx hands it the tag list AFTER
// invalidateByTag succeeded, inside waitUntil, so it never delays or fails the
// webhook's response. Everything here is best-effort: errors are logged and
// swallowed. Missing CLOUDFLARE_API_TOKEN / CLOUDFLARE_ZONE_ID is a logged
// no-op. Setup, testing and removal: docs/ops/cloudflare-purge.md.
//
// THE SOFT-INVALIDATE TRAP (why there are two purge passes). invalidateByTag is
// a SOFT invalidate: Vercel's next request for the page is answered with the
// STALE copy while it re-renders in the background. Purge Cloudflare once and
// its very next miss fetches that stale copy and caches it for another 300s,
// which would make the purge pointless. So: pass 1 purges, then we request the
// canonical pages once ("warm") to start Vercel's re-render, wait for it to
// settle, and pass 2 purges again. Visitors after pass 2 get the fresh render.
// Only the canonical pages are warmed (each warm is one SSR render on the
// Hobby CPU budget); the other URLs get both purges but no warm.
//
// Import-light on purpose (same reason as ./cacheTags): the Supabase lookups
// are injected (see app/lib/cloudflarePurgeResolver.ts) so this file and its
// tests never load the client.
import {
  eventTag,
  festivalTag,
  dancerTag,
  djTag,
  teacherTag,
  venueTag,
  organiserTag,
  cityTag,
  HOME_FEED,
  FESTIVALS_LIST,
  SEO_LANDING,
  SEO_LANDING_CITY_SLUG,
  EVENTS,
  FESTIVALS,
  DANCERS,
  DJS,
  TEACHERS,
  VENUES,
  ORGANISERS,
  STAMP_PLACEHOLDER_ID,
  STAMP_PLACEHOLDER_SLUG,
} from "./cacheTags";

// The production hostname Cloudflare caches. Apex redirects here; previews are
// not behind Cloudflare. Mirrors BASE_URL in app/routes/sitemap.tsx.
export const CF_SITE_HOST = "www.bachatacalendar.co.uk";
export const CF_SITE_ORIGIN = `https://${CF_SITE_HOST}`;
const CF_API = "https://api.cloudflare.com/client/v4";

// Cloudflare's docs (2026-10-08, "Purge cache: availability and limits") list
// 100 URLs per single-file purge request on Free; 30 was the long-standing Free
// limit. We send 30 so a plan-limit change in either direction cannot reject a
// request. Prefix purges share a 5 requests/minute (bucket 25) account limit,
// so all prefixes go in ONE request (max 100 per request).
export const CF_MAX_URLS_PER_CALL = 30;
export const CF_MAX_PREFIXES_PER_CALL = 100;
export const CF_DEFAULT_SETTLE_MS = 10_000;
const CF_TIMEOUT_MS = 10_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,199}$/i;
const ZONE_ID_RE = /^[0-9a-f]{32}$/i;

// Tables whose `slug` column names the canonical URL (the routes 301 uuid ->
// slug, see redirectUuidToSlug in ./detailLoader).
export type CfEntityTable = "events" | "dancer_profiles" | "venues";

export type CfUrlRule =
  // One page per entity: <basePath>/<slug> (canonical) and <basePath>/<uuid>.
  | { kind: "entity"; basePath: string; table: CfEntityTable }
  // /city/<slug> named by the tag itself.
  | { kind: "city" }
  // /city/<slug> for every active city (the tag names none).
  | { kind: "active-cities" }
  // A fixed page set. warm: re-render it between the passes (see header).
  | { kind: "static"; paths: readonly string[]; warm: boolean }
  // No URL is purged for this tag; reason says why. Reviewed, not forgotten.
  | { kind: "none"; reason: string };

const ID = STAMP_PLACEHOLDER_ID;
const SLUG = STAMP_PLACEHOLDER_SLUG;

// The pages that stamp SEO_LANDING (routes.ts). cloudflarePurge.test.ts
// re-derives this list from the route modules, so it cannot drift silently.
export const SEO_LANDING_PATHS = [
  "/london-bachata-guide",
  "/learn-bachata-london",
  "/bachata-london-monday",
  "/bachata-london-tuesday",
  "/bachata-london-wednesday",
  "/bachata-london-thursday",
  "/bachata-london-friday",
  "/bachata-london-saturday",
  "/bachata-london-sunday",
] as const;

const COLLECTION_REASON =
  "legacy collection tag (STAMP_ONLY in ./cacheTags): no page is listed under it and nothing purges it";

// Tag kind (placeholder form, as in ./cacheTags ALL_ROUTE_STAMPS) -> URLs.
// cloudflarePurge.test.ts requires an entry for every tag a route stamps or a
// write purges.
export const CF_URL_RULES: Record<string, CfUrlRule> = {
  [eventTag(ID)]: { kind: "entity", basePath: "/event", table: "events" },
  [festivalTag(ID)]: { kind: "entity", basePath: "/festival", table: "events" },
  [dancerTag(ID)]: { kind: "entity", basePath: "/dancers", table: "dancer_profiles" },
  [djTag(ID)]: { kind: "entity", basePath: "/djs", table: "dancer_profiles" },
  [teacherTag(ID)]: { kind: "entity", basePath: "/teachers", table: "dancer_profiles" },
  [venueTag(ID)]: { kind: "entity", basePath: "/venue-entity", table: "venues" },
  [cityTag(SLUG)]: { kind: "city" },
  [HOME_FEED]: { kind: "active-cities" },
  [FESTIVALS_LIST]: { kind: "static", paths: ["/festivals"], warm: true },
  // Not warmed: 9 extra SSR renders per London write is too much Hobby CPU for
  // pages that bound their own TTL anyway (see header).
  [SEO_LANDING]: { kind: "static", paths: SEO_LANDING_PATHS, warm: false },
  [organiserTag(ID)]: {
    kind: "none",
    reason:
      "no 'organiser' emit exists, so no write ever sends this tag; /organisers/:id ships s-maxage=0 (see ./cacheTags)",
  },
  [ORGANISERS]: { kind: "none", reason: COLLECTION_REASON },
  [EVENTS]: { kind: "none", reason: COLLECTION_REASON },
  [FESTIVALS]: { kind: "none", reason: COLLECTION_REASON },
  [DANCERS]: { kind: "none", reason: COLLECTION_REASON },
  [DJS]: { kind: "none", reason: COLLECTION_REASON },
  [TEACHERS]: { kind: "none", reason: COLLECTION_REASON },
  [VENUES]: { kind: "none", reason: COLLECTION_REASON },
};

/** Map a concrete tag (`event-<uuid>`, `city-london-gb`, `home-feed`) to its
 *  rule key and parameter. null = no rule (an unknown/explicit tag). */
export function tagKindOf(tag: string): { kind: string; param: string | null } | null {
  if (Object.prototype.hasOwnProperty.call(CF_URL_RULES, tag)) return { kind: tag, param: null };
  for (const kind of Object.keys(CF_URL_RULES)) {
    const ph = kind.endsWith(`-${ID}`) ? ID : kind.endsWith(`-${SLUG}`) ? SLUG : null;
    if (!ph) continue;
    const prefix = kind.slice(0, -ph.length);
    if (tag.startsWith(prefix) && tag.length > prefix.length) {
      return { kind, param: tag.slice(prefix.length) };
    }
  }
  return null;
}

export interface CfPurgeResolver {
  /** The entity's canonical slug, or null (none, hidden, or not found). */
  slugFor(table: CfEntityTable, id: string): Promise<string | null>;
  /** Slugs of the cities whose /city/<slug> is a live homepage. */
  activeCitySlugs(): Promise<string[]>;
}

export interface CfPurgePlan {
  /** Full URLs for the single-file purge (each page + its `.data` twin). */
  urls: string[];
  /** host+path prefixes: catch the `?occurrenceId=` / `?fbclid=` variants. */
  prefixes: string[];
  /** Canonical pages requested between the passes to start Vercel's re-render. */
  warm: string[];
  /** Tags that purge no URL, with the reason. */
  skipped: { tag: string; reason: string }[];
}

type Log = (msg: string) => void;

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Tags -> the public URLs Cloudflare may hold for them. Never throws: a
 *  failed lookup degrades to the URLs it can still name, and says so. */
export async function planCloudflarePurge(
  tags: readonly string[],
  resolver: CfPurgeResolver,
  opts: { slugHints?: Record<string, string>; log?: Log } = {},
): Promise<CfPurgePlan> {
  const log = opts.log ?? console.warn;
  const pages = new Set<string>();
  const warm = new Set<string>();
  const skipped: CfPurgePlan["skipped"] = [];
  const slugMemo = new Map<string, Promise<string | null>>();

  const slugFor = (table: CfEntityTable, id: string): Promise<string | null> => {
    const hint = opts.slugHints?.[id];
    if (hint && SLUG_RE.test(hint)) return Promise.resolve(hint);
    const key = `${table}:${id}`;
    let p = slugMemo.get(key);
    if (!p) {
      p = resolver.slugFor(table, id).then(
        (s) => (s && SLUG_RE.test(s) ? s : null),
        (err) => {
          log(`[cf-purge] slug lookup failed for ${key}; purging the uuid URL only: ${errMsg(err)}`);
          return null;
        },
      );
      slugMemo.set(key, p);
    }
    return p;
  };

  const addCity = (slug: string) => {
    pages.add(`/city/${slug}`);
    warm.add(`/city/${slug}`);
  };

  for (const tag of tags) {
    const match = tagKindOf(tag);
    if (!match) {
      log(`[cf-purge] no Cloudflare URL mapping for tag "${tag}"; nothing purged for it`);
      skipped.push({ tag, reason: "unknown tag" });
      continue;
    }
    const rule = CF_URL_RULES[match.kind];
    switch (rule.kind) {
      case "none":
        skipped.push({ tag, reason: rule.reason });
        break;
      case "static":
        for (const p of rule.paths) {
          pages.add(p);
          if (rule.warm) warm.add(p);
        }
        break;
      case "city":
        if (match.param && SLUG_RE.test(match.param)) addCity(match.param.toLowerCase());
        else skipped.push({ tag, reason: "malformed city slug" });
        break;
      case "active-cities": {
        let slugs: string[] = [];
        try {
          slugs = (await resolver.activeCitySlugs()).filter((s) => SLUG_RE.test(s));
        } catch (err) {
          log(`[cf-purge] active-city lookup failed; purging ${SEO_LANDING_CITY_SLUG} only: ${errMsg(err)}`);
        }
        if (!slugs.length) slugs = [SEO_LANDING_CITY_SLUG];
        for (const s of slugs) addCity(s.toLowerCase());
        break;
      }
      case "entity": {
        const id = match.param;
        if (!id || !UUID_RE.test(id)) {
          skipped.push({ tag, reason: "entity id is not a uuid" });
          break;
        }
        const slug = await slugFor(rule.table, id);
        pages.add(`${rule.basePath}/${id}`);
        if (slug) pages.add(`${rule.basePath}/${slug}`);
        warm.add(`${rule.basePath}/${slug ?? id}`);
        break;
      }
    }
  }

  const urls: string[] = [];
  const prefixes: string[] = [];
  for (const p of pages) {
    // `<page>.data` is React Router's single-fetch twin, fetched on client-side
    // navigation and cached by the same Cloudflare rule.
    urls.push(`${CF_SITE_ORIGIN}${p}`, `${CF_SITE_ORIGIN}${p}.data`);
    prefixes.push(`${CF_SITE_HOST}${p}`);
  }
  return { urls, prefixes, warm: [...warm].map((p) => `${CF_SITE_ORIGIN}${p}`), skipped };
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export interface CfEnv {
  token?: string;
  zoneId?: string;
  /** VERCEL_ENV; anything other than production (when set) skips. */
  vercelEnv?: string;
}

export function cloudflareEnvFromProcess(): CfEnv {
  return {
    token: process.env.CLOUDFLARE_API_TOKEN,
    zoneId: process.env.CLOUDFLARE_ZONE_ID,
    vercelEnv: process.env.VERCEL_ENV,
  };
}

/** null when the purge may run, else the reason it is skipped. */
export function cloudflareSkipReason(env: CfEnv): string | null {
  if (!env.token || !env.zoneId) return "CLOUDFLARE_API_TOKEN / CLOUDFLARE_ZONE_ID not set";
  if (!ZONE_ID_RE.test(env.zoneId)) return "CLOUDFLARE_ZONE_ID is not a 32-hex zone id";
  if (env.vercelEnv && env.vercelEnv !== "production") return `VERCEL_ENV is ${env.vercelEnv}, not production`;
  return null;
}

export interface CfPurgeDeps {
  env: CfEnv;
  fetch: typeof fetch;
  getResolver: () => Promise<CfPurgeResolver>;
  slugHints?: Record<string, string>;
  sleep?: (ms: number) => Promise<void>;
  settleMs?: number;
  log?: Log;
}

export interface CfPurgeResult {
  status: "skipped" | "noop" | "done";
  reason?: string;
  plan?: CfPurgePlan;
  apiCalls: number;
  apiFailures: number;
}

// One purge request; retried once on 5xx or a network error. The token goes in
// the Authorization header only and is never logged.
async function cfPurgeCall(
  deps: CfPurgeDeps,
  body: Record<string, unknown>,
  what: string,
  log: Log,
): Promise<boolean> {
  const url = `${CF_API}/zones/${deps.env.zoneId}/purge_cache`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await deps.fetch(url, {
        method: "POST",
        headers: { authorization: `Bearer ${deps.env.token}`, "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(CF_TIMEOUT_MS),
      });
      const text = await res.text().catch(() => "");
      if (res.ok) {
        let success = true;
        try {
          success = (JSON.parse(text) as { success?: boolean }).success !== false;
        } catch {
          // A 2xx without JSON still means accepted.
        }
        if (success) return true;
      }
      if (res.status >= 500 && attempt === 1) continue;
      log(`[cf-purge] ${what} failed: HTTP ${res.status} ${text.slice(0, 300)}`);
      return false;
    } catch (err) {
      if (attempt === 1) continue;
      log(`[cf-purge] ${what} failed: ${errMsg(err)}`);
      return false;
    }
  }
  return false;
}

/** The whole best-effort sequence. Never throws. */
export async function runCloudflarePurge(
  tags: readonly string[],
  deps: CfPurgeDeps,
): Promise<CfPurgeResult> {
  const log = deps.log ?? console.warn;
  let apiCalls = 0;
  let apiFailures = 0;
  try {
    const skip = cloudflareSkipReason(deps.env);
    if (skip) {
      log(`[cf-purge] skipped: ${skip}`);
      return { status: "skipped", reason: skip, apiCalls, apiFailures };
    }
    const resolver = await deps.getResolver();
    const plan = await planCloudflarePurge(tags, resolver, { slugHints: deps.slugHints, log });
    if (!plan.urls.length) {
      log(`[cf-purge] no-op: no public URL maps to tags [${tags.join(", ")}]`);
      return { status: "noop", plan, apiCalls, apiFailures };
    }

    const call = async (body: Record<string, unknown>, what: string) => {
      apiCalls++;
      if (!(await cfPurgeCall(deps, body, what, log))) apiFailures++;
    };
    const purgeUrls = async (pass: number) => {
      for (const [i, files] of chunk(plan.urls, CF_MAX_URLS_PER_CALL).entries()) {
        await call({ files }, `pass ${pass} url purge ${i + 1}`);
      }
    };

    await purgeUrls(1);
    // Warm: one request per canonical page so Vercel re-renders the soft-
    // invalidated copy (the response itself is the stale one, discarded).
    await Promise.all(
      plan.warm.map((u) =>
        deps
          .fetch(u, { headers: { "user-agent": "bachata-cf-purge-warm/1" }, signal: AbortSignal.timeout(CF_TIMEOUT_MS) })
          .then((r) => r.arrayBuffer())
          .catch((err) => log(`[cf-purge] warm ${u} failed: ${errMsg(err)}`)),
      ),
    );
    await (deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))))(
      deps.settleMs ?? CF_DEFAULT_SETTLE_MS,
    );
    await purgeUrls(2);
    // Query-string variants (?occurrenceId=, ?fbclid=) cannot be named one by
    // one. A prefix purge clears them; it is rate-limited (5/min), so a 429
    // here is logged and the URL purges above still stand.
    for (const [i, prefixes] of chunk(plan.prefixes, CF_MAX_PREFIXES_PER_CALL).entries()) {
      await call({ prefixes }, `prefix purge ${i + 1}`);
    }
    log(
      `[cf-purge] done: ${plan.urls.length} urls, ${plan.prefixes.length} prefixes, ` +
        `${apiCalls} calls, ${apiFailures} failed`,
    );
    return { status: "done", plan, apiCalls, apiFailures };
  } catch (err) {
    log(`[cf-purge] aborted: ${errMsg(err)}`);
    return { status: "done", apiCalls, apiFailures: apiFailures + 1 };
  }
}
