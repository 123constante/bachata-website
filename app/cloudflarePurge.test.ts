import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import routes from "./routes";
import {
  REVALIDATABLE_ENTITY_TYPES,
  ALL_ROUTE_STAMPS,
  STAMP_PLACEHOLDER_ID,
  purgeTagsFor,
  SEO_LANDING,
  FESTIVALS_LIST,
  type EntityType,
} from "./cacheTags";
import {
  CF_URL_RULES,
  CF_MAX_URLS_PER_CALL,
  SEO_LANDING_PATHS,
  planCloudflarePurge,
  runCloudflarePurge,
  tagKindOf,
  type CfPurgeResolver,
  type CfPurgeDeps,
} from "./cloudflarePurge";

// The Cloudflare half of the invalidation contract. Every tag a route stamps or
// a write purges must name its public URLs here (or say why not), and those
// URLs must be real routes -- otherwise a content write purges Vercel and
// Cloudflare keeps serving the old page for ~5 minutes.

const ID = STAMP_PLACEHOLDER_ID;
const EV = "11111111-2222-4333-8444-555555555555";
const FEST = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const DANCER = "99999999-8888-4777-8666-555555555555";
const VENUE = "12121212-3434-4565-8787-909090909090";
const O = "https://www.bachatacalendar.co.uk";
const H = "www.bachatacalendar.co.uk";
const ZONE = "7f75e3fa3ea1ca8429ecdcac2468bf6d";

const SLUGS: Record<string, string> = {
  [EV]: "bachateame-saturdays",
  [FEST]: "summer-fest",
  [DANCER]: "jane-doe",
  [VENUE]: "temple-pier",
};

function resolver(over: Partial<CfPurgeResolver> = {}): CfPurgeResolver {
  return {
    slugFor: async (_t, id) => SLUGS[id] ?? null,
    activeCitySlugs: async () => ["london-gb"],
    ...over,
  };
}

const page = (p: string) => [`${O}${p}`, `${O}${p}.data`];

// ── Conformance ─────────────────────────────────────────────────────────────
const stampedKinds = new Set(ALL_ROUTE_STAMPS.flatMap((s) => s.split(",")));
const purgedKinds = new Set(
  REVALIDATABLE_ENTITY_TYPES.flatMap((t) => [
    ...purgeTagsFor(t as EntityType, ID),
    ...purgeTagsFor(t as EntityType, ID, "SLUG"),
    ...purgeTagsFor(t as EntityType, ID, "london-gb").map((k) => (k === "city-london-gb" ? "city-SLUG" : k)),
  ]),
);
const routePaths = (routes as { path?: string; file: string }[]).map((r) => ({ path: `/${r.path ?? ""}`, file: r.file }));

describe("Cloudflare URL mapping conformance", () => {
  it("has a rule for every stamped and every purged tag kind", () => {
    const missing = [...new Set([...stampedKinds, ...purgedKinds])].filter((k) => !(k in CF_URL_RULES));
    expect(missing, `tag kinds with no Cloudflare URL rule: ${missing.join(", ")}`).toEqual([]);
  });

  it("maps every tag a write purges to URLs (no purged tag is a documented no-URL)", () => {
    const noUrl = [...purgedKinds].filter((k) => CF_URL_RULES[k]?.kind === "none");
    expect(noUrl).toEqual([]);
  });

  it("gives every no-URL rule a reason", () => {
    for (const [k, r] of Object.entries(CF_URL_RULES)) {
      if (r.kind === "none") expect(r.reason.length, k).toBeGreaterThan(20);
    }
  });

  it("points every entity/city rule at a real :param route", () => {
    for (const [k, r] of Object.entries(CF_URL_RULES)) {
      const base = r.kind === "entity" ? r.basePath : r.kind === "city" || r.kind === "active-cities" ? "/city" : null;
      if (!base) continue;
      expect(routePaths.some((p) => p.path === `${base}/:id` || p.path === `${base}/:slug`), `${k} -> ${base}/:param`).toBe(true);
    }
  });

  // The static page sets are re-derived from the route modules that call the
  // stamp helper, so adding a 10th SEO landing page without listing it fails.
  it.each([
    [SEO_LANDING, "stampSeoLanding("],
    [FESTIVALS_LIST, "stampFestivalsList("],
  ])("static rule %s lists exactly the routes that stamp it", (tag, helper) => {
    const rule = CF_URL_RULES[tag];
    expect(rule.kind).toBe("static");
    const stampers = routePaths
      .filter((r) => readFileSync(join(__dirname, r.file), "utf8").includes(helper))
      .map((r) => r.path)
      .sort();
    expect([...(rule.kind === "static" ? rule.paths : [])].sort()).toEqual(stampers);
  });

  it("keeps SEO_LANDING_PATHS at the 9 event-bearing landing pages", () => {
    expect(SEO_LANDING_PATHS).toHaveLength(9);
  });
});

