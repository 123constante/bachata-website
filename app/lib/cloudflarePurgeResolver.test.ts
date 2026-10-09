import { describe, it, expect, vi, beforeEach } from "vitest";

// A taken-down (archived) series no longer resolves through the public
// resolver, but its /event/<slug> URL is exactly the one Cloudflare still
// holds. The resolver must find that slug anyway (2026-10-08 re-walk).

const resolvePublicEventRef = vi.fn();
vi.mock("@/lib/seo/resolvePublicEventRef", () => ({ resolvePublicEventRef }));
vi.mock("@/integrations/supabase/getSupabase", () => ({ getSupabase: async () => ({}) }));

const ID = "c81746db-945b-47af-bdca-501886e105e0";
const ENV = { SUPABASE_URL: "https://x.supabase.co/", SUPABASE_SERVICE_ROLE_KEY: "svc" };

describe("cloudflarePurgeResolver: hidden event slug", () => {
  beforeEach(() => {
    resolvePublicEventRef.mockReset();
    vi.unstubAllEnvs();
  });

  it("archived series: falls back to the service-role slug lookup", async () => {
    resolvePublicEventRef.mockResolvedValue(null);
    for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify([{ slug: "zz-test-delete-me-party2" }])));
    vi.stubGlobal("fetch", fetchSpy);
    const { supabaseCloudflareResolver } = await import("./cloudflarePurgeResolver");
    await expect(supabaseCloudflareResolver.slugFor("events", ID)).resolves.toBe("zz-test-delete-me-party2");
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      `https://x.supabase.co/rest/v1/event_series_p5?select=slug&or=(legacy_event_id.eq.${ID},and(legacy_event_id.is.null,id.eq.${ID}))&limit=2`,
    );
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer svc");
    vi.unstubAllGlobals();
  });

  it("public series: uses the public resolver and never the service key", async () => {
    resolvePublicEventRef.mockResolvedValue({ id: ID, slug: "live-one" });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { supabaseCloudflareResolver } = await import("./cloudflarePurgeResolver");
    await expect(supabaseCloudflareResolver.slugFor("events", ID)).resolves.toBe("live-one");
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it.each([
    ["no service key", { SUPABASE_URL: "https://x.supabase.co" }, [{ slug: "s" }], null],
    ["no row", ENV, [], null],
    ["ambiguous uuid", ENV, [{ slug: "a" }, { slug: "b" }], null],
    ["one row", ENV, [{ slug: "a" }], "a"],
  ])("hiddenEventSlug: %s", async (_n, env, rows, want) => {
    const { hiddenEventSlug } = await import("./cloudflarePurgeResolver");
    const f = vi.fn(async () => new Response(JSON.stringify(rows)));
    await expect(hiddenEventSlug(ID, env, f as unknown as typeof fetch)).resolves.toBe(want);
  });

  it("hiddenEventSlug: HTTP error throws (the planner logs and purges the uuid URL)", async () => {
    const { hiddenEventSlug } = await import("./cloudflarePurgeResolver");
    const f = vi.fn(async () => new Response("no", { status: 500 }));
    await expect(hiddenEventSlug(ID, ENV, f as unknown as typeof fetch)).rejects.toThrow("HTTP 500");
  });

  it("hiddenEventSlug: a non-uuid id never reaches the query string", async () => {
    const { hiddenEventSlug } = await import("./cloudflarePurgeResolver");
    const f = vi.fn();
    await expect(hiddenEventSlug("x),id.neq.(", ENV, f as unknown as typeof fetch)).resolves.toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
});
