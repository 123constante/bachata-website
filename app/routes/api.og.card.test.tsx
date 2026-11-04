// Pins the cache decision of /api/og/card for EVERY loader outcome
// (docs/ops/vercel-cpu-cuts-2026-11-04.md, slice 1). The render path
// (sharp, fonts, Supabase) is faked: only the headers are under test.
//
// The one edge directive: a HEALTHY 200 card states its shared-cache lifetime
// on Vercel-CDN-Cache-Control as well as in Cache-Control, so a later change to
// the browser header cannot silently shorten the CDN window. Nothing else
// (degraded card, 302, 304, render-error) carries an edge directive.
import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  resolveId: vi.fn<(id: string) => Promise<string | null>>(),
  eventData: vi.fn<() => Promise<unknown>>(),
  festivalData: vi.fn<() => Promise<unknown>>(),
  imageBytes: vi.fn<() => Promise<Buffer | null>>(),
  coverCard: vi.fn<() => Promise<Buffer>>(),
  allowed: vi.fn<(src: string) => boolean>(),
}));

vi.mock("../lib/ogCardRender", () => ({
  OG_BRANDED_CARD_ENABLED: false,
  ogFactsTag: () => "facts",
  resolveOgEventId: fake.resolveId,
  fetchEventCardData: fake.eventData,
  fetchFestivalCardData: fake.festivalData,
  fetchImageBytes: fake.imageBytes,
  buildCoverCard: fake.coverCard,
  buildImageCard: async () => Buffer.from("image-card"),
  buildFallbackCard: async () => Buffer.from("fallback-card"),
}));
vi.mock("../lib/ogImageSourceAllowlist", () => ({ isAllowedOgImageSource: fake.allowed }));

import { loader } from "./api.og.card";

const CACHE_OK = "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800";
const EDGE_OK = "public, s-maxage=31536000, stale-while-revalidate=604800";
const CARD = { title: "T", dateLine: "D", venueLine: "V", coverUrl: "https://img.example/c.jpg" };
const SRC = "https://img.example/src.jpg";

type World = {
  resolves?: boolean;
  data?: "ok" | "none" | "no-cover";
  cover?: boolean;
  srcAllowed?: boolean;
  srcBytes?: boolean;
  throws?: boolean;
};

function setWorld(w: World): void {
  fake.resolveId.mockResolvedValue(w.resolves === false ? null : "uuid-1");
  const data = w.data === "none" ? null : w.data === "no-cover" ? { ...CARD, coverUrl: null } : CARD;
  fake.eventData.mockResolvedValue(data);
  fake.festivalData.mockResolvedValue(data);
  fake.allowed.mockReturnValue(w.srcAllowed !== false);
  fake.imageBytes.mockImplementation(async () => {
    if (w.throws) throw new Error("boom");
    return (w.cover === false || w.srcBytes === false) ? null : Buffer.from("bytes");
  });
  fake.coverCard.mockResolvedValue(Buffer.from("cover-card"));
}

type Row = {
  name: string;
  query: string;
  world: World;
  status: number;
  cache: string | null;
  edge: string | null;
  etag: boolean;
  fallback: string | null;
};

