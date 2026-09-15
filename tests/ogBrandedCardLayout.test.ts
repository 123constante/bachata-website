// The branded OG card's layout, rendered FOR REAL against the repo's own Inter.
//
// Why this file exists. The branded card shipped with 263 lines of new render
// logic and no test of its own: the two route specs beside it mock
// buildCoverCard away, so neither ever reached the renderer. Review then found
// two ways the layout could hand sharp a layer wider than the canvas, and
// sharp's composite THROWS on that rather than clipping -- a render-error
// redirect on /api/og/card, and on /api/og/bake a 500 that increments
// `attempts`. _og_sweep selects `attempts < 5` and _og_enqueue resets it only
// on a changed cover hash, so five of those retire an entity from the bake
// pipeline until someone re-uploads its flyer. That is the cost this file is
// standing in front of.
//
// It measures rather than mocks. The whole class of defect here was a
// CHARACTER ESTIMATE disagreeing with the rendered pixels, so a test that
// stubbed the text renderer would assert the estimate and prove nothing --
// which is how the estimate got shipped. The fonts are the real .ttf files, the
// cover is a real image, and the assertion is on the real JPEG that comes out.
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

// ogCardRender imports the Supabase client and two page-model modules at the
// top level for its FETCHERS. None of them is reachable from
// buildBrandedImageCard, which takes an already-fetched buffer and plain
// strings -- so they are stubbed to keep this a pure render test that needs no
// database and no .env.
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/lib/seo/resolvePublicEventRef', () => ({ resolvePublicEventRef: async () => null }));
vi.mock('@/modules/event-page/useFestivalDetailQuery', () => ({ fetchFestivalDetail: async () => null }));

const FONT_DIR = join(process.cwd(), 'app', 'lib', 'ogCardFonts');

// materializeFont() fetches the hashed Vite asset URL from the deployed origin
// and writes it to /tmp. Off a deployment there is no origin to fetch from, so
// the .ttf request is served from the working tree instead. Any other URL is a
// mistake in this test rather than something to paper over, so it rejects.
beforeAll(() => {
  vi.stubGlobal('fetch', async (input: unknown) => {
    const url = String(input);
    if (!url.endsWith('.ttf')) throw new Error(`unexpected fetch in a render test: ${url}`);
    const name = url.includes('SemiBold') ? 'Inter-SemiBold.ttf' : 'Inter-Regular.ttf';
    const bytes = await readFile(join(FONT_DIR, name));
    return new Response(bytes, { status: 200 });
  });
});

/** A portrait cover, which is the shape the square crop actually has to cope
 *  with: a flyer, not a 16:9 still. */
async function portraitCover(): Promise<Buffer> {
  return sharp({
    create: { width: 1000, height: 1500, channels: 3, background: { r: 120, g: 40, b: 160 } },
  }).jpeg().toBuffer();
}

/** Everything check-og-images.mjs asserts about the bytes, plus the frame the
 *  three hardcoded og:image:width/height tags promise. A card that renders but
 *  is 1208px wide, or 340KB, is not a pass. */
async function expectAValidCard(buf: Buffer): Promise<void> {
  const meta = await sharp(buf).metadata();
  expect(meta.format).toBe('jpeg');
  expect(meta.width).toBe(1200);
  expect(meta.height).toBe(630);
  expect(buf.length).toBeLessThanOrEqual(300 * 1024);
}

describe('buildBrandedImageCard layout', () => {
  // The two inputs review PROVED broke the old estimate-driven layout. They are
  // named here so a future change that reintroduces the estimate fails on the
  // exact strings that caught it, not on a case someone invented afterwards.
  const UNBROKEN_TOKEN = 'A'.repeat(64);
  const LADDER_DIVERGES = 'SUMMER BACHATA SENSUAL CONGRESS LONDON';

  it('renders a 1200x630 JPEG for an ordinary event', async () => {
    const { buildBrandedImageCard } = await import('../app/lib/ogCardRender');
    const card = await buildBrandedImageCard(
      await portraitCover(),
      'Bachata Social at The Dance Studio',
      'Friday 3 October',
      'at The Dance Studio',
      'party',
    );
    await expectAValidCard(card);
  });

  // The crash case. A single token longer than the box cannot be wrapped, only
  // broken; the old wrap returned it whole and composite threw. 64 characters
  // is inside the 90-char truncate, so nothing upstream clips it first.
  it('survives a title that is one unbroken 64-character token', async () => {
    const { buildBrandedImageCard } = await import('../app/lib/ogCardRender');
    const card = await buildBrandedImageCard(
      await portraitCover(), UNBROKEN_TOKEN, 'Saturday 4 October', 'at The Dance Studio', 'party',
    );
    await expectAValidCard(card);
  });

  // The non-converging ladder. Measured against this repo's Inter, the three
  // rungs came out 659 / 574 / 686px against a 562px box -- the LAST rung wider
  // than the middle one, and accepted unconditionally.
  it('survives the title whose size ladder diverged', async () => {
    const { buildBrandedImageCard } = await import('../app/lib/ogCardRender');
    const card = await buildBrandedImageCard(
      await portraitCover(), LADDER_DIVERGES, 'Sunday 5 October', 'at The Dance Studio', 'festival',
    );
    await expectAValidCard(card);
  });

  it('renders with no venue and no event type', async () => {
    const { buildBrandedImageCard } = await import('../app/lib/ogCardRender');
    const card = await buildBrandedImageCard(
      await portraitCover(), 'Bachata Social', 'Friday 3 October', null, null,
    );
    await expectAValidCard(card);
  });

  it('renders with no date, no venue and an unknown event type', async () => {
    const { buildBrandedImageCard } = await import('../app/lib/ogCardRender');
    const card = await buildBrandedImageCard(
      await portraitCover(), 'Bachata Social', null, null, 'something-new',
    );
    await expectAValidCard(card);
  });

  // A long venue is the meta line's version of the same defect: its old clip
  // was a proportional character guess and could land over the box too.
  it('survives a very long venue name', async () => {
    const { buildBrandedImageCard } = await import('../app/lib/ogCardRender');
    const card = await buildBrandedImageCard(
      await portraitCover(),
      'Bachata Social',
      'Friday 3 October',
      `at ${'The Extremely Long Dance Studio Name '.repeat(4)}`,
      'class',
    );
    await expectAValidCard(card);
  });
});

