// @vitest-environment node
/**
 * /api/og/card fetches an image server-side from a URL it was handed. Before
 * this allow-list, `kind=image&src=` and every event/festival cover went to
 * fetch() with no host check and redirects followed: an open SSRF on a public,
 * edge-cached endpoint (review nit 2 on PR #921).
 *
 * Every refused case asserts fetch was NEVER called -- a refusal that still
 * made the request (and then discarded the bytes) would leak exactly as much.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fetchImageBytes } from '../app/lib/ogCardRender';
import { isAllowedOgImageSource, OG_IMAGE_SOURCE_HOSTS } from '../app/lib/ogImageSourceAllowlist';

const MEDIA = 'https://media.bachatacalendar.co.uk/covers/abc.jpg';

function stubFetch(response: Response = new Response(Buffer.from('jpeg-bytes'), { status: 200 })) {
  const spy = vi.fn(async () => response);
  vi.stubGlobal('fetch', spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchImageBytes: allowed sources are fetched', () => {
  it.each([
    ['media host', MEDIA],
    ['supabase public storage', 'https://stsdtacfauprzrdebmzg.supabase.co/storage/v1/object/public/avatars/a.jpg'],
    ['r2.dev old host of the same bucket', 'https://pub-07f606224cac4f2596903c44df723644.r2.dev/covers/a.jpg'],
    ['unsplash', 'https://images.unsplash.com/photo-123?w=1200'],
    ['site origin (absoluteImageUrl output)', 'https://www.bachatacalendar.co.uk/images/a.jpg'],
    ['apex site origin', 'https://bachatacalendar.co.uk/images/a.jpg'],
    ['upper-case host', 'https://MEDIA.BachataCalendar.co.uk/covers/abc.jpg'],
  ])('%s -> fetch called', async (_label, url) => {
    const spy = stubFetch();
    expect(isAllowedOgImageSource(url)).toBe(true);
    const bytes = await fetchImageBytes(url);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(bytes?.toString()).toBe('jpeg-bytes');
    // An allowed host must not be able to bounce the fetch elsewhere.
    const init = (spy.mock.calls[0] as unknown[])[1] as RequestInit;
    expect(init.redirect).toBe('error');
  });
});

describe('fetchImageBytes: refused sources never reach fetch', () => {
  it.each([
    ['example.com test rows', 'https://example.com/avatar.jpg'],
    ['http on an allowed host', 'http://media.bachatacalendar.co.uk/covers/abc.jpg'],
    ['cloud metadata IP', 'http://169.254.169.254/latest/meta-data/'],
    ['cloud metadata IP over https', 'https://169.254.169.254/latest/meta-data/'],
    ['localhost', 'https://localhost/a.jpg'],
    ['loopback v4', 'https://127.0.0.1/a.jpg'],
    ['loopback v6', 'https://[::1]/a.jpg'],
    ['suffix attack', 'https://media.bachatacalendar.co.uk.evil.com/a.jpg'],
    ['prefix attack', 'https://evilmedia.bachatacalendar.co.uk/a.jpg'],
    ['userinfo', 'https://user@media.bachatacalendar.co.uk/a.jpg'],
    ['userinfo with password', 'https://user:pw@media.bachatacalendar.co.uk/a.jpg'],
    ['explicit port', 'https://media.bachatacalendar.co.uk:8443/a.jpg'],
    ['supabase non-public path', 'https://stsdtacfauprzrdebmzg.supabase.co/rest/v1/profiles?select=*'],
    ['supabase signed-object path', 'https://stsdtacfauprzrdebmzg.supabase.co/storage/v1/object/sign/avatars/a.jpg'],
    ['supabase path traversal', 'https://stsdtacfauprzrdebmzg.supabase.co/storage/v1/object/public/../../rest/v1/x'],
    ['other supabase project', 'https://otherproject.supabase.co/storage/v1/object/public/a.jpg'],
    ['data: url', 'data:image/jpeg;base64,AAAA'],
    ['file: url', 'file:///etc/passwd'],
    ['relative path', '/images/a.jpg'],
    ['garbage', 'not a url'],
    ['empty', ''],
  ])('%s -> refused, fetch never called', async (_label, url) => {
    const spy = stubFetch();
    expect(isAllowedOgImageSource(url)).toBe(false);
    expect(await fetchImageBytes(url)).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('fetchImageBytes: redirects are not followed', () => {
  it('a redirect response yields null', async () => {
    stubFetch(new Response(null, { status: 302, headers: { Location: 'http://169.254.169.254/' } }));
    expect(await fetchImageBytes(MEDIA)).toBeNull();
  });

  it('a fetch that rejects on redirect (redirect: "error") yields null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('redirect mode is set to error'); }));
    expect(await fetchImageBytes(MEDIA)).toBeNull();
  });
});

describe('one mapping: the allow-list is vercel.json remotePatterns plus the named extras', () => {
  it('hosts equal remotePatterns hostnames + the four extras', () => {
    const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
      images: { remotePatterns: { protocol: string; hostname: string }[] };
    };
    const remote = vercel.images.remotePatterns.map((p) => p.hostname.toLowerCase());
    // Every remotePattern is https; an http pattern would contradict the https-only rule.
    for (const p of vercel.images.remotePatterns) expect(p.protocol).toBe('https');
    const extras = [
      'stsdtacfauprzrdebmzg.supabase.co',
      'images.unsplash.com',
      'www.bachatacalendar.co.uk',
      'bachatacalendar.co.uk',
    ];
    expect([...OG_IMAGE_SOURCE_HOSTS].sort()).toEqual([...remote, ...extras].sort());
  });
});

// Real prod URLs, taken read-only on 2026-10-21 (URL columns only). The
// verdicts here are the ones the handover reports.
describe('real prod image URLs', () => {
  it.each([
    ['https://media.bachatacalendar.co.uk/images/events/covers/2026/06/b14e8d19-d62b-43df-8916-55afb1c05781.webp', true],
    ['https://media.bachatacalendar.co.uk/images/2026/05/1778167362413-z94h1zs1tim.webp', true],
    ['https://stsdtacfauprzrdebmzg.supabase.co/storage/v1/object/public/images/2026/04/1776677357217-2ac1j72kuwr.jpg', true],
    ['https://stsdtacfauprzrdebmzg.supabase.co/storage/v1/object/public/organiser-flyers/b38f71cb-7a5b-4f16-91c6-4b71e52d2091/2c2cfedaefaba3a38f24ee7cbec8a5ed.jpg', true],
    ['https://images.unsplash.com/photo-1516450360452-9312f5e86fc7', true],
    ['https://example.com/proof-avatar-1776689247243.jpg', false],
  ])('%s -> %s', (url, allowed) => {
    expect(isAllowedOgImageSource(url)).toBe(allowed);
  });
});
