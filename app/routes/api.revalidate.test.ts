import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// /api/revalidate's contract with the Cloudflare purge: the Vercel tag purge
// decides the response; the Cloudflare purge runs in waitUntil, is never
// awaited, and can neither fail nor delay the webhook.

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

async function load() {
  vi.resetModules();
  process.env.REVALIDATE_SECRET = SECRET;
  return (await import("./api.revalidate")).action;
}
function post(body: unknown) {
  return new Request("https://www.bachatacalendar.co.uk/api/revalidate", {
    method: "POST",
    headers: { authorization: `Bearer ${SECRET}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const call = async (body: unknown) => (await load())({ request: post(body) } as never);

describe("/api/revalidate + Cloudflare purge", () => {
  const fetchSpy = vi.fn();
  beforeEach(() => {
    invalidateByTag.mockReset().mockResolvedValue(undefined);
    dangerouslyDeleteByTag.mockReset().mockResolvedValue(undefined);
    resolvePublicEventRef.mockReset().mockResolvedValue({ id: EV, slug: "bachateame-saturdays" });
    waitUntil.mockReset();
    fetchSpy.mockReset();
    vi.stubGlobal("fetch", fetchSpy);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it.each([
    ["env absent", {}, false],
    ["preview deployment", { CLOUDFLARE_API_TOKEN: "tok", CLOUDFLARE_ZONE_ID: ZONE, VERCEL_ENV: "preview" }, false],
    ["env present", { CLOUDFLARE_API_TOKEN: "tok", CLOUDFLARE_ZONE_ID: ZONE, VERCEL_ENV: "production" }, true],
  ])("%s: Vercel purge returns 200; Cloudflare scheduled=%s", async (_n, env, scheduled) => {
    for (const k of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ZONE_ID", "VERCEL_ENV"]) vi.stubEnv(k, "");
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    fetchSpy.mockResolvedValue(new Response('{"success":true}'));
    const res = await call({ entityType: "event", entityId: EV });
    expect(res.status).toBe(200);
    expect(invalidateByTag).toHaveBeenCalledWith([`event-${EV}`, "home-feed", "seo-landing"]);
    expect(waitUntil).toHaveBeenCalledTimes(scheduled ? 1 : 0);
    if (!scheduled) {
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("[cf-purge] skipped"));
    }
  });

  it("returns 200 without waiting for a Cloudflare purge that never settles", async () => {
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "tok");
    vi.stubEnv("CLOUDFLARE_ZONE_ID", ZONE);
    vi.stubEnv("VERCEL_ENV", "production");
    fetchSpy.mockImplementation(() => new Promise(() => {})); // hangs forever
    const res = await call({ entityType: "event", entityId: EV });
    expect(res.status).toBe(200);
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it("returns 200 when the Cloudflare API fails, and the background task resolves (swallowed)", async () => {
    vi.useFakeTimers();
    try {
      vi.stubEnv("CLOUDFLARE_API_TOKEN", "tok");
      vi.stubEnv("CLOUDFLARE_ZONE_ID", ZONE);
      vi.stubEnv("VERCEL_ENV", "production");
      fetchSpy.mockResolvedValue(new Response("down", { status: 500 }));
      const res = await call({ entityType: "venue", entityId: EV });
      expect(res.status).toBe(200);
      const task = waitUntil.mock.calls[0][0] as Promise<unknown>;
      await vi.runAllTimersAsync();
      await expect(task).resolves.toBeDefined();
      expect(fetchSpy.mock.calls.some(([u]) => String(u).includes("/purge_cache"))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not purge Cloudflare when the Vercel purge failed (Cloudflare would refetch the old copy)", async () => {
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "tok");
    vi.stubEnv("CLOUDFLARE_ZONE_ID", ZONE);
    invalidateByTag.mockRejectedValue(new Error("vercel down"));
    const res = await call({ entityType: "event", entityId: EV });
    expect(res.status).toBe(502);
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it("still survives waitUntil itself throwing", async () => {
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "tok");
    vi.stubEnv("CLOUDFLARE_ZONE_ID", ZONE);
    vi.stubEnv("VERCEL_ENV", "production");
    fetchSpy.mockResolvedValue(new Response('{"success":true}'));
    waitUntil.mockImplementation(() => {
      throw new Error("no request context");
    });
    const res = await call({ entityType: "event", entityId: EV });
    expect(res.status).toBe(200);
  });

  // 2026-10-08 takedown re-walk: an archived series kept serving its page. The
  // soft invalidate let Vercel hand out the stale copy (title and all) while the
  // background re-render 404'd. A write that leaves the event HIDDEN (archived,
  // draft, pending_review: the public resolver returns null) must hard-delete,
  // so the next request renders the 404 instead of the old page.
  it.each([
    ["hidden (resolver null)", async () => null],
    ["visibility unknown (resolver error)", async () => { throw new Error("db blip"); }],
  ])("event %s: hard-deletes the tags instead of serving stale", async (_n, impl) => {
    resolvePublicEventRef.mockImplementation(impl);
    const res = await call({ entityType: "event", entityId: EV });
    expect(res.status).toBe(200);
    expect(resolvePublicEventRef).toHaveBeenCalledWith(EV, "throw");
    expect(dangerouslyDeleteByTag).toHaveBeenCalledWith([`event-${EV}`, "home-feed", "seo-landing"]);
    expect(invalidateByTag).not.toHaveBeenCalled();
  });

  it("festival hidden: hard-deletes too", async () => {
    resolvePublicEventRef.mockResolvedValue(null);
    const res = await call({ entityType: "festival", entityId: EV });
    expect(res.status).toBe(200);
    expect(dangerouslyDeleteByTag).toHaveBeenCalledTimes(1);
    expect(invalidateByTag).not.toHaveBeenCalled();
  });

  it("event still public (live/ended): keeps the soft invalidate", async () => {
    const res = await call({ entityType: "event", entityId: EV });
    expect(res.status).toBe(200);
    expect(invalidateByTag).toHaveBeenCalledTimes(1);
    expect(dangerouslyDeleteByTag).not.toHaveBeenCalled();
  });

  it("non-event entities skip the visibility lookup", async () => {
    await call({ entityType: "venue", entityId: EV });
    expect(resolvePublicEventRef).not.toHaveBeenCalled();
    expect(invalidateByTag).toHaveBeenCalledTimes(1);
  });

  it("returns 502 when the hard delete fails, and skips Cloudflare", async () => {
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "tok");
    vi.stubEnv("CLOUDFLARE_ZONE_ID", ZONE);
    vi.stubEnv("VERCEL_ENV", "production");
    resolvePublicEventRef.mockResolvedValue(null);
    dangerouslyDeleteByTag.mockRejectedValue(new Error("vercel down"));
    const res = await call({ entityType: "event", entityId: EV });
    expect(res.status).toBe(502);
    expect(waitUntil).not.toHaveBeenCalled();
  });
});