describe("tagKindOf", () => {
  it.each([
    [`event-${EV}`, `event-${ID}`, EV],
    [`festival-${FEST}`, `festival-${ID}`, FEST],
    ["festivals-list", "festivals-list", null],
    ["festivals", "festivals", null],
    ["city-london-gb", "city-SLUG", "london-gb"],
    ["home-feed", "home-feed", null],
  ])("%s -> %s", (tag, kind, param) => {
    expect(tagKindOf(tag)).toEqual({ kind, param });
  });

  it("returns null for an unknown tag", () => {
    expect(tagKindOf("mystery-tag")).toBeNull();
  });
});

// ── URL mapping per entity type ─────────────────────────────────────────────
describe("planCloudflarePurge", () => {
  const SEO = SEO_LANDING_PATHS.flatMap(page);
  it.each([
    {
      name: "cancelled event (no city: today's emit sends none)",
      tags: purgeTagsFor("event", EV),
      urls: [...page(`/event/${EV}`), ...page("/event/bachateame-saturdays"), ...page("/city/london-gb"), ...SEO],
      warm: [`${O}/event/bachateame-saturdays`, `${O}/city/london-gb`],
    },
    {
      name: "event in a non-SEO city",
      tags: purgeTagsFor("event", EV, "berlin-de"),
      urls: [...page(`/event/${EV}`), ...page("/event/bachateame-saturdays"), ...page("/city/berlin-de")],
      warm: [`${O}/event/bachateame-saturdays`, `${O}/city/berlin-de`],
    },
    {
      name: "festival in London",
      tags: purgeTagsFor("festival", FEST, "london-gb"),
      urls: [
        ...page(`/festival/${FEST}`), ...page("/festival/summer-fest"),
        ...page(`/event/${FEST}`), ...page("/event/summer-fest"),
        ...page("/festivals"), ...page("/city/london-gb"), ...SEO,
      ],
      warm: [`${O}/festival/summer-fest`, `${O}/event/summer-fest`, `${O}/festivals`, `${O}/city/london-gb`],
    },
    {
      name: "city tag only",
      tags: ["city-london-gb"],
      urls: page("/city/london-gb"),
      warm: [`${O}/city/london-gb`],
    },
    {
      name: "home feed (all active cities)",
      tags: ["home-feed"],
      urls: page("/city/london-gb"),
      warm: [`${O}/city/london-gb`],
    },
    {
      name: "dancer",
      tags: purgeTagsFor("dancer", DANCER),
      urls: [...page(`/dancers/${DANCER}`), ...page("/dancers/jane-doe")],
      warm: [`${O}/dancers/jane-doe`],
    },
    {
      name: "dj / teacher share dancer_profiles slugs",
      tags: [...purgeTagsFor("dj", DANCER), ...purgeTagsFor("teacher", DANCER)],
      urls: [...page(`/djs/${DANCER}`), ...page("/djs/jane-doe"), ...page(`/teachers/${DANCER}`), ...page("/teachers/jane-doe")],
      warm: [`${O}/djs/jane-doe`, `${O}/teachers/jane-doe`],
    },
    {
      name: "venue",
      tags: purgeTagsFor("venue", VENUE),
      urls: [...page(`/venue-entity/${VENUE}`), ...page("/venue-entity/temple-pier")],
      warm: [`${O}/venue-entity/temple-pier`],
    },
    {
      name: "hidden/archived event (resolver returns no slug): uuid URL only",
      tags: [`event-${"00000000-0000-4000-8000-000000000000"}`],
      urls: page("/event/00000000-0000-4000-8000-000000000000"),
      warm: [`${O}/event/00000000-0000-4000-8000-000000000000`],
    },
    {
      name: "unknown tag and collection tag: no URLs",
      tags: ["mystery-tag", "events"],
      urls: [],
      warm: [],
    },
  ])("$name", async ({ tags, urls, warm }) => {
    const plan = await planCloudflarePurge(tags, resolver(), { log: () => {} });
    expect(plan.urls.sort()).toEqual([...urls].sort());
    expect(plan.warm.sort()).toEqual([...warm].sort());
    expect(plan.prefixes.sort()).toEqual(
      urls.filter((u) => !u.endsWith(".data")).map((u) => u.replace("https://", "")).sort(),
    );
  });

  it("logs and skips an unknown tag", async () => {
    const log = vi.fn();
    const plan = await planCloudflarePurge(["mystery-tag"], resolver(), { log });
    expect(plan.skipped).toEqual([{ tag: "mystery-tag", reason: "unknown tag" }]);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('no Cloudflare URL mapping for tag "mystery-tag"'));
  });

  it("uses a sender-supplied slug hint (archived event the resolver hides)", async () => {
    const id = "00000000-0000-4000-8000-000000000000";
    const plan = await planCloudflarePurge([`event-${id}`], resolver(), { slugHints: { [id]: "old-party" }, log: () => {} });
    expect(plan.urls).toContain(`${O}/event/old-party`);
  });

  it("degrades to the uuid URL when the slug lookup throws", async () => {
    const log = vi.fn();
    const plan = await planCloudflarePurge([`event-${EV}`], resolver({ slugFor: async () => { throw new Error("db down"); } }), { log });
    expect(plan.urls).toEqual(page(`/event/${EV}`));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("slug lookup failed"));
  });

  it("falls back to london-gb when the active-city lookup fails", async () => {
    const plan = await planCloudflarePurge(["home-feed"], resolver({ activeCitySlugs: async () => { throw new Error("x"); } }), { log: () => {} });
    expect(plan.urls).toEqual(page("/city/london-gb"));
  });

  it("refuses ids and slugs that are not uuid/slug shaped (no URL injection from explicit tags)", async () => {
    const plan = await planCloudflarePurge(["event-../../admin", "city-a/b?c"], resolver(), { log: () => {} });
    expect(plan.urls).toEqual([]);
  });
});

