import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Live-now slice 1 (docs/design/live-now-lag/PLAN.md, option C steps 1-2).
// A webhook body with `stateChange: true` (the admin emit lands in slice 2)
// hard-deletes ONLY event-<id>; the rest of purgeTagsFor's list (city-<slug>,
// seo-landing, home-feed, festival tags) stays on the soft invalidate. Never
// the whole list: seo-landing + city-london-gb would force up to 11 cold renders
// per cancel. A body without stateChange behaves exactly as before.
// The Cloudflare warm now also fetches the event's canonical `.data` twin (G3).

const invalidateByTag = vi.fn();
const dangerouslyDeleteByTag = vi.fn();
const waitUntil = vi.fn();
const resolvePublicEventRef = vi.fn();
vi.mock("@vercel/functions", () => ({ invalidateByTag, dangerouslyDeleteByTag, waitUntil }));
vi.mock("@/lib/seo/resolvePublicEventRef", () => ({ resolvePublicEventRef }));
vi.mock("../lib/cloudflarePurgeResolver", () => ({
  supabaseCloudflareResolver: {
    slugFor: async () => "bachateame-saturdays",
    activeCitySlugs: async () => ["london-gb"],
  },
}));

const SECRET = "test-secret";
const EV = "11111111-2222-4333-8444-555555555555";
const ZONE = "7f75e3fa3ea1ca8429ecdcac2468bf6d";
const O = "https://www.bachatacalendar.co.uk";
const EVT = `event-${EV}`;