const ROWS: Row[] = [
  { name: "healthy event card", query: "kind=event&id=e1", world: {}, status: 200, cache: CACHE_OK, edge: EDGE_OK, etag: true, fallback: null },
  { name: "healthy event card with occ + v", query: "kind=event&id=e1&occ=2026-11-05&v=abc", world: {}, status: 200, cache: CACHE_OK, edge: EDGE_OK, etag: true, fallback: null },
  { name: "healthy festival card", query: "kind=festival&id=f1", world: {}, status: 200, cache: CACHE_OK, edge: EDGE_OK, etag: true, fallback: null },
  { name: "kind=image ok", query: `kind=image&src=${encodeURIComponent(SRC)}`, world: {}, status: 200, cache: CACHE_OK, edge: EDGE_OK, etag: true, fallback: null },
  { name: "card-data-unavailable", query: "kind=event&id=e1", world: { data: "none" }, status: 200, cache: "public, max-age=300", edge: null, etag: false, fallback: "card-data-unavailable" },
  { name: "cover-unfetchable", query: "kind=event&id=e1", world: { cover: false }, status: 200, cache: "public, max-age=3600", edge: null, etag: false, fallback: "cover-unfetchable" },
  { name: "cover-absent", query: "kind=event&id=e1", world: { data: "no-cover" }, status: 200, cache: "public, max-age=3600", edge: null, etag: false, fallback: "cover-absent" },
  { name: "image-missing-src", query: "kind=image", world: {}, status: 302, cache: "public, max-age=300", edge: null, etag: false, fallback: "image-missing-src" },
  { name: "image-source-unfetchable", query: `kind=image&src=${encodeURIComponent(SRC)}`, world: { srcBytes: false }, status: 302, cache: "public, max-age=300", edge: null, etag: false, fallback: "image-source-unfetchable" },
  { name: "image-source-disallowed", query: "kind=image&src=https%3A%2F%2Fevil.example%2Fx.jpg", world: { srcAllowed: false }, status: 302, cache: "public, max-age=300", edge: null, etag: false, fallback: "image-source-disallowed" },
  { name: "missing-id", query: "kind=event", world: {}, status: 302, cache: "public, max-age=300", edge: null, etag: false, fallback: "missing-id" },
  { name: "unresolvable-id", query: "kind=event&id=nope", world: { resolves: false }, status: 302, cache: "public, max-age=300", edge: null, etag: false, fallback: "unresolvable-id" },
  { name: "render-error", query: "kind=event&id=e1", world: { throws: true }, status: 302, cache: "no-store", edge: null, etag: false, fallback: "render-error" },
];

function call(query: string, headers: Record<string, string> = {}): Promise<Response> {
  const request = new Request(`https://www.bachatacalendar.co.uk/api/og/card?${query}`, { headers });
  return loader({ request } as Parameters<typeof loader>[0]);
}

describe("/api/og/card cache decision per outcome", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(ROWS)("$name -> $status, Cache-Control + edge directive pinned", async (row) => {
    setWorld(row.world);
    const res = await call(row.query);
    expect(res.status).toBe(row.status);
    expect(res.headers.get("Cache-Control")).toBe(row.cache);
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBe(row.edge);
    expect(res.headers.has("ETag")).toBe(row.etag);
    expect(res.headers.get("X-OG-Fallback")).toBe(row.fallback);
    expect(res.headers.has("Set-Cookie")).toBe(false);
    if (row.status === 302) {
      expect(res.headers.get("Location")).toBe("https://www.bachatacalendar.co.uk/og-image.jpg");
    }
  });

  it("only the healthy 200 rows carry an edge directive", () => {
    const withEdge = ROWS.filter((r) => r.edge !== null);
    expect(withEdge.every((r) => r.status === 200 && r.fallback === null && r.cache === CACHE_OK)).toBe(true);
    expect(withEdge.length).toBe(4);
  });

  it.each([
    ["event", "kind=event&id=e1&v=abc"],
    ["image", `kind=image&src=${encodeURIComponent(SRC)}`],
  ])("a matching If-None-Match on a %s card answers 304 with no edge directive", async (_kind, query) => {
    setWorld({});
    const first = await call(query);
    const etag = first.headers.get("ETag");
    expect(etag).toBeTruthy();
    const res = await call(query, { "if-none-match": etag as string });
    expect(res.status).toBe(304);
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBeNull();
    expect(res.headers.has("Set-Cookie")).toBe(false);
  });

  it("the ETag keys on the full query: a changed v= is a different validator", async () => {
    setWorld({});
    const a = (await call("kind=event&id=e1&v=one")).headers.get("ETag");
    const b = (await call("kind=event&id=e1&v=two")).headers.get("ETag");
    expect(a).not.toBe(b);
  });

  it("a stale If-None-Match still renders the full healthy card", async () => {
    setWorld({});
    const res = await call("kind=event&id=e1", { "if-none-match": '"stale"' });
    expect(res.status).toBe(200);
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBe(EDGE_OK);
  });
});
