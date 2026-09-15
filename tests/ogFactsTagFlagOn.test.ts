// The flag-ON half of the ETag/cache-key fold-in (queued_og_branded_card_
// etag_cache_key_work.md) had zero test coverage: both api.og.card.tsx's and
// api.og.bake.tsx's specs mock ogFactsTag away entirely and never set
// OG_BRANDED_CARD_ENABLED='true', so nothing anywhere ever ran the real
// function or watched the real loader/bake route behave differently because
// of it. That is precisely the mechanism this whole PR exists to add -- a
// change that silently broke it (wrong field order, a dropped null-coalesce,
// an off-by-one slice) would have shipped with every other test green.
//
// This file drives the REAL ogFactsTag (a pure function, no I/O) with the
// flag actually on, via vi.resetModules() + dynamic import -- the only way to
// re-evaluate ogCardRender.ts's module-level OG_BRANDED_CARD_ENABLED const
// against a different env value, since it is read once at import time.
// tests/ogBrandedCardLayout.test.ts already established the pattern of
// importing this module for real in a test (there for buildBrandedImageCard);
// this file follows it for ogFactsTag and, for the loader/bake integration
// cases, for OG_BRANDED_CARD_ENABLED alongside it via importOriginal.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/seo/resolvePublicEventRef", () => ({ resolvePublicEventRef: async () => null }));
vi.mock("@/modules/event-page/useFestivalDetailQuery", () => ({ fetchFestivalDetail: async () => null }));

const ENV_KEY = "OG_BRANDED_CARD_ENABLED";
const ORIGINAL = process.env[ENV_KEY];

function restoreEnv() {
  if (ORIGINAL === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = ORIGINAL;
}

afterEach(() => {
  restoreEnv();
  vi.resetModules();
});

describe("ogFactsTag, for real, with the flag on", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env[ENV_KEY] = "true";
  });

  const CARD_A = { title: "Bachata Night", dateLine: "Friday 7 August 2026", venueLine: "at Pulse", eventType: "party" };
  const CARD_B = { title: "Bachata Congress", dateLine: "Friday 7 August 2026", venueLine: "at Pulse", eventType: "party" };

  it("OG_BRANDED_CARD_ENABLED is actually true once the env var is set", async () => {
    const mod = await import("../app/lib/ogCardRender");
    expect(mod.OG_BRANDED_CARD_ENABLED).toBe(true);
  });

  it("returns a 12-char lowercase hex tag for real card data", async () => {
    const { ogFactsTag } = await import("../app/lib/ogCardRender");
    const tag = ogFactsTag(CARD_A);
    expect(tag).toMatch(/^[0-9a-f]{12}$/);
  });

  it("a title change alone busts the tag", async () => {
    const { ogFactsTag } = await import("../app/lib/ogCardRender");
    expect(ogFactsTag(CARD_A)).not.toBe(ogFactsTag(CARD_B));
  });

  it("is stable for the same facts across two independent calls", async () => {
    const { ogFactsTag } = await import("../app/lib/ogCardRender");
    expect(ogFactsTag(CARD_A)).toBe(ogFactsTag({ ...CARD_A }));
  });

  it("still returns empty string for null data even with the flag on", async () => {
    const { ogFactsTag } = await import("../app/lib/ogCardRender");
    expect(ogFactsTag(null)).toBe("");
  });
});

describe("ogFactsTag, for real, with the flag off (control)", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env[ENV_KEY];
  });

  it("returns empty string for real card data", async () => {
    const { ogFactsTag } = await import("../app/lib/ogCardRender");
    const tag = ogFactsTag({ title: "Bachata Night", dateLine: null, venueLine: null, eventType: null });
    expect(tag).toBe("");
  });
});