async function load() {
  vi.resetModules();
  process.env.REVALIDATE_SECRET = SECRET;
  return (await import("./api.revalidate")).action;
}
function post(body: unknown) {
  return new Request(`${O}/api/revalidate`, {
    method: "POST",
    headers: { authorization: `Bearer ${SECRET}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const call = async (body: unknown) => (await load())({ request: post(body) } as never);

// The live body today (prod apply_aggregate_write_p5, read-only 2026-11-02):
// { entityType, entityId, seriesId, occurrenceId, commandKind, auditId, citySlug }.
const liveBody = (extra: Record<string, unknown> = {}) => ({
  entityType: "event",
  entityId: EV,
  seriesId: "aaaaaaaa-2222-4333-8444-555555555555",
  occurrenceId: "bbbbbbbb-2222-4333-8444-555555555555",
  commandKind: "occurrence.update",
  auditId: "cccccccc-2222-4333-8444-555555555555",
  citySlug: "london-gb",
  ...extra,
});

describe("/api/revalidate stateChange: hard-delete event-<id> only", () => {
  beforeEach(() => {
    invalidateByTag.mockReset().mockResolvedValue(undefined);
    dangerouslyDeleteByTag.mockReset().mockResolvedValue(undefined);
    resolvePublicEventRef.mockReset().mockResolvedValue({ id: EV, slug: "bachateame-saturdays" });
    waitUntil.mockReset();
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  // PLAN acceptance matrix, `/event/:id` HTML + `/city/:slug` + SEO landing rows.
  it.each([
    ["cancelled", "occurrence.cancel"],
    ["moved (date)", "occurrence.move"],
    ["time changed", "occurrence.update"],
    ["venue moved", "occurrence.venue"],
    ["slug change", "series.update"],
  ])("%s, London: hard [event-<id>], soft [city-london-gb, seo-landing]", async (_n, commandKind) => {
    const res = await call(liveBody({ commandKind, stateChange: true }));
    expect(res.status).toBe(200);
    expect(dangerouslyDeleteByTag).toHaveBeenCalledTimes(1);
    expect(dangerouslyDeleteByTag).toHaveBeenCalledWith([EVT]);
    expect(invalidateByTag).toHaveBeenCalledTimes(1);
    expect(invalidateByTag).toHaveBeenCalledWith(["city-london-gb", "seo-landing"]);
    // The response still reports the full list the purge covered.
    expect(await res.json()).toEqual({ ok: true, tags: [EVT, "city-london-gb", "seo-landing"] });
  });

  it.each([
    ["non-London city", { citySlug: "berlin-de" }, ["city-berlin-de"]],
    ["city unresolved", { citySlug: undefined }, ["home-feed", "seo-landing"]],
  ])("%s: hard [event-<id>] only, the rest soft", async (_n, extra, soft) => {
    await call(liveBody({ ...extra, stateChange: true }));
    expect(dangerouslyDeleteByTag).toHaveBeenCalledWith([EVT]);
    expect(invalidateByTag).toHaveBeenCalledWith(soft);
  });

  it("festival: hard [event-<id>] only; festival-<id> and the lists stay soft", async () => {
    await call(liveBody({ entityType: "festival", stateChange: true }));
    expect(dangerouslyDeleteByTag).toHaveBeenCalledWith([EVT]);
    expect(invalidateByTag).toHaveBeenCalledWith([`festival-${EV}`, "festivals-list", "city-london-gb", "seo-landing"]);
  });

  it("never hard-deletes seo-landing or a city tag on a state change", async () => {
    for (const citySlug of ["london-gb", "berlin-de", undefined]) {
      dangerouslyDeleteByTag.mockClear();
      await call(liveBody({ citySlug, stateChange: true }));
      const hard = dangerouslyDeleteByTag.mock.calls.flatMap(([t]) => t as string[]);
      expect(hard).toEqual([EVT]);
    }
  });

  it("cancel then restore: two hard deletes of event-<id>, nothing else hard", async () => {
    await call(liveBody({ commandKind: "occurrence.cancel", stateChange: true }));
    await call(liveBody({ commandKind: "occurrence.restore", stateChange: true }));
    expect(dangerouslyDeleteByTag.mock.calls).toEqual([[[EVT]], [[EVT]]]);
    expect(invalidateByTag).toHaveBeenCalledTimes(2);
  });

  it("hidden (archived) with stateChange: the existing full-list hard delete, unchanged", async () => {
    resolvePublicEventRef.mockResolvedValue(null);
    await call(liveBody({ stateChange: true }));
    expect(dangerouslyDeleteByTag).toHaveBeenCalledTimes(1);
    expect(dangerouslyDeleteByTag).toHaveBeenCalledWith([EVT, "city-london-gb", "seo-landing"]);
    expect(invalidateByTag).not.toHaveBeenCalled();
  });

  // Untouched save sends no webhook (DB side); every body the DB sends TODAY
  // lacks stateChange and must behave exactly as before.
  it.each([
    ["absent (today's live body)", {}],
    ["false", { stateChange: false }],
    ["string 'true' (not boolean)", { stateChange: "true" }],
    ["1", { stateChange: 1 }],
  ])("stateChange %s: soft full list, no hard delete", async (_n, extra) => {
    await call(liveBody(extra));
    expect(invalidateByTag).toHaveBeenCalledWith([EVT, "city-london-gb", "seo-landing"]);
    expect(dangerouslyDeleteByTag).not.toHaveBeenCalled();
  });

  it("explicit tags win: stateChange does not split a manual purge", async () => {
    await call({ tags: [EVT, "seo-landing"], stateChange: true });
    expect(invalidateByTag).toHaveBeenCalledWith([EVT, "seo-landing"]);
    expect(dangerouslyDeleteByTag).not.toHaveBeenCalled();
  });

  it("non-event entity with stateChange: soft, as before", async () => {
    await call({ entityType: "venue", entityId: EV, stateChange: true });
    expect(invalidateByTag).toHaveBeenCalledWith([`venue-${EV}`]);
    expect(dangerouslyDeleteByTag).not.toHaveBeenCalled();
  });

  it("hard delete fails on a state change: 502, Cloudflare skipped", async () => {
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "tok");
    vi.stubEnv("CLOUDFLARE_ZONE_ID", ZONE);
    vi.stubEnv("VERCEL_ENV", "production");
    dangerouslyDeleteByTag.mockRejectedValue(new Error("vercel down"));
    const res = await call(liveBody({ stateChange: true }));
    expect(res.status).toBe(502);
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it("snake_case state_change: true takes the same path", async () => {
    await call(liveBody({ state_change: true }));
    expect(dangerouslyDeleteByTag).toHaveBeenCalledWith([EVT]);
    expect(invalidateByTag).toHaveBeenCalledWith(["city-london-gb", "seo-landing"]);
  });

  it("Cloudflare is scheduled only AFTER the hard delete resolved", async () => {
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "tok");
    vi.stubEnv("CLOUDFLARE_ZONE_ID", ZONE);
    vi.stubEnv("VERCEL_ENV", "production");
    let hardDone = false;
    dangerouslyDeleteByTag.mockImplementation(async () => {
      await Promise.resolve();
      hardDone = true;
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"success":true}')));
    waitUntil.mockImplementation(() => expect(hardDone).toBe(true));
    vi.useFakeTimers();
    let res: Response;
    try {
      res = await call(liveBody({ stateChange: true }));
      // Drain the purge task so it cannot hit the next test's fetch stub.
      await vi.runAllTimersAsync();
      await (waitUntil.mock.calls[0][0] as Promise<unknown>);
    } finally {
      vi.useRealTimers();
    }
    expect(res!.status).toBe(200);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(dangerouslyDeleteByTag.mock.invocationCallOrder[0]).toBeLessThan(waitUntil.mock.invocationCallOrder[0]);
  });

  it("hard delete ok, soft invalidate fails: 502, but the event page is still purged from Cloudflare", async () => {
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "tok");
    vi.stubEnv("CLOUDFLARE_ZONE_ID", ZONE);
    vi.stubEnv("VERCEL_ENV", "production");
    const fetchSpy = vi.fn(async (_u: RequestInfo | URL, _i?: RequestInit) => new Response('{"success":true}'));
    vi.stubGlobal("fetch", fetchSpy);
    invalidateByTag.mockRejectedValue(new Error("vercel soft down"));
    vi.useFakeTimers();
    let res: Response;
    try {
      res = await call(liveBody({ stateChange: true }));
      expect(waitUntil).toHaveBeenCalledTimes(1);
      await vi.runAllTimersAsync();
      await (waitUntil.mock.calls[0][0] as Promise<unknown>);
    } finally {
      vi.useRealTimers();
    }
    expect(res!.status).toBe(502);
    const purged = fetchSpy.mock.calls
      .filter(([u]) => String(u).includes("/purge_cache"))
      .map(([, init]) => String((init as RequestInit).body))
      .join("\n");
    expect(purged).toContain("/event/bachateame-saturdays");
    expect(purged).not.toContain("/city/london-gb");
    expect(purged).not.toContain("/london-bachata-guide");
  });

  // `/event/<slug>.data` row: purged AND warmed, canonical URL, no query.
  it.each([
    ["cancelled", "bachateame-saturdays", "bachateame-saturdays"],
    ["slug change (sender's new slug)", "new-slug-saturdays", "new-slug-saturdays"],
  ])("%s: Cloudflare warms /event/<slug> and its .data twin", async (_n, hint, slug) => {
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "tok");
    vi.stubEnv("CLOUDFLARE_ZONE_ID", ZONE);
    vi.stubEnv("VERCEL_ENV", "production");
    const fetchSpy = vi.fn(async (_u: RequestInfo | URL, _i?: RequestInit) => new Response('{"success":true}'));
    vi.stubGlobal("fetch", fetchSpy);
    vi.useFakeTimers();
    try {
      await call(liveBody({ stateChange: true, slug: hint }));
      const task = waitUntil.mock.calls[0][0] as Promise<unknown>;
      await vi.runAllTimersAsync();
      await task;
    } finally {
      vi.useRealTimers();
    }
    const warmed = fetchSpy.mock.calls.map(([u]) => String(u)).filter((u) => !u.includes("/purge_cache"));
    expect(warmed).toContain(`${O}/event/${slug}`);
    expect(warmed).toContain(`${O}/event/${slug}.data`);
    for (const u of warmed) expect(u).not.toContain("?");
  });
});
