/**
 * GOLDEN: with no l= in the URL, /api/og/card is BYTE-IDENTICAL to main
 * (contract B1: "mode off must be byte-identical to today"). Every expected
 * value below was produced by running THIS file against main at 4bebd94 (the
 * #1517 merge) with GOLDEN_PRINT=1, then pinned. Body sha256, status and the
 * cache/etag/marker headers of each existing card case, flag off and flag on.
 * layout=tall is included only as a refactor-identity check of buildTallCard
 * (the contract's golden excludes ogtest URLs; this is stricter, not looser).
 */
import { describe, it, expect, vi } from "vitest";
import sharp from "sharp";
import { createHash } from "node:crypto";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/seo/resolvePublicEventRef", () => ({ resolvePublicEventRef: async () => null }));
vi.mock("@/modules/event-page/useFestivalDetailQuery", () => ({ fetchFestivalDetail: async () => null }));

const io = vi.hoisted(() => ({ coverUrl: "https://media.bachatacalendar.co.uk/events/covers/flyer.jpg" as string | null, bytes: null as Buffer | null }));
// ogCardRender is mocked per case with vi.doMock (see snapshot): a hoisted
// vi.mock factory is cached across resetModules, which would pin the flag.
const mockRender = () =>
  vi.doMock("../app/lib/ogCardRender", async (importOriginal) => {
    const real = await importOriginal<typeof import("../app/lib/ogCardRender")>();
    return {
      ...real,
      resolveOgEventId: async (p: string) => p,
      fetchEventCardData: async () => ({
        title: "Sensual Wednesday", dateLine: "Wednesday 5 November", venueLine: "at The Dance Studio",
        coverUrl: io.coverUrl, eventType: "party",
      }),
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

type Case = { name: string; flag: boolean; url: string; cover: [number, number] | null; coverUrl?: string | null };
const CASES: Case[] = [
  { name: "flag off, portrait flyer", flag: false, url: BASE, cover: [1080, 1350] },
  { name: "flag off, wide flyer", flag: false, url: BASE, cover: [1600, 900] },
  { name: "flag off, cover unfetchable", flag: false, url: BASE, cover: null },
  { name: "flag off, occurrence", flag: false, url: `${BASE}&occ=5e0c0a43-0000-4000-8000-00000000000a`, cover: [1080, 1080] },
  { name: "flag on, portrait flyer (branded)", flag: true, url: BASE, cover: [1080, 1350] },
  { name: "flag on, wide flyer (branded)", flag: true, url: BASE, cover: [1600, 900] },
  { name: "flag on, cover absent", flag: true, url: BASE, cover: null, coverUrl: null },
  { name: "layout=tall, portrait (refactor identity)", flag: false, url: `${BASE}&layout=tall`, cover: [1080, 1350] },
];

const GOLDEN: Record<string, string> = {
  "flag off, portrait flyer": "200 | dd41cf2aafa20502f3466e9bb3267aab | 9550 | public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800 | public, s-maxage=31536000, stale-while-revalidate=604800 | \"gJWavL4jL-QCMAzgwQEoqs7z\" | - | - | image/jpeg",
  "flag off, wide flyer": "200 | 161db5fc7d82af6d20a397d68ee2dfa3 | 10286 | public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800 | public, s-maxage=31536000, stale-while-revalidate=604800 | \"gJWavL4jL-QCMAzgwQEoqs7z\" | - | - | image/jpeg",
  "flag off, cover unfetchable": "200 | 216aeecea4f6e767958dfdd08fefcc61 | 17762 | public, max-age=3600 | - | - | cover-unfetchable | - | image/jpeg",
  "flag off, occurrence": "200 | 6f226a0a11105e4c0fb5f00285402618 | 9667 | public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800 | public, s-maxage=31536000, stale-while-revalidate=604800 | \"eSwup_IYypIQctS3ZMAhENGn\" | - | - | image/jpeg",
  "flag on, portrait flyer (branded)": "200 | 83e1d5f603fb07ef126142c8738fb919 | 22006 | public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800 | public, s-maxage=31536000, stale-while-revalidate=604800 | \"561E9Gt4Y72LYcTn9a1n68Kd\" | - | - | image/jpeg",
  "flag on, wide flyer (branded)": "200 | d66a1bbb69edcbfd39c16826f1f09dcc | 20628 | public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800 | public, s-maxage=31536000, stale-while-revalidate=604800 | \"561E9Gt4Y72LYcTn9a1n68Kd\" | - | - | image/jpeg",
  "flag on, cover absent": "200 | 216aeecea4f6e767958dfdd08fefcc61 | 17762 | public, max-age=3600 | - | - | cover-absent | - | image/jpeg",
  "layout=tall, portrait (refactor identity)": "200 | c9dc314072bded774cd9e16779f4b629 | 9162 | public, max-age=3600 | - | \"YwPT8r5Ziynt7WpcrpAs5j7B\" | - | - | image/jpeg",
};

async function snapshot(c: Case): Promise<string> {
  vi.resetModules();
  const before = process.env.OG_BRANDED_CARD_ENABLED;
  process.env.OG_BRANDED_CARD_ENABLED = c.flag ? "true" : "false";
  mockRender();
  const render = await import("../app/lib/ogCardRender");
  expect(render.OG_BRANDED_CARD_ENABLED).toBe(c.flag);
  const { loader } = await import("../app/routes/api.og.card");
  if (before === undefined) delete process.env.OG_BRANDED_CARD_ENABLED;
  else process.env.OG_BRANDED_CARD_ENABLED = before;
  io.coverUrl = c.coverUrl === undefined ? "https://media.bachatacalendar.co.uk/events/covers/flyer.jpg" : c.coverUrl;
  io.bytes = c.cover ? await flyer(c.cover[0], c.cover[1]) : null;
  const res = await loader({ request: new Request(c.url) } as never);
  const body = Buffer.from(await res.arrayBuffer());
  const h = (k: string) => res.headers.get(k) ?? "-";
  return [
    res.status, createHash("sha256").update(body).digest("hex").slice(0, 32), body.length,
    h("Cache-Control"), h("Vercel-CDN-Cache-Control"), h("ETag"), h("X-OG-Fallback"), h("X-OG-Layout"), h("Content-Type"),
  ].join(" | ");
}

describe("golden: l-less /api/og/card responses are byte-identical to main", () => {
  it.each(CASES)("$name", async (c) => {
    const got = await snapshot(c);
    if (process.env.GOLDEN_PRINT === "1") {
      console.log(`GOLDEN ${JSON.stringify(c.name)}: ${JSON.stringify(got)},`);
      return;
    }
    expect(got).toBe(GOLDEN[c.name]);
  });
});
