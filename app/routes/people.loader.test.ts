import { beforeEach, describe, expect, it, vi } from "vitest";

const snapshot = vi.hoisted(() => vi.fn());
const pageLoad = vi.hoisted(() => vi.fn());
const tagged = vi.hoisted(() => vi.fn((d: unknown, _t: unknown, opts?: unknown) => ({ d, opts })));
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
vi.mock("../cacheTags", () => ({ stampDancer: () => "tag" }));
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
  (loader as unknown as (a: unknown) => Promise<{ d: Record<string, unknown>; opts: unknown }>)({
    params: { id: "ana-g" },
    request: new Request("https://x.test/people/ana-g"),
  });
const person = { id: "p1", name: "Ana", avatarUrl: null, djPhoto: null, roles: ["dancer"] };
const V2 = { extras: {} };

beforeEach(() => {
  snapshot.mockReset(); pageLoad.mockReset(); tagged.mockClear(); notFound.mockClear();
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