// The clamp is the SECOND layer, and mutation is what proved it needed its own
// test: with wrapMeasured intact, deleting the clamp call left the suite above
// 9/9 green. That is the signature of a defence nothing exercises, which reads
// exactly like a defence that does not work. So it is driven here directly,
// with the oversized layer the layout can no longer produce.
describe('clampToCanvas', () => {
  const solid = (w: number, h: number) =>
    sharp({ create: { width: w, height: h, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } })
      .png().toBuffer();

  it('shrinks a layer wider than the canvas instead of letting composite throw', async () => {
    const { clampToCanvas } = await import('../app/lib/ogCardRender');
    const clamped = await clampToCanvas([{ input: await solid(1400, 200), left: 0, top: 0 }]);
    expect(clamped).toHaveLength(1);
    const meta = await sharp(clamped[0].input).metadata();
    expect(meta.width).toBeLessThanOrEqual(1200);
    expect(meta.height).toBeLessThanOrEqual(630);
  });

  it('accounts for the layer origin, not just the canvas size', async () => {
    const { clampToCanvas } = await import('../app/lib/ogCardRender');
    // 800px wide at left=900 overhangs by 500 even though 800 < 1200. A clamp
    // that compared against the canvas alone would pass this straight through.
    const clamped = await clampToCanvas([{ input: await solid(800, 100), left: 900, top: 0 }]);
    const meta = await sharp(clamped[0].input).metadata();
    expect((meta.width ?? 0) + 900).toBeLessThanOrEqual(1200);
  });

  it('drops a layer whose origin is already off the canvas', async () => {
    const { clampToCanvas } = await import('../app/lib/ogCardRender');
    const clamped = await clampToCanvas([
      { input: await solid(50, 50), left: 1200, top: 0 },
      { input: await solid(50, 50), left: 0, top: 630 },
    ]);
    expect(clamped).toHaveLength(0);
  });

  it('leaves a layer that already fits untouched, bytes included', async () => {
    const { clampToCanvas } = await import('../app/lib/ogCardRender');
    const input = await solid(100, 100);
    const clamped = await clampToCanvas([{ input, left: 10, top: 20 }]);
    expect(clamped).toEqual([{ input, left: 10, top: 20 }]);
  });

  // The control: the clamped output must actually be compositable. Asserting
  // the dimensions alone would pass for an output sharp still rejects, which is
  // the only thing this function exists to prevent.
  it('produces layers a real composite accepts', async () => {
    const { clampToCanvas } = await import('../app/lib/ogCardRender');
    const clamped = await clampToCanvas([
      { input: await solid(1400, 900), left: 0, top: 0 },
      { input: await solid(800, 100), left: 900, top: 600 },
    ]);
    const out = await sharp({
      create: { width: 1200, height: 630, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
    }).composite(clamped).jpeg().toBuffer();
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(630);
  });
});

describe('ogPillLabel', () => {
  it('maps party to PARTY, never the word this repo bans', async () => {
    const { ogPillLabel } = await import('../app/lib/ogCardRender');
    // check-no-social-word.mjs scans src/ only and matches title-case, so it is
    // blind to this file on both axes -- the rule is asserted here instead of
    // assumed. New dancers do not know what a 'social' is.
    expect(ogPillLabel('party')).toBe('PARTY');
    expect(ogPillLabel('party')).not.toMatch(/social/i);
  });

  it('is case and whitespace insensitive', async () => {
    const { ogPillLabel } = await import('../app/lib/ogCardRender');
    expect(ogPillLabel('  FESTIVAL  ')).toBe('FESTIVAL');
  });

  it('shows no pill rather than a raw token for standard, unknown or null', async () => {
    const { ogPillLabel } = await import('../app/lib/ogCardRender');
    expect(ogPillLabel('standard')).toBeNull();
    expect(ogPillLabel('some-new-category')).toBeNull();
    expect(ogPillLabel(null)).toBeNull();
    expect(ogPillLabel('')).toBeNull();
  });
});
