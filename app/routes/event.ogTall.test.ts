import { describe, it, expect, vi, beforeEach } from "vitest";

// /event/:id?ogtest=tall (docs/briefs/og-tall-card-test.md). Two promises:
//   1. WITHOUT the param, loader data and head are exactly what they were before
//      this change -- for a baked (R2) og:image and a live /api/og/card one.
//   2. WITH it, og:image is the layout=tall card at its real size, and
//      canonical / og:url stay the plain event URL.
// Red on main: the loader never read `ogtest`, so the tall cases failed.

const resolvePublicEventRef = vi.fn();
const rpc = vi.fn();
const resolveOgCardImage = vi.fn();
const resolveOgTallPreview = vi.fn();
vi.mock("@/lib/seo/resolvePublicEventRef", () => ({ resolvePublicEventRef }));
vi.mock("../lib/hiddenEventLookup", () => ({ hiddenEventLifecycle: vi.fn(async () => null) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
vi.mock("@/pages/EventPage", () => ({ default: () => null }));
vi.mock("@/modules/event-page/useFestivalDetailQuery", () => ({
  festivalDetailQueryKey: (id: string) => ["festival-detail", id],
  fetchFestivalDetail: vi.fn(async () => null),
}));
// The REAL taggedData + cacheHeaders, so the response headers below are the
// ones production would send; load() unwraps the payload for the shape tests.
vi.mock("../detailLoader", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../detailLoader")>()),
  resolveOgCardImage,
  // event.tsx now calls the sized resolver; with the mode off (these tests) it
  // is the same URL at the legacy 1200x630, so route it through the URL stub.
  resolveOgCardImageSized: async (o: unknown) => ({
    url: await resolveOgCardImage(o),
    width: 1200,
    height: 630,
    layout: "legacy",
    legacyFallback: false,
  }),
}));
vi.mock("../lib/ogTallPreview.server", () => ({ resolveOgTallPreview, measureWholeFlyerCanvas: vi.fn(async () => null) }));

const ORIGIN = "https://www.bachatacalendar.co.uk";
const SLUG = "sensual-wednesday";
const ID = "c81746db-945b-47af-bdca-501886e105e0";
const BAKED = "https://media.bachatacalendar.co.uk/events/og/c81746db/flyer.jpg";
const LIVE = `${ORIGIN}/api/og/card?kind=event&id=${ID}&v=flyer.jpg`;
const TALL = { url: `${LIVE}&layout=tall`, width: 960, height: 1200 };

type LoaderOut = { data: Record<string, unknown>; init: ResponseInit | null };

async function loadRaw(search: string) {
  const { loader } = await import("./event");
  const request = new Request(`${ORIGIN}/event/${SLUG}${search}`);
  return (await loader({ params: { id: SLUG }, request } as never)) as unknown as LoaderOut;
}

async function load(search: string) {
  return (await loadRaw(search)).data;
}

/** The document response headers the route sends for this request. */
async function responseHeaders(search: string) {
  const out = await loadRaw(search);
  const { headers } = await import("./event");
  return headers({ loaderHeaders: new Headers(out.init?.headers) } as never) as Record<string, string>;
}

/** The head main shipped before this change, verbatim, for a named event. */
function headBefore(ogImage: string) {
  const canonical = `${ORIGIN}/event/${SLUG}`;
  const description = "Bachata event details, line-up and tickets on Bachata Calendar.";
  return [
    { title: "Night — Bachata Calendar" },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: canonical },
    { property: "og:type", content: "website" },
    { property: "og:title", content: "Night" },
    { property: "og:description", content: description },
    { property: "og:url", content: canonical },
    { property: "og:image", content: ogImage },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:type", content: "image/jpeg" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image", content: ogImage },
  ];
}

