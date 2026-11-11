/**
 * GOLDEN: with no l= in the URL, /api/og/card is BYTE-IDENTICAL to main
 * (contract B1: "mode off must be byte-identical to today"). Two kinds of case:
 *
 *  - TEXT-FREE cases (the flag-off letterbox cards and layout=tall): body
 *    sha256 PINNED. Their expected values were produced by running this file
 *    against main at 4bebd94 (the #1517 merge) with GOLDEN_PRINT=1. They draw
 *    no glyph, so the bytes are the same on every host (Windows and ubuntu CI).
 *  - TEXT-DRAWING cases (the text fallback card, the branded card): NO pinned
 *    hash. Text rasterisation is host-dependent (font hinting / the rasteriser
 *    build behind sharp), so a sha256 pinned on Windows went red on the ubuntu
 *    CI job. Instead the route's bytes are compared, IN THE SAME TEST ON THE
 *    SAME HOST, with main's render path for that case: MAIN_RENDER below is
 *    main's l-less dispatch (app/routes/api.og.card.tsx at 4bebd94) inlined --
 *    the builder it called and the exact arguments -- run through the real
 *    buildFallbackCard / buildCoverCard, whose bodies this PR does not change.
 *    Status, Content-Type, Cache-Control, the edge cache header, ETag, the
 *    fallback / layout markers and the decoded size are still asserted
 *    exactly, from the same main run.
 *
 * Either way a one-byte change to an l-less mode-off card goes red.
 * layout=tall is included only as a refactor-identity check of buildTallCard
 * (the contract's golden excludes ogtest URLs; this is stricter, not looser).
 */
import { describe, it, expect, vi } from "vitest";
import sharp from "sharp";
import { createHash } from "node:crypto";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/seo/resolvePublicEventRef", () => ({ resolvePublicEventRef: async () => null }));
vi.mock("@/modules/event-page/useFestivalDetailQuery", () => ({ fetchFestivalDetail: async () => null }));

const CARD_DATA = {
  title: "Sensual Wednesday", dateLine: "Wednesday 5 November", venueLine: "at The Dance Studio",
  coverUrl: "https://media.bachatacalendar.co.uk/events/covers/flyer.jpg" as string | null, eventType: "party",
};
const io = vi.hoisted(() => ({ coverUrl: "https://media.bachatacalendar.co.uk/events/covers/flyer.jpg" as string | null, bytes: null as Buffer | null }));
// ogCardRender is mocked per case with vi.doMock (see respond): a hoisted
// vi.mock factory is cached across resetModules, which would pin the flag.
const mockRender = () =>
  vi.doMock("../app/lib/ogCardRender", async (importOriginal) => {
    const real = await importOriginal<typeof import("../app/lib/ogCardRender")>();
    return {
      ...real,
      resolveOgEventId: async (p: string) => p,
      fetchEventCardData: async () => ({ ...CARD_DATA, coverUrl: io.coverUrl }),
      fetchFestivalCardData: async () => null,
      fetchImageBytes: async () => io.bytes,
    };
  });

const ID = "c81746db-945b-47af-bdca-501886e105e0";
const BASE = `https://www.bachatacalendar.co.uk/api/og/card?kind=event&id=${ID}&v=flyer.jpg`;

async function flyer(w: number, h: number): Promise<Buffer> {
  const inset = Math.round(Math.min(w, h) * 0.1);
  const mid = await sharp({ create: { width: w - inset * 2, height: h - inset * 2, channels: 3, background: { r: 250, g: 250, b: 250 } } }).png().toBuffer();
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 255, g: 0, b: 255 } } })
    .composite([{ input: mid, left: inset, top: inset }]).jpeg({ quality: 92 }).toBuffer();
}

type Render = typeof import("../app/lib/ogCardRender");
type Case = {
  name: string; flag: boolean; url: string; cover: [number, number] | null; coverUrl?: string | null;
  /** Text-drawing case: main's builder call for it (see the header). */
  main?: (r: Render, cover: Buffer | null) => Promise<Buffer>;
};
const MAIN_FALLBACK = (r: Render) => r.buildFallbackCard(CARD_DATA.title, CARD_DATA.dateLine, CARD_DATA.venueLine);
const MAIN_COVER = (r: Render, cover: Buffer | null) => r.buildCoverCard(cover as Buffer, { ...CARD_DATA });
const CASES: Case[] = [
  { name: "flag off, portrait flyer", flag: false, url: BASE, cover: [1080, 1350] },
  { name: "flag off, wide flyer", flag: false, url: BASE, cover: [1600, 900] },
  { name: "flag off, cover unfetchable", flag: false, url: BASE, cover: null, main: MAIN_FALLBACK },
  { name: "flag off, occurrence", flag: false, url: `${BASE}&occ=5e0c0a43-0000-4000-8000-00000000000a`, cover: [1080, 1080] },
  { name: "flag on, portrait flyer (branded)", flag: true, url: BASE, cover: [1080, 1350], main: MAIN_COVER },
  { name: "flag on, wide flyer (branded)", flag: true, url: BASE, cover: [1600, 900], main: MAIN_COVER },
  { name: "flag on, cover absent", flag: true, url: BASE, cover: null, coverUrl: null, main: MAIN_FALLBACK },
  { name: "layout=tall, portrait (refactor identity)", flag: false, url: `${BASE}&layout=tall`, cover: [1080, 1350] },
];