describe("api.og.card.tsx loader, for real, with the flag on", () => {
  const COVER = "https://cdn.example.com/flyer.jpg";
  const BASE = "https://www.bachatacalendar.co.uk/api/og/card";

  beforeEach(() => {
    vi.resetModules();
    process.env[ENV_KEY] = "true";
  });

  async function loaderWithCardData(data: Record<string, unknown> | null) {
    vi.doMock("../app/lib/ogCardRender", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../app/lib/ogCardRender")>();
      return {
        ...actual,
        buildFallbackCard: async () => Buffer.from("branded-fallback-jpeg"),
        buildImageCard: async () => Buffer.from("cover-jpeg"),
        buildCoverCard: async () => Buffer.from("cover-jpeg"),
        fetchImageBytes: async () => Buffer.from("flyer-bytes"),
        resolveOgEventId: async (param: string) => param,
        fetchEventCardData: async () => data,
        fetchFestivalCardData: async () => data,
      };
    });
    const { loader } = await import("../app/routes/api.og.card");
    return loader;
  }

  it("two entities differing only by title get different etags", async () => {
    const loaderA = await loaderWithCardData({ title: "Bachata Night", dateLine: "Fri", venueLine: "at Pulse", coverUrl: COVER, eventType: "party" });
    const resA = await loaderA({ request: new Request(BASE + "?kind=event&id=evt-1&v=abc") } as unknown as Parameters<typeof loaderA>[0]);
    vi.resetModules();
    const loaderB = await loaderWithCardData({ title: "Bachata Congress", dateLine: "Fri", venueLine: "at Pulse", coverUrl: COVER, eventType: "party" });
    const resB = await loaderB({ request: new Request(BASE + "?kind=event&id=evt-1&v=abc") } as unknown as Parameters<typeof loaderB>[0]);
    expect(resA.headers.get("etag")).toBeTruthy();
    expect(resA.headers.get("etag")).not.toBe(resB.headers.get("etag"));
  });

  it("the same title, unchanged, produces a 304 for a client holding the current etag", async () => {
    const loader = await loaderWithCardData({ title: "Bachata Night", dateLine: "Fri", venueLine: "at Pulse", coverUrl: COVER, eventType: "party" });
    const first = await loader({ request: new Request(BASE + "?kind=event&id=evt-1&v=abc") } as unknown as Parameters<typeof loader>[0]);
    const etag = first.headers.get("etag") as string;
    const second = await loader({
      request: new Request(BASE + "?kind=event&id=evt-1&v=abc", { headers: { "if-none-match": etag } }),
    } as unknown as Parameters<typeof loader>[0]);
    expect(second.status).toBe(304);
  });

  it("a degraded card-data-unavailable response has no etag even though facts would be non-empty for a healthy render", async () => {
    const loader = await loaderWithCardData(null);
    const res = await loader({ request: new Request(BASE + "?kind=event&id=evt-1&v=abc") } as unknown as Parameters<typeof loader>[0]);
    expect(res.headers.get("x-og-fallback")).toBe("card-data-unavailable");
    expect(res.headers.get("etag")).toBeNull();
  });
});

describe("api.og.bake.tsx action, for real, with the flag on", () => {
  const COVER = "https://cdn.example.com/flyer.jpg";
  const EVENT_ID = "0000e780-3fa7-40b2-bbb8-59b66feb8324";

  beforeEach(() => {
    vi.resetModules();
    process.env[ENV_KEY] = "true";
    process.env.OG_BAKE_SECRET = "test-secret";
    vi.stubGlobal("fetch", async (input: unknown) => {
      const url = String(input);
      if (url.indexOf("storage-sign-upload") !== -1) {
        return new Response(
          JSON.stringify({ ok: true, uploadUrl: "https://upload.example/x", publicUrl: "https://pub.example/x.jpg" }),
          { status: 200 },
        );
      }
      if (url === "https://upload.example/x") return new Response(null, { status: 200 });
      if (url.indexOf("/rest/v1/rpc/set_og_image_v1") !== -1) return new Response("{}", { status: 200 });
      throw new Error("unexpected fetch in bake flag-on test: " + url);
    });
  });

  afterEach(() => {
    delete process.env.OG_BAKE_SECRET;
  });

  it("the real ogFactsTag output satisfies the guards real HEALTHY_BAKED_KEY_RE facts-suffix shape", async () => {
    const { ogFactsTag } = await import("../app/lib/ogCardRender");
    const facts = ogFactsTag({ title: "Bachata Night", dateLine: "Fri", venueLine: "at Pulse", eventType: "party" });
    expect(facts).toMatch(/^[0-9a-f]{12}$/);

    const guardSrc = readFileSync(new URL("../scripts/check-og-images.mjs", import.meta.url), "utf8");
    const seg = guardSrc.match(/const UUID_SEG = '([^']+)'/);
    const pat = guardSrc.match(/HEALTHY_BAKED_KEY_RE = new RegExp\(`([^`]+)`/);
    expect(seg).not.toBeNull();
    expect(pat).not.toBeNull();
    const source = (pat as RegExpMatchArray)[1].split("${UUID_SEG}").join((seg as RegExpMatchArray)[1]);
    const healthy = new RegExp(source, "i");
    const coverTag = "a".repeat(16);
    const key = EVENT_ID + "-default-" + coverTag + "-" + facts + ".jpg";
    expect(healthy.test(key)).toBe(true);
  });

  it("a real bake POST with the flag on completes 200, driven by the real ogFactsTag", async () => {
    vi.doMock("../app/lib/ogCardRender", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../app/lib/ogCardRender")>();
      return {
        ...actual,
        buildCoverCard: async () => Buffer.from("cover-jpeg"),
        fetchImageBytes: async () => Buffer.from("flyer-bytes"),
        resolveOgEventId: async (param: string) => param,
        fetchEventCardData: async () => ({ title: "Bachata Night", dateLine: "Fri", venueLine: "at Pulse", coverUrl: COVER, eventType: "party" }),
        fetchFestivalCardData: async () => null,
      };
    });
    const { action } = await import("../app/routes/api.og.bake");
    const request = new Request("https://x/api/og/bake", {
      method: "POST",
      headers: { authorization: "Bearer test-secret", "content-type": "application/json" },
      body: JSON.stringify({ entity_type: "event", entity_id: EVENT_ID }),
    });
    const res = await action({ request } as unknown as Parameters<typeof action>[0]);
    expect(res.status).toBe(200);
  });
});