// ── The run: env, chunking, failures ────────────────────────────────────────
type Call = { url: string; body?: Record<string, unknown> };
function harness(respond: (c: Call, n: number) => Response | Promise<Response>, env = { token: "tok", zoneId: ZONE }) {
  const calls: Call[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const c: Call = { url: String(input), body: init?.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(c);
    return respond(c, calls.length);
  });
  const log = vi.fn();
  const deps: CfPurgeDeps = {
    env,
    fetch: fetchMock as unknown as typeof fetch,
    getResolver: async () => resolver(),
    sleep: async () => {},
    log,
  };
  return { calls, deps, log, fetchMock };
}
const ok = () => new Response(JSON.stringify({ success: true }), { status: 200 });
const apiCalls = (calls: Call[]) => calls.filter((c) => c.url.includes("/purge_cache"));

describe("runCloudflarePurge", () => {
  it.each([
    [{ token: undefined, zoneId: ZONE }, "not set"],
    [{ token: "tok", zoneId: undefined }, "not set"],
    [{ token: "tok", zoneId: "not-a-zone" }, "32-hex"],
    [{ token: "tok", zoneId: ZONE, vercelEnv: "preview" }, "not production"],
  ])("is a logged no-op without usable env (%o)", async (env, why) => {
    const h = harness(ok, env as never);
    const r = await runCloudflarePurge(purgeTagsFor("event", EV), h.deps);
    expect(r.status).toBe("skipped");
    expect(h.fetchMock).not.toHaveBeenCalled();
    expect(h.log).toHaveBeenCalledWith(expect.stringContaining(why));
  });

  it("purges twice (around the warm) and prefixes once, with the token only in the header", async () => {
    const h = harness(ok);
    const r = await runCloudflarePurge(purgeTagsFor("event", EV, "berlin-de"), h.deps);
    expect(r).toMatchObject({ status: "done", apiFailures: 0 });
    const purge = apiCalls(h.calls);
    expect(purge.map((c) => Object.keys(c.body ?? {})[0])).toEqual(["files", "files", "prefixes"]);
    expect(purge[0].url).toBe(`https://api.cloudflare.com/client/v4/zones/${ZONE}/purge_cache`);
    const warmIdx = h.calls.findIndex((c) => !c.url.includes("/purge_cache"));
    expect(warmIdx).toBe(1); // after pass 1, before pass 2
    expect(h.calls[warmIdx].url).toMatch(/^https:\/\/www\.bachatacalendar\.co\.uk\//);
    expect(JSON.stringify(h.log.mock.calls)).not.toContain("tok");
  });

  it(`chunks more than ${CF_MAX_URLS_PER_CALL} URLs`, async () => {
    const h = harness(ok);
    // festival in London (4 entity pages + /festivals + city + 9 SEO) plus an
    // explicit second city = 16 pages = 32 URLs
    const r = await runCloudflarePurge([...purgeTagsFor("festival", FEST, "london-gb"), "city-berlin-de"], h.deps);
    expect(r.plan?.urls.length).toBe(32);
    const files = apiCalls(h.calls).filter((c) => c.body?.files).map((c) => (c.body!.files as string[]).length);
    expect(files).toEqual([30, 2, 30, 2]);
    expect(files.every((n) => n <= CF_MAX_URLS_PER_CALL)).toBe(true);
  });

  it("retries a 5xx once, then succeeds", async () => {
    let n = 0;
    const h = harness((c) => (c.url.includes("/purge_cache") && ++n === 1 ? new Response("boom", { status: 502 }) : ok()));
    const r = await runCloudflarePurge(["city-london-gb"], h.deps);
    expect(r.apiFailures).toBe(0);
    expect(apiCalls(h.calls)).toHaveLength(4); // 1 retried + pass 2 + prefixes
  });

  it.each([
    ["HTTP 403 (bad token scope)", () => new Response('{"success":false}', { status: 403 }), 3],
    ["HTTP 500 twice", () => new Response("down", { status: 500 }), 6],
    ["200 with success:false", () => new Response('{"success":false,"errors":[1]}', { status: 200 }), 3],
    ["network error", () => Promise.reject(new Error("ECONNRESET")), 6],
  ])("swallows a Cloudflare API failure: %s", async (_n, fail, expectedCalls) => {
    const h = harness((c) => (c.url.includes("/purge_cache") ? fail() : ok()));
    const r = await runCloudflarePurge(["city-london-gb"], h.deps);
    expect(r.status).toBe("done");
    expect(r.apiFailures).toBe(3);
    expect(apiCalls(h.calls)).toHaveLength(expectedCalls);
    expect(h.log).toHaveBeenCalledWith(expect.stringContaining("failed"));
  });

  it("is a no-op (no API call) when no tag maps to a URL", async () => {
    const h = harness(ok);
    const r = await runCloudflarePurge(["events", "mystery-tag"], h.deps);
    expect(r.status).toBe("noop");
    expect(h.fetchMock).not.toHaveBeenCalled();
  });
});
