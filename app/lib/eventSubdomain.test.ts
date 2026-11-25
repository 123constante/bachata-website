import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  eventSubdomainLinksEnabled,
  isSubdomainLabel,
  isWwwOrApexHost,
  parseEventHost,
  parseNightPath,
  pickNightOccurrenceId,
  RESERVED_LABELS,
} from "./eventSubdomain";
import { classifyCatchallPath } from "../catchallGate";

// Rows 1-7 of brief #2147. Pure parsing first, then the /event loader with its
// data layer mocked.

const resolveMock = vi.fn();
const snapshotMock = vi.fn();
vi.mock("@/lib/seo/resolvePublicEventRef", () => ({ resolvePublicEventRef: (...a: unknown[]) => resolveMock(...a) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: async (name: string, args: { p_target: { occurrence_id?: string } }) => snapshotMock(name, args) },
}));
vi.mock("@/App", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  return { createServerQueryClient: () => new QueryClient() };
});
vi.mock("@/modules/event-page/useEventPageQuery", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@/modules/event-page/useEventPageQuery");
  return { ...actual, parseEventPageSnapshot: (d: unknown) => d };
});
vi.mock("@/modules/event-page/useFestivalDetailQuery", () => ({
  festivalDetailQueryKey: (id: string) => ["fd", id],
  fetchFestivalDetail: async () => null,
}));
vi.mock("@/modules/event-page/festivalEventQuery", () => ({
  festivalEventQueryKey: (id: string) => ["fe", id],
  fetchFestivalEventRow: async () => null,
  sniffIsFestival: () => false,
}));
vi.mock("@/modules/event-page/sections/MoreEventsSection", () => ({ prefetchEndedDoor: async () => {} }));
vi.mock("@/pages/EventPage", () => ({ default: () => null }));
vi.mock("../InitialVisiblePageTransition", () => ({ InitialVisiblePageTransition: () => null }));
vi.mock("../detailLoader", () => ({
  cacheHeaders: () => ({}),
  edgeCacheControl: () => "s-maxage=3600",
  resolveOgCardImageSized: async () => ({ url: "x", width: 1200, height: 630 }),
  taggedData: (d: unknown) => ({ data: d }),
}));
vi.mock("../lib/ogTallPreview.server", () => ({ measureWholeFlyerCanvas: async () => null, resolveOgTallPreview: async () => null }));
vi.mock("../lib/hiddenEventResponse", () => ({ hiddenEventResponse: async () => new Response("gone", { status: 404 }) }));

describe("parseEventHost (rows 1, 4, 5, 7)", () => {
  it.each([
    ["bachataloungeleeds.bachatacalendar.co.uk", { kind: "event", label: "bachataloungeleeds" }],
    ["BachataLounge.bachatacalendar.co.uk:443", { kind: "event", label: "bachatalounge" }],
    ["www.bachataloungeleeds.bachatacalendar.co.uk", { kind: "www-event", label: "bachataloungeleeds" }],
    ["www.bachatacalendar.co.uk", { kind: "none" }],
    ["bachatacalendar.co.uk", { kind: "none" }],
    ["bachata-calendar-abc.vercel.app", { kind: "none" }],
    ["localhost:5173", { kind: "none" }],
    ["a.b.bachatacalendar.co.uk", { kind: "none" }],
    ["with-dash.bachatacalendar.co.uk", { kind: "none" }],
    [null, { kind: "none" }],
  ])("%s", (host, want) => expect(parseEventHost(host)).toEqual(want));

  it.each(RESERVED_LABELS)("reserved label %s is never an event", (l) => {
    expect(parseEventHost(`${l}.bachatacalendar.co.uk`)).toEqual({ kind: "none" });
    expect(parseEventHost(`www.${l}.bachatacalendar.co.uk`)).toEqual({ kind: "none" });
  });
});

describe("flag (row 5)", () => {
  it("only the exact string true turns it on", () => {
    expect(eventSubdomainLinksEnabled({})).toBe(false);
    expect(eventSubdomainLinksEnabled({ EVENT_SUBDOMAIN_LINKS: "1" })).toBe(false);
    expect(eventSubdomainLinksEnabled({ EVENT_SUBDOMAIN_LINKS: "true" })).toBe(true);
  });
});