// Fields: status | sha256[0:32] | length | Cache-Control | Vercel-CDN-Cache-Control | ETag | X-OG-Fallback | X-OG-Layout | Content-Type
// Text-free cases: all nine fields pinned. Text-drawing cases: sha256 and
// length are "*" (host-dependent, compared with main's builder instead); every
// header field is still pinned from the main run.
const GOLDEN: Record<string, string> = {
  "flag off, portrait flyer": "200 | dd41cf2aafa20502f3466e9bb3267aab | 9550 | public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800 | public, s-maxage=31536000, stale-while-revalidate=604800 | \"gJWavL4jL-QCMAzgwQEoqs7z\" | - | - | image/jpeg",
  "flag off, wide flyer": "200 | 161db5fc7d82af6d20a397d68ee2dfa3 | 10286 | public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800 | public, s-maxage=31536000, stale-while-revalidate=604800 | \"gJWavL4jL-QCMAzgwQEoqs7z\" | - | - | image/jpeg",
  "flag off, cover unfetchable": "200 | * | * | public, max-age=3600 | - | - | cover-unfetchable | - | image/jpeg",
  "flag off, occurrence": "200 | 6f226a0a11105e4c0fb5f00285402618 | 9667 | public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800 | public, s-maxage=31536000, stale-while-revalidate=604800 | \"eSwup_IYypIQctS3ZMAhENGn\" | - | - | image/jpeg",
  "flag on, portrait flyer (branded)": "200 | * | * | public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800 | public, s-maxage=31536000, stale-while-revalidate=604800 | \"561E9Gt4Y72LYcTn9a1n68Kd\" | - | - | image/jpeg",
  "flag on, wide flyer (branded)": "200 | * | * | public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800 | public, s-maxage=31536000, stale-while-revalidate=604800 | \"561E9Gt4Y72LYcTn9a1n68Kd\" | - | - | image/jpeg",
  "flag on, cover absent": "200 | * | * | public, max-age=3600 | - | - | cover-absent | - | image/jpeg",
  "layout=tall, portrait (refactor identity)": "200 | c9dc314072bded774cd9e16779f4b629 | 9162 | public, max-age=3600 | - | \"YwPT8r5Ziynt7WpcrpAs5j7B\" | - | - | image/jpeg",
};
// Decoded size of every l-less card on main: the 1200x630 card, except the
// test-only tall card (its own whole-flyer canvas for a 4:5 flyer).
const DECODED: Record<string, string> = Object.fromEntries(CASES.map((c) => [c.name, c.name.startsWith("layout=tall") ? "960x1200" : "1200x630"]));

async function respond(c: Case): Promise<{ row: string; body: Buffer; expected: Buffer | null }> {
  vi.resetModules();
  const before = process.env.OG_BRANDED_CARD_ENABLED;
  process.env.OG_BRANDED_CARD_ENABLED = c.flag ? "true" : "false";
  mockRender();
  const render = await import("../app/lib/ogCardRender");
  expect(render.OG_BRANDED_CARD_ENABLED).toBe(c.flag);
  const { loader } = await import("../app/routes/api.og.card");
  if (before === undefined) delete process.env.OG_BRANDED_CARD_ENABLED;
  else process.env.OG_BRANDED_CARD_ENABLED = before;
  io.coverUrl = c.coverUrl === undefined ? CARD_DATA.coverUrl : c.coverUrl;
  io.bytes = c.cover ? await flyer(c.cover[0], c.cover[1]) : null;
  const res = await loader({ request: new Request(c.url) } as never);
  const body = Buffer.from(await res.arrayBuffer());
  const expected = c.main ? await c.main(render, io.bytes) : null;
  const h = (k: string) => res.headers.get(k) ?? "-";
  const row = [
    res.status,
    c.main ? "*" : createHash("sha256").update(body).digest("hex").slice(0, 32),
    c.main ? "*" : body.length,
    h("Cache-Control"), h("Vercel-CDN-Cache-Control"), h("ETag"), h("X-OG-Fallback"), h("X-OG-Layout"), h("Content-Type"),
  ].join(" | ");
  return { row, body, expected };
}

describe("golden: l-less /api/og/card responses are byte-identical to main", () => {
  it.each(CASES)("$name", async (c) => {
    const { row, body, expected } = await respond(c);
    if (process.env.GOLDEN_PRINT === "1") {
      console.log(`GOLDEN ${JSON.stringify(c.name)}: ${JSON.stringify(row)},`);
      return;
    }
    expect(row).toBe(GOLDEN[c.name]);
    const meta = await sharp(body).metadata();
    expect(`${meta.format} ${meta.width}x${meta.height}`).toBe(`jpeg ${DECODED[c.name]}`);
    if (expected) {
      // Byte equality with main's builder on THIS host; a hash diff is the
      // short failure message, the length the sanity check behind it.
      const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
      expect(body.length, "body length differs from main's render").toBe(expected.length);
      expect(sha(body), "body bytes differ from main's render").toBe(sha(expected));
    }
  });
});
