// @vitest-environment node
/**
 * OG cards must render with NO network for fonts (incident 2026-11-04).
 *
 * Prod: every /api/og/card answered 302 -> /og-image.jpg with
 * X-OG-Fallback: render-error, because materializeFont() fetched the two Inter
 * .ttf files from https://www.bachatacalendar.co.uk/assets/... on every cold
 * start and that connect timed out (ConnectTimeoutError, 10000ms). One stalled
 * round trip to our own edge took down every share preview.
 *
 * The fix bundles the font BYTES into the server build. This file proves it
 * the only way that means anything: global fetch is replaced by a function
 * that always fails, then both cards are rendered for real (real sharp, real
 * Inter). On the old code this file is red -- the font fetch rejects and the
 * render throws.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import sharp from 'sharp';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/lib/seo/resolvePublicEventRef', () => ({ resolvePublicEventRef: async () => null }));
vi.mock('@/modules/event-page/useFestivalDetailQuery', () => ({ fetchFestivalDetail: async () => null }));

const fetchCalls: string[] = [];

beforeAll(() => {
  vi.stubGlobal('fetch', async (input: unknown) => {
    fetchCalls.push(String(input));
    throw new TypeError('fetch failed (ConnectTimeoutError: simulated)');
  });
});
afterAll(() => {
  vi.unstubAllGlobals();
});

async function expectAValidCard(buf: Buffer): Promise<void> {
  const meta = await sharp(buf).metadata();
  expect(meta.format).toBe('jpeg');
  expect(meta.width).toBe(1200);
  expect(meta.height).toBe(630);
}

describe('OG card fonts need no network', () => {
  it('renders the branded fallback card while every fetch fails', async () => {
    const { buildFallbackCard } = await import('../app/lib/ogCardRender');
    await expectAValidCard(await buildFallbackCard('Sensual Wednesday', 'Wednesday 5 November', 'The Dance Studio'));
  }, 30_000);

  it('renders the branded cover card while every fetch fails', async () => {
    const { buildBrandedImageCard } = await import('../app/lib/ogCardRender');
    const cover = await sharp({
      create: { width: 1000, height: 1500, channels: 3, background: { r: 120, g: 40, b: 160 } },
    }).jpeg().toBuffer();
    await expectAValidCard(
      await buildBrandedImageCard(cover, 'Sensual Wednesday', 'Wednesday 5 November', 'The Dance Studio', 'social'),
    );
  }, 30_000);

  it('never asks the network for a font', () => {
    expect(fetchCalls.filter((u) => /\.ttf|font/i.test(u))).toEqual([]);
  });

  it('the renderer source has no font fetch left in it', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../app/lib/ogCardRender.ts', import.meta.url), 'utf8');
    const start = src.indexOf('async function materializeFont(');
    const end = src.indexOf('async function fontSemiPath(');
    // Anchors must exist and be in order, or the slice below checks nothing.
    expect(start, 'materializeFont( not found').toBeGreaterThan(-1);
    expect(end, 'fontSemiPath( must follow materializeFont(').toBeGreaterThan(start);
    const body = src.slice(start, end);
    expect(body).not.toMatch(/\bfetch\(/);
  });
});