describe("night paths (row 2)", () => {
  it.each([
    ["/19-dec", { day: 19, month: 12, year: null }],
    ["3-jan", { day: 3, month: 1, year: null }],
    ["/19-dec-2027", { day: 19, month: 12, year: 2027 }],
    ["/19-DEC/", { day: 19, month: 12, year: null }],
  ])("%s", (p, want) => expect(parseNightPath(p)).toEqual(want));
  it.each(["/", "", "/foo", "/32-dec", "/0-dec", "/19-xyz", "/19-dec-27", "/19-dec/x"])("%s is not a night", (p) =>
    expect(parseNightPath(p)).toBeNull(),
  );
  it("a night path never reaches the legacy-city catch-all", () => {
    expect(classifyCatchallPath("/19-dec").kind).toBe("unknown");
  });

  const occs = [
    { occurrenceId: "past25", localDate: "2025-12-19T20:00" },
    { occurrenceId: "up26", localDate: "2026-12-19T20:00" },
    { occurrenceId: "up27", localDate: "2027-12-19T20:00" },
    { occurrenceId: "jan", localDate: "2027-01-03" },
  ];
  it("no year: nearest upcoming night", () => {
    expect(pickNightOccurrenceId(occs, { day: 19, month: 12, year: null }, "2026-11-25")).toBe("up26");
  });
  it("no year: tonight counts as upcoming", () => {
    expect(pickNightOccurrenceId(occs, { day: 19, month: 12, year: null }, "2026-12-19")).toBe("up26");
  });
  it("no year: else the most recent past night", () => {
    expect(pickNightOccurrenceId(occs, { day: 19, month: 12, year: null }, "2028-01-01")).toBe("up27");
  });
  it("year given: exact match only", () => {
    expect(pickNightOccurrenceId(occs, { day: 19, month: 12, year: 2027 }, "2026-11-25")).toBe("up27");
    expect(pickNightOccurrenceId(occs, { day: 19, month: 12, year: 2030 }, "2026-11-25")).toBeNull();
  });
  it("no such night -> null (plain event page)", () => {
    expect(pickNightOccurrenceId(occs, { day: 1, month: 6, year: null }, "2026-11-25")).toBeNull();
    expect(pickNightOccurrenceId([{ occurrenceId: "x", localDate: null }], { day: 1, month: 6, year: null })).toBeNull();
  });
});

