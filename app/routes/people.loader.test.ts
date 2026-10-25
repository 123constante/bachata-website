import { beforeEach, describe, expect, it, vi } from "vitest";

const snapshot = vi.hoisted(() => vi.fn());
const pageLoad = vi.hoisted(() => vi.fn());
const tagged = vi.hoisted(() => vi.fn((d: unknown, t: unknown, opts?: unknown) => ({ d, t, opts })));
const flag = vi.hoisted(() => ({ personHub: false }));
const notFound = vi.hoisted(() => vi.fn(() => { throw new Error("404"); }));

vi.mock("@/App", () => ({ createServerQueryClient: () => ({}) }));
vi.mock("@tanstack/react-query", () => ({ dehydrate: () => ({}), HydrationBoundary: () => null }));
vi.mock("@/modules/person-page/PersonPage", () => ({ default: () => null }));
vi.mock("@/modules/person-page/reads", () => ({ loadPersonSnapshot: snapshot }));
vi.mock("@/modules/dancer-app/public-page/loadPublicPage", () => ({
  DEGRADED_EDGE_TTL_SECONDS: 60,
  loadPublicPageV2: pageLoad,
}));
vi.mock("../lib/ssrLoaderTimeout", () => ({ withSsrLoaderTimeout: (_n: string, f: unknown) => f }));
vi.mock("@/lib/featureFlags", () => ({ flags: flag }));
vi.mock("../detailLoader", () => ({
  resolveEntityInLoader: async () => ({ id: "p1", slug: "ana-g" }),
  throwDetailNotFound: notFound,
  cacheHeaders: () => ({}),
  taggedData: tagged,
  redirectUuidToSlug: vi.fn(),
  normalizeOgImage: () => "og",
}));

import { loader } from "./people";

const run = () =>
  (loader as unknown as (a: unknown) => Promise<{ d: Record<string, unknown>; t: string; opts: unknown }>)({
    params: { id: "ana-g" },
    request: new Request("https://x.test/people/ana-g"),
  });
const person = { id: "p1", name: "Ana", avatarUrl: null, djPhoto: null, roles: ["dancer"] };
const V2 = { extras: {}, extrasOk: true };

beforeEach(() => {
  snapshot.mockReset(); pageLoad.mockReset(); tagged.mockClear(); notFound.mockClear(); flag.personHub = false;
  snapshot.mockResolvedValue(person);
});

describe("/people/:id loader: the public page v2 (same read as /dancers/:id)", () => {
  it("flag open: publicPage reaches the page, cached for the full TTL", async () => {
    pageLoad.mockResolvedValue({ page: V2, degraded: false });
    const r = await run();
    expect(pageLoad).toHaveBeenCalledWith("p1");
    expect(r.d.publicPage).toBe(V2);
    expect(r.opts).toBeUndefined();
  });
  it("flag closed: publicPage null (the classic grid)", async () => {
    pageLoad.mockResolvedValue({ page: null, degraded: false });
    const r = await run();
    expect(r.d.publicPage).toBeNull();
    expect(r.opts).toBeUndefined();
  });
  it("degraded read: edge cache bounded to DEGRADED_EDGE_TTL_SECONDS", async () => {
    pageLoad.mockResolvedValue({ page: null, degraded: true });
    expect((await run()).opts).toEqual({ edgeTtlBoundSeconds: 60 });
  });
  it("no public roles -> 404, not a page", async () => {
    pageLoad.mockResolvedValue({ page: V2, degraded: false });
    snapshot.mockResolvedValue({ ...person, roles: [] });
    await expect(run()).rejects.toThrow("404");
  });
});

// S7c: with flags.personHub this page serves the DJ / Teaching tabs, so it is stamped like
// /dancers/:id (a DJ or teacher write purges it), and a partial snapshot (a role read failed) is
// cached briefly. Flag OFF: main's tag and TTL, partial or not. Real stampDancer (import-light).
describe("/people/:id loader: S7c tags and edge TTL", () => {
  const MAIN_TAG = "dancer-p1,dancers";
  const ROLE_TAG = "dancer-p1,dj-p1,teacher-p1,dancers";
  const BOUND = { edgeTtlBoundSeconds: 60 };
  const ROWS = [
    { hub: true, partial: false, degraded: false, tag: ROLE_TAG, opts: undefined },
    { hub: true, partial: true, degraded: false, tag: ROLE_TAG, opts: BOUND },
    { hub: true, partial: false, degraded: true, tag: ROLE_TAG, opts: BOUND },
    { hub: true, partial: true, degraded: true, tag: ROLE_TAG, opts: BOUND },
    { hub: false, partial: false, degraded: false, tag: MAIN_TAG, opts: undefined },
    { hub: false, partial: true, degraded: false, tag: MAIN_TAG, opts: undefined },
    { hub: false, partial: false, degraded: true, tag: MAIN_TAG, opts: BOUND },
    { hub: false, partial: true, degraded: true, tag: MAIN_TAG, opts: BOUND },
  ];
  it.each(ROWS)("personHub $hub, partial $partial, degraded $degraded", async (r) => {
    flag.personHub = r.hub;
    pageLoad.mockResolvedValue({ page: V2, degraded: r.degraded });
    snapshot.mockResolvedValue(r.partial ? { ...person, partial: true } : person);
    const out = await run();
    expect(out.t).toBe(r.tag);
    expect(out.opts).toEqual(r.opts);
  });
});
