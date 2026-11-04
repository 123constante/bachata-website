// @vitest-environment node
/**
 * Cover fetch: short timeout + ONE retry, and a final failure is the BRANDED
 * cover-unfetchable card, never the generic redirect (incident 2026-11-04:
 * Vercel -> Cloudflare connects were stalling; media.bachatacalendar.co.uk is
 * behind the same edge).
 *
 * Drives the REAL /api/og/card loader with the REAL fetchImageBytes (only its
 * timeout is shortened so the timeouts run in milliseconds). Card builders and
 * the data fetchers are stubbed: they are not the subject here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/lib/seo/resolvePublicEventRef', () => ({ resolvePublicEventRef: async () => null }));
vi.mock('@/modules/event-page/useFestivalDetailQuery', () => ({ fetchFestivalDetail: async () => null }));

const COVER = 'https://media.bachatacalendar.co.uk/covers/sensual-wednesday.jpg';
const TEST_TIMEOUT_MS = 40;

const io = vi.hoisted(() => ({ cardData: null as null | Record<string, unknown> }));

vi.mock('../app/lib/ogCardRender', async (importActual) => {
  const real = await importActual<typeof import('../app/lib/ogCardRender')>();
  return {
    ...real,
    fetchImageBytes: (url: string) => real.fetchImageBytes(url, { timeoutMs: TEST_TIMEOUT_MS }),
    buildFallbackCard: async () => Buffer.from('branded-fallback-jpeg'),
    buildImageCard: async () => Buffer.from('cover-jpeg'),
    buildCoverCard: async () => Buffer.from('cover-jpeg'),
    fetchEventCardData: async () => io.cardData,
    fetchFestivalCardData: async () => io.cardData,
    resolveOgEventId: async (param: string) => param,
  };
});

import { loader } from '../app/routes/api.og.card';
import { fetchImageBytes, OG_IMAGE_FETCH_ATTEMPTS } from '../app/lib/ogCardRender';

type Step = 'ok' | 'hang' | 'connect-error' | '503' | '404';

/** A fetch that plays one scripted step per call. 'hang' never answers and
 *  rejects only when the caller's AbortSignal fires -- a real stalled connect. */
function scriptFetch(steps: Step[]) {
  const spy = vi.fn((_url: unknown, init?: RequestInit) => {
    const step = steps[spy.mock.calls.length - 1] ?? 'ok';
    if (step === 'ok') return Promise.resolve(new Response(Buffer.from('jpeg-bytes'), { status: 200 }));
    if (step === '503') return Promise.resolve(new Response(null, { status: 503 }));
    if (step === '404') return Promise.resolve(new Response(null, { status: 404 }));
    if (step === 'connect-error') return Promise.reject(new TypeError('fetch failed (ConnectTimeoutError)'));
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

async function getCard(): Promise<Response> {
  const request = new Request('https://www.bachatacalendar.co.uk/api/og/card?kind=event&id=evt-1&v=abc');
  return loader({ request } as unknown as Parameters<typeof loader>[0]);
}

beforeEach(() => {
  io.cardData = { title: 'Sensual Wednesday', dateLine: 'Wednesday 5 November 2026', venueLine: 'at Pulse', coverUrl: COVER };
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('cover fetch through the real loader', () => {
  it.each([
    // label, cover url?, fetch script, expected calls, expected marker, body
    ['cover ok', true, ['ok'], 1, null, 'cover-jpeg'],
    ['cover times out once, then ok', true, ['hang', 'ok'], 2, null, 'cover-jpeg'],
    ['cover times out twice', true, ['hang', 'hang'], 2, 'cover-unfetchable', 'branded-fallback-jpeg'],
    ['no cover url', false, [], 0, 'cover-absent', 'branded-fallback-jpeg'],
  ] as const)('%s', async (_label, hasCover, steps, calls, marker, body) => {
    if (!hasCover) io.cardData = { ...io.cardData, coverUrl: null };
    const spy = scriptFetch([...steps]);
    const res = await getCard();
    // Never the generic redirect: every row is an inline 200 JPEG.
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('x-og-fallback')).toBe(marker);
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe(body);
    expect(spy).toHaveBeenCalledTimes(calls);
  });
});

describe('fetchImageBytes retry policy', () => {
  it('retries exactly once (two attempts in all)', () => {
    expect(OG_IMAGE_FETCH_ATTEMPTS).toBe(2);
  });

  it.each([
    // label, script, expected calls, bytes?
    ['connect error then ok', ['connect-error', 'ok'], 2, true],
    ['503 then ok', ['503', 'ok'], 2, true],
    ['connect error twice', ['connect-error', 'connect-error'], 2, false],
    ['hang then connect error', ['hang', 'connect-error'], 2, false],
    // An answer is not a blip: no retry.
    ['404 is not retried', ['404', 'ok'], 1, false],
  ] as const)('%s', async (_label, steps, calls, ok) => {
    const spy = scriptFetch([...steps]);
    const bytes = await fetchImageBytes(COVER, { timeoutMs: TEST_TIMEOUT_MS });
    expect(bytes === null).toBe(!ok);
    expect(spy).toHaveBeenCalledTimes(calls);
  });

  it('a refused source is never fetched, not even once', async () => {
    const spy = scriptFetch(['ok']);
    expect(await fetchImageBytes('https://example.com/a.jpg')).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
});