describe("/event loader on subdomain hosts (rows 1-6)", () => {
  type Loader = (a: { params: { id: string }; request: Request }) => Promise<unknown>;
  let loader: Loader;
  const OCCS = [{ occurrenceId: "11111111-1111-1111-1111-111111111111", localDate: "2999-12-19T20:00" }];
  const run = async (host: string, id: string, qs = "") => {
    const request = new Request(`https://${host}/event/${id}${qs}`, { headers: { host } });
    try {
      return { data: (await loader({ params: { id }, request })) as { data: Record<string, unknown> } };
    } catch (e) {
      return { thrown: e as Response };
    }
  };
  const WWW = "https://www.bachatacalendar.co.uk/";

  beforeEach(async () => {
    vi.resetAllMocks();
    delete process.env.EVENT_SUBDOMAIN_LINKS;
    resolveMock.mockImplementation(async (ref: string) => (ref === "lounge" ? { id: "22222222-2222-2222-2222-222222222222", slug: "lounge" } : null));
    snapshotMock.mockImplementation(async (_n: string, a: { p_target: { occurrence_id?: string } }) => ({
      data: { event: { name: "Lounge" }, occurrences: OCCS, seenOcc: a.p_target.occurrence_id ?? null },
      error: null,
    }));
    loader = (await import("./../routes/event")).loader as unknown as Loader;
  });

  it("row 1: flag on, label resolves -> event page, canonical is the subdomain", async () => {
    process.env.EVENT_SUBDOMAIN_LINKS = "true";
    const r = await run("lounge.bachatacalendar.co.uk", "lounge");
    expect(r.thrown).toBeUndefined();
    expect(r.data?.data.subdomainLabel).toBe("lounge");
    expect(resolveMock).toHaveBeenCalledWith("lounge", "throw");
  });

  it("row 2: night path -> that night's snapshot", async () => {
    process.env.EVENT_SUBDOMAIN_LINKS = "true";
    const r = await run("lounge.bachatacalendar.co.uk", "lounge", "?night=19-dec");
    expect(r.thrown).toBeUndefined();
    expect(snapshotMock.mock.calls.some(([, a]) => a.p_target.occurrence_id === OCCS[0].occurrenceId)).toBe(true);
  });

  it("row 2: no such night -> plain event page, not a 404", async () => {
    process.env.EVENT_SUBDOMAIN_LINKS = "true";
    const r = await run("lounge.bachatacalendar.co.uk", "lounge", "?night=1-jun");
    expect(r.thrown).toBeUndefined();
    expect(snapshotMock.mock.calls.every(([, a]) => !a.p_target.occurrence_id)).toBe(true);
  });

  it("row 3: unresolved label -> 302 to www home", async () => {
    process.env.EVENT_SUBDOMAIN_LINKS = "true";
    const r = await run("nope.bachatacalendar.co.uk", "nope");
    expect(r.thrown?.status).toBe(302);
    expect(r.thrown?.headers.get("location")).toBe(WWW);
  });

  it("row 4: www.<label> -> 301 to the bare subdomain, same path", async () => {
    process.env.EVENT_SUBDOMAIN_LINKS = "true";
    const a = await run("www.lounge.bachatacalendar.co.uk", "lounge");
    expect(a.thrown?.status).toBe(301);
    expect(a.thrown?.headers.get("location")).toBe("https://lounge.bachatacalendar.co.uk");
    const b = await run("www.lounge.bachatacalendar.co.uk", "lounge", "?night=19-dec");
    expect(b.thrown?.headers.get("location")).toBe("https://lounge.bachatacalendar.co.uk/19-dec");
  });

  it("row 5: flag off (default) -> every label host 302s to www home, no DB read", async () => {
    for (const host of ["lounge.bachatacalendar.co.uk", "www.lounge.bachatacalendar.co.uk"]) {
      const r = await run(host, "lounge");
      expect(r.thrown?.status).toBe(302);
      expect(r.thrown?.headers.get("location")).toBe(WWW);
    }
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it("row 5: www host is untouched with the flag off (D2a row 4)", async () => {
    const r = await run("www.bachatacalendar.co.uk", "lounge");
    expect(r.thrown).toBeUndefined();
    expect(r.data?.data.subdomainLabel).toBeUndefined();
  });

  it("row 6: a www page keeps its www canonical (no subdomainLabel)", async () => {
    const r = await run("www.bachatacalendar.co.uk", "lounge");
    expect(r.data?.data).not.toHaveProperty("subdomainLabel");
  });

  // ---- D2a (brief #2151): www/apex /event/<ref> forwards to the subdomain ----
  const UUID = "22222222-2222-2222-2222-222222222222";
  const OCC = "33333333-3333-3333-3333-333333333333";
  const SUB = "https://lounge.bachatacalendar.co.uk/";
  const resolveAs = (slug: string | null) =>
    resolveMock.mockImplementation(async () => (slug === null ? null : { id: UUID, slug }));

  it("D2a row 1: flag on, www + apex, slug / uuid / old slug -> one 301 to the current slug's subdomain", async () => {
    process.env.EVENT_SUBDOMAIN_LINKS = "true";
    resolveAs("lounge");
    for (const host of ["www.bachatacalendar.co.uk", "bachatacalendar.co.uk"]) {
      for (const ref of ["lounge", UUID, "old-lounge-slug"]) {
        const r = await run(host, ref);
        expect(r.thrown?.status).toBe(301);
        expect(r.thrown?.headers.get("location")).toBe(SUB);
      }
    }
  });

  it("D2a row 2: ?occurrenceId is carried to the subdomain, and the subdomain loader serves it", async () => {
    process.env.EVENT_SUBDOMAIN_LINKS = "true";
    resolveAs("lounge");
    const r = await run("www.bachatacalendar.co.uk", "lounge", `?occurrenceId=${OCC}`);
    expect(r.thrown?.status).toBe(301);
    expect(r.thrown?.headers.get("location")).toBe(`${SUB}?occurrenceId=${OCC}`);
    const sub = await run("lounge.bachatacalendar.co.uk", "lounge", `?occurrenceId=${OCC}`);
    expect(sub.thrown).toBeUndefined();
    expect(snapshotMock.mock.calls.some(([, a]) => a.p_target.occurrence_id === OCC)).toBe(true);
  });

  it("D2a row 3: dashed or reserved current slug -> no forward, page served as today", async () => {
    process.env.EVENT_SUBDOMAIN_LINKS = "true";
    for (const slug of ["lounge-leeds", "admin"]) {
      resolveAs(slug);
      const r = await run("www.bachatacalendar.co.uk", slug);
      expect(r.thrown).toBeUndefined();
      expect(r.data?.data.slug).toBe(slug);
    }
    resolveAs("lounge-leeds");
    const byUuid = await run("www.bachatacalendar.co.uk", UUID);
    expect(byUuid.thrown?.status).toBe(301);
    expect(byUuid.thrown?.headers.get("location")).toBe("/event/lounge-leeds");
  });

  it("D2a row 4: flag off -> www response is today's (page, or the uuid->slug 301)", async () => {
    resolveAs("lounge");
    const page = await run("www.bachatacalendar.co.uk", "lounge");
    expect(page.thrown).toBeUndefined();
    expect(Object.keys(page.data!.data).sort()).toEqual(["dehydratedState", "description", "ogImage", "slug", "title"]);
    const byUuid = await run("www.bachatacalendar.co.uk", UUID);
    expect(byUuid.thrown?.headers.get("location")).toBe("/event/lounge");
  });

  it("D2a row 5: not public -> 404, never a forward", async () => {
    process.env.EVENT_SUBDOMAIN_LINKS = "true";
    resolveAs(null);
    const r = await run("www.bachatacalendar.co.uk", "lounge");
    expect(r.thrown?.status).toBe(404);
  });

  it("D2a traps: the subdomain does not forward to itself; *.vercel.app previews do not forward", async () => {
    process.env.EVENT_SUBDOMAIN_LINKS = "true";
    resolveAs("lounge");
    const sub = await run("lounge.bachatacalendar.co.uk", "lounge");
    expect(sub.thrown).toBeUndefined();
    const preview = await run("bachata-website-git-x.vercel.app", "lounge");
    expect(preview.thrown).toBeUndefined();
  });
});

describe("isSubdomainLabel / isWwwOrApexHost (D2a)", () => {
  it("accepts one lowercase alphanumeric label that is not reserved", () => {
    expect(isSubdomainLabel("bachataloungeleeds")).toBe(true);
    for (const bad of ["lounge-leeds", "Lounge", "", null, undefined, ...RESERVED_LABELS]) {
      expect(isSubdomainLabel(bad as string | null)).toBe(false);
    }
  });
  it("matches only www and the apex", () => {
    expect(isWwwOrApexHost("www.bachatacalendar.co.uk:443")).toBe(true);
    expect(isWwwOrApexHost("bachatacalendar.co.uk")).toBe(true);
    expect(isWwwOrApexHost("x.vercel.app")).toBe(false);
    expect(isWwwOrApexHost("lounge.bachatacalendar.co.uk")).toBe(false);
  });
});

describe("D2a rows 6-7: sitemap loc and cache purge", () => {
  beforeEach(() => {
    delete process.env.EVENT_SUBDOMAIN_LINKS;
  });

  it("row 7: purge adds the absolute subdomain URL only with the flag on and a valid label", async () => {
    const { planCloudflarePurge } = await import("../cloudflarePurge");
    const id = "22222222-2222-2222-2222-222222222222";
    const plan = (slug: string) =>
      planCloudflarePurge([`event-${id}`], { slugFor: async () => slug, activeCitySlugs: async () => [] }, { log: () => {} });
    const off = await plan("lounge");
    expect(off.urls.some((u) => u.includes("lounge.bachatacalendar.co.uk"))).toBe(false);
    process.env.EVENT_SUBDOMAIN_LINKS = "true";
    const on = await plan("lounge");
    expect(on.urls).toContain("https://lounge.bachatacalendar.co.uk/");
    expect(on.urls).toContain("https://www.bachatacalendar.co.uk/event/lounge");
    expect(on.prefixes).toContain("lounge.bachatacalendar.co.uk/");
    const dashed = await plan("lounge-leeds");
    expect(dashed.urls.some((u) => u.includes("lounge-leeds.bachatacalendar"))).toBe(false);
  });

  it("row 6: sitemap locs", async () => {
    vi.resetModules();
    const rpc = async () => ({
      data: [
        { id: "a", slug: "lounge", updated_at: null },
        { id: "b", slug: "lounge-leeds", updated_at: null },
        { id: "c", slug: null, updated_at: null },
      ],
      error: null,
    });
    // Chainable, awaitable empty query: every other sitemap source returns no rows.
    const q: Record<string, unknown> = {};
    for (const m of ["select", "not", "neq", "eq", "order", "limit", "in"]) q[m] = () => q;
    q.then = (res: (v: unknown) => unknown) => res({ data: [], error: null });
    vi.doMock("@/integrations/supabase/client", () => ({ supabase: { rpc, from: () => q } }));
    const { loader } = await import("../routes/sitemap");
    const locs = async () => {
      try {
        const res = (await (loader as unknown as (a: unknown) => Promise<Response>)({})) as Response;
        return [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
      } catch (e) {
        return ["ERR " + String(e)];
      }
    };
    const off = await locs();
    expect(off).toContain("https://www.bachatacalendar.co.uk/event/lounge");
    process.env.EVENT_SUBDOMAIN_LINKS = "true";
    const on = await locs();
    expect(on).toContain("https://lounge.bachatacalendar.co.uk/");
    expect(on).toContain("https://www.bachatacalendar.co.uk/event/lounge-leeds");
    expect(on).toContain("https://www.bachatacalendar.co.uk/event/c");
  });
});
