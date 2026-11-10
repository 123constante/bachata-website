import { describe, it, expect, vi, beforeEach } from "vitest";

// /event/:id and the whole-flyer card (docs/design/whatsapp-whole-flyer.CONTRACT.md
// D2, D3, B1 test list):
//   - a whole-flyer card changes the head ONLY in og:image*, twitter:image (P6:
//     the page itself is unchanged), and declares the card's real size;
//   - a legacy card leaves the loader data keys and the head exactly as before;
//   - a measure miss makes the PAGE response no-store + X-OG-Layout: legacy-fallback;
//   - ?ogtest=whole-flyer forces the layout only when the mode is not off.
// The resolver itself is the real code in tests/ogWholeFlyerReadRule.test.ts;
// here it is stubbed so the route wiring is what is under test.

const resolvePublicEventRef = vi.fn();
const rpc = vi.fn();
const resolveOgCardImageSized = vi.fn();
vi.mock("@/lib/seo/resolvePublicEventRef", () => ({ resolvePublicEventRef }));
vi.mock("../app/lib/hiddenEventLookup", () => ({ hiddenEventLifecycle: vi.fn(async () => null) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
vi.mock("@/pages/EventPage", () => ({ default: () => null }));
vi.mock("@/modules/event-page/useFestivalDetailQuery", () => ({
  festivalDetailQueryKey: (id: string) => ["festival-detail", id],
  fetchFestivalDetail: vi.fn(async () => null),
}));
vi.mock("../app/detailLoader", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/detailLoader")>()),
  resolveOgCardImageSized,
}));
vi.mock("../app/lib/ogTallPreview.server", () => ({
  resolveOgTallPreview: vi.fn(async () => null),
  measureWholeFlyerCanvas: vi.fn(async () => ({ width: 960, height: 1200 })),
}));

const ORIGIN = "https://www.bachatacalendar.co.uk";
const SLUG = "sensual-wednesday";
const ID = "c81746db-945b-47af-bdca-501886e105e0";
const LIVE = `${ORIGIN}/api/og/card?kind=event&id=${ID}&v=flyer.jpg`;
const WF = `${LIVE}&l=wf1&s=960x1200`;

type LoaderOut = { data: Record<string, unknown>; init: ResponseInit | null };

async function route(mode = "off") {
  vi.resetModules();
  vi.stubEnv("OG_WHOLE_FLYER_MODE", mode);
  // allowlist with no ids behaves as off (D3), so every mode gets one id.
  vi.stubEnv("OG_WHOLE_FLYER_EVENT_IDS", ID);
  const mod = await import("../app/routes/event");
  vi.unstubAllEnvs();
  return mod;
}

async function run(search = "", mode = "off") {
  const mod = await route(mode);
  const request = new Request(`${ORIGIN}/event/${SLUG}${search}`);
  const out = (await mod.loader({ params: { id: SLUG }, request } as never)) as unknown as LoaderOut;
  const headers = mod.headers({ loaderHeaders: new Headers(out.init?.headers) } as never) as Record<string, string>;
  const head = mod.meta({ data: { ...out.data, title: "Night", description: null } } as never) as Record<string, string>[];
  return { data: out.data, headers, head };
}

const card = (url: string, width: number, height: number, legacyFallback = false) => ({
  url, width, height, layout: width === 1200 ? "legacy" : "wf1", legacyFallback,
});

beforeEach(() => {
  resolvePublicEventRef.mockReset().mockResolvedValue({ id: ID, slug: SLUG });
  rpc.mockReset().mockResolvedValue({ data: null, error: null });
  resolveOgCardImageSized.mockReset();
});

describe("event page and the whole-flyer card", () => {
  it("legacy card: loader keys and declared size exactly as before", async () => {
    resolveOgCardImageSized.mockResolvedValue(card(LIVE, 1200, 630));
    const { data, headers, head } = await run();
    expect(Object.keys(data).sort()).toEqual(["dehydratedState", "description", "ogImage", "slug", "title"]);
    expect(data.ogImage).toBe(LIVE);
    expect(headers["X-OG-Layout"]).toBeUndefined();
    const prop = (p: string) => head.find((t) => t.property === p)?.content;
    expect([prop("og:image:width"), prop("og:image:height")]).toEqual(["1200", "630"]);
  });

  it("whole-flyer card differs from the legacy page ONLY in og:image* and twitter:image", async () => {
    resolveOgCardImageSized.mockResolvedValue(card(LIVE, 1200, 630));
    const off = await run();
    resolveOgCardImageSized.mockResolvedValue(card(WF, 960, 1200));
    const on = await run("", "on");
    const strip = (h: Record<string, string>[]) =>
      h.filter((t) => !String(t.property ?? "").startsWith("og:image") && t.name !== "twitter:image");
    expect(JSON.stringify(strip(on.head))).toBe(JSON.stringify(strip(off.head)));
    const prop = (h: Record<string, string>[], p: string) => h.find((t) => t.property === p)?.content;
    expect(prop(on.head, "og:image")).toBe(WF);
    expect([prop(on.head, "og:image:width"), prop(on.head, "og:image:height")]).toEqual(["960", "1200"]);
    expect(on.head.find((t) => t.name === "twitter:image")?.content).toBe(WF);
    expect(on.data.ogImageSize).toEqual({ width: 960, height: 1200 });
    // A healthy whole-flyer page keeps the normal edge policy.
    expect(on.headers["X-OG-Layout"]).toBeUndefined();
    expect(on.headers["Cache-Control"]).toBe(off.headers["Cache-Control"]);
  });

  it("measure miss: legacy URL at 1200x630, page response no-store + X-OG-Layout: legacy-fallback", async () => {
    resolveOgCardImageSized.mockResolvedValue(card(LIVE, 1200, 630, true));
    const { data, headers, head } = await run("", "on");
    expect("ogImageSize" in data).toBe(false);
    expect(headers["Cache-Control"]).toBe("no-store");
    expect(headers["X-OG-Layout"]).toBe("legacy-fallback");
    expect(head.find((t) => t.property === "og:image:width")?.content).toBe("1200");
  });

  it("the page measure passed in is the card resolver's (measureWholeFlyerCanvas), not the page cover", async () => {
    resolveOgCardImageSized.mockResolvedValue(card(LIVE, 1200, 630));
    await run("", "on");
    const opts = resolveOgCardImageSized.mock.calls[0][0];
    expect(await opts.measureWholeFlyer()).toEqual({ width: 960, height: 1200 });
    const { measureWholeFlyerCanvas } = await import("../app/lib/ogTallPreview.server");
    expect(measureWholeFlyerCanvas).toHaveBeenCalledWith(ID, null);
  });

  it.each([
    ["off", undefined],
    ["test", "wf1"],
    ["allowlist", "wf1"],
    ["on", "wf1"],
  ])("?ogtest=whole-flyer in mode %s -> forceLayout %s", async (mode, want) => {
    resolveOgCardImageSized.mockResolvedValue(card(LIVE, 1200, 630));
    await run("?ogtest=whole-flyer", mode);
    expect(resolveOgCardImageSized.mock.calls[0][0].forceLayout).toBe(want);
  });

  it("no ogtest param never forces a layout", async () => {
    resolveOgCardImageSized.mockResolvedValue(card(LIVE, 1200, 630));
    await run("", "test");
    expect(resolveOgCardImageSized.mock.calls[0][0].forceLayout).toBeUndefined();
  });
});