describe("event route ?ogtest=tall", () => {
  beforeEach(() => {
    resolvePublicEventRef.mockReset().mockResolvedValue({ id: ID, slug: SLUG });
    rpc.mockReset().mockResolvedValue({ data: null, error: null });
    resolveOgCardImage.mockReset();
    resolveOgTallPreview.mockReset().mockResolvedValue(TALL);
  });

  it.each([
    ["baked", BAKED],
    ["live", LIVE],
  ])("without ogtest (%s og:image): no tall lookup, no ogTall key, head unchanged", async (_n, og) => {
    resolveOgCardImage.mockResolvedValue(og);
    const data = await load("");
    expect(resolveOgTallPreview).not.toHaveBeenCalled();
    expect(Object.keys(data).sort()).toEqual(["dehydratedState", "description", "ogImage", "slug", "title"]);
    expect(data.ogImage).toBe(og);

    const { meta } = await import("./event");
    const head = meta({ data: { ...data, title: "Night", description: null } } as never);
    expect(JSON.stringify(head)).toBe(JSON.stringify(headBefore(og)));
  });

  it.each([["?ogtest=wide"], ["?ogtest="], ["?occurrenceId=nope"]])(
    "%s is ignored like no param",
    async (search) => {
      resolveOgCardImage.mockResolvedValue(LIVE);
      const data = await load(search);
      expect(resolveOgTallPreview).not.toHaveBeenCalled();
      expect("ogTall" in data).toBe(false);
    },
  );

  it.each([
    ["baked", BAKED],
    ["live", LIVE],
  ])("with ogtest=tall (%s normally): og:image is the tall card at its real size", async (_n, og) => {
    resolveOgCardImage.mockResolvedValue(og);
    const data = await load("?ogtest=tall");
    expect(resolveOgTallPreview).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: ID, occId: null }),
    );
    expect(data.ogTall).toEqual(TALL);

    const { meta } = await import("./event");
    const head = meta({ data: { ...data, title: "Night", description: null } } as never) as Record<string, string>[];
    const prop = (p: string) => head.find((t) => t.property === p)?.content;
    expect(prop("og:image")).toBe(TALL.url);
    expect(head.find((t) => t.name === "twitter:image")?.content).toBe(TALL.url);
    expect(prop("og:image:width")).toBe("960");
    expect(prop("og:image:height")).toBe("1200");
    expect(prop("og:image:type")).toBe("image/jpeg");
    // canonical + og:url are the plain event URL, never ?ogtest
    expect(prop("og:url")).toBe(`${ORIGIN}/event/${SLUG}`);
    expect(head.find((t) => t.rel === "canonical")?.href).toBe(`${ORIGIN}/event/${SLUG}`);
  });

  it("ogtest=tall but no tall card (no flyer / fetch failed) -> normal head", async () => {
    resolveOgCardImage.mockResolvedValue(LIVE);
    resolveOgTallPreview.mockResolvedValue(null);
    const data = await load("?ogtest=tall");
    expect("ogTall" in data).toBe(false);
    const { meta } = await import("./event");
    const head = meta({ data: { ...data, title: "Night", description: null } } as never);
    expect(JSON.stringify(head)).toBe(JSON.stringify(headBefore(LIVE)));
  });

  it("ogtest=tall lookup that hangs -> page still loads, normal head (budget)", async () => {
    vi.useFakeTimers();
    try {
      resolveOgCardImage.mockResolvedValue(LIVE);
      resolveOgTallPreview.mockReturnValue(new Promise(() => {}));
      const pending = load("?ogtest=tall");
      await vi.advanceTimersByTimeAsync(3000);
      const data = await pending;
      expect("ogTall" in data).toBe(false);
      expect(data.ogImage).toBe(LIVE);
    } finally {
      vi.useRealTimers();
    }
  });
});

// Fix round 1: a ?ogtest=tall miss must not be edge-cached (it would serve the
// normal card to every later tester of that URL) and must say so in a header,
// so a curl -sI before the WhatsApp paste tells "tall" from "fell back".
describe("event route ?ogtest=tall response headers", () => {
  const PLAIN = {
    "Cache-Control": "public, max-age=0, must-revalidate",
    "Vercel-CDN-Cache-Control": expect.stringMatching(/^public, s-maxage=/),
    "Vercel-Cache-Tag": expect.stringContaining(ID),
  };

  beforeEach(() => {
    resolvePublicEventRef.mockReset().mockResolvedValue({ id: ID, slug: SLUG });
    rpc.mockReset().mockResolvedValue({ data: null, error: null });
    resolveOgCardImage.mockReset().mockResolvedValue(LIVE);
    resolveOgTallPreview.mockReset().mockResolvedValue(TALL);
  });

  it.each([[""], ["?ogtest=wide"]])("%s -> today's headers exactly, no X-OG-Tall", async (search) => {
    const h = await responseHeaders(search);
    expect(h).toEqual(PLAIN);
    expect(Object.keys(h).sort()).toEqual(["Cache-Control", "Vercel-CDN-Cache-Control", "Vercel-Cache-Tag"]);
  });

  it("ogtest=tall + tall card -> unchanged cache headers + X-OG-Tall: ok", async () => {
    const plain = await responseHeaders("");
    const h = await responseHeaders("?ogtest=tall");
    expect(h).toEqual({ ...plain, "X-OG-Tall": "ok" });
  });

  it("ogtest=tall + null lookup -> Cache-Control: no-store, no edge caching, X-OG-Tall: miss", async () => {
    resolveOgTallPreview.mockResolvedValue(null);
    const h = await responseHeaders("?ogtest=tall");
    expect(h).toEqual({ "Cache-Control": "no-store", "X-OG-Tall": "miss" });
  });

  it("ogtest=tall + lookup that hangs past the budget -> miss, no-store", async () => {
    vi.useFakeTimers();
    try {
      resolveOgTallPreview.mockReturnValue(new Promise(() => {}));
      const pending = responseHeaders("?ogtest=tall");
      await vi.advanceTimersByTimeAsync(3000);
      expect(await pending).toEqual({ "Cache-Control": "no-store", "X-OG-Tall": "miss" });
    } finally {
      vi.useRealTimers();
    }
  });
});
