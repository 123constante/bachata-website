// @vitest-environment node
/**
 * Reviewer probe for PR #938 (og card SSRF allow-list). NOT in the vitest
 * include globs on purpose: it imports app/lib/ogImageSourceAllowlist.ts,
 * which exists only on the PR branch. To run it against the PR code:
 *   cp docs/reviews/og-card-src-allowlist-bypass.probe.ts tests/ogBypass.test.ts
 *   npx vitest run tests/ogBypass.test.ts
 * (on a checkout of claude/og-card-src-allowlist; delete the copy after).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fetchImageBytes } from '../app/lib/ogCardRender';
import { isAllowedOgImageSource } from '../app/lib/ogImageSourceAllowlist';

const SB = 'https://stsdtacfauprzrdebmzg.supabase.co';

afterEach(() => {
  vi.unstubAllGlobals();
});

// Brief item 1: each bypass shape must be refused with fetch never called.
describe('bypass shapes are refused before fetch', () => {
  it.each([
    ['supabase %2e%2e dot segments', `${SB}/storage/v1/object/public/%2e%2e/%2e%2e/%2e%2e/rest/v1/x`],
    ['supabase %2E%2E upper-case', `${SB}/storage/v1/object/public/%2E%2E/%2E%2E/%2E%2E/rest/v1/x`],
    ['supabase .%2e mixed', `${SB}/storage/v1/object/public/.%2e/.%2e/.%2e/rest/v1/x`],
    ['supabase backslash traversal', `${SB}/storage/v1/object/public\\..\\..\\..\\rest\\v1\\x`],
    ['supabase prefix without trailing slash', `${SB}/storage/v1/object/publicX/a.jpg`],
    ['trailing-dot host', 'https://media.bachatacalendar.co.uk./a.jpg'],
    ['IDN homoglyph (cyrillic e)', 'https://m\u0435dia.bachatacalendar.co.uk/a.jpg'],
    ['punycode host', 'https://xn--mdia-8cd.bachatacalendar.co.uk/a.jpg'],
    ['IPv4 hex short form 0x7f.1', 'https://0x7f.1/a.jpg'],
    ['IPv4 decimal 2130706433', 'https://2130706433/a.jpg'],
    ['IPv4 octal 0177.0.0.1', 'https://0177.0.0.1/a.jpg'],
    ['metadata as decimal', 'https://2852039166/latest/meta-data/'],
    ['IPv6-mapped IPv4', 'https://[::ffff:127.0.0.1]/a.jpg'],
    ['IPv6-mapped metadata', 'https://[::ffff:169.254.169.254]/latest/'],
    ['full-width dot host', 'https://media\uff0ebachatacalendar\uff0eco\uff0euk.evil.com/a.jpg'],
    ['default port :443 spelled out then userinfo', 'https://media.bachatacalendar.co.uk:443@evil.com/a.jpg'],
    ['userinfo-looking path trick', 'https://evil.com#@media.bachatacalendar.co.uk/a.jpg'],
    ['tab/newline in host', 'https://media.bachatacalendar.co.uk\t.evil.com/a.jpg'],
    ['protocol-relative', '//media.bachatacalendar.co.uk/a.jpg'],
    ['upper-case scheme http', 'HTTP://media.bachatacalendar.co.uk/a.jpg'],
    ['javascript: url', 'javascript:alert(1)'],
    ['blob: url', 'blob:https://media.bachatacalendar.co.uk/uuid'],
  ])('%s -> refused, fetch never called', async (_label, url) => {
    const spy = vi.fn(async () => new Response(Buffer.from('x'), { status: 200 }));
    vi.stubGlobal('fetch', spy);
    expect(isAllowedOgImageSource(url)).toBe(false);
    expect(await fetchImageBytes(url)).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  // Shapes the URL parser normalises INTO an allowed, harmless URL. Recorded so
  // the verdict is explicit, not because they are a risk.
  it.each([
    ['explicit default port :443 is dropped by the parser', 'https://media.bachatacalendar.co.uk:443/a.jpg'],
    ['%2F inside a public object name stays one segment', `${SB}/storage/v1/object/public/a%2F..%2F..%2Fx.jpg`],
    ['dot segments that stay inside public/', `${SB}/storage/v1/object/public/a/../b.jpg`],
  ])('%s -> allowed', (_label, url) => {
    expect(isAllowedOgImageSource(url)).toBe(true);
  });

  // Own-origin src: allowed host, but the path is the card endpoint itself.
  it('own /api/og/card endpoint as src is ALLOWED (self-fetch chain, see N1)', () => {
    const inner = 'https://www.bachatacalendar.co.uk/api/og/card?kind=image&src=https%3A%2F%2Fimages.unsplash.com%2Fphoto-1';
    expect(isAllowedOgImageSource(inner)).toBe(true);
  });
});

// Brief item 2: redirect "error" against the REAL Node fetch (undici), no stub.
describe('redirect: "error" with the real runtime fetch', () => {
  it('undici rejects a 302 instead of following it', async () => {
    let hits = 0;
    const target = createServer((_req, res) => { hits += 1; res.end('secret'); });
    await new Promise<void>((r) => target.listen(0, '127.0.0.1', () => r()));
    const tport = (target.address() as AddressInfo).port;
    const bouncer = createServer((_req, res) => {
      res.writeHead(302, { Location: `http://127.0.0.1:${tport}/` });
      res.end();
    });
    await new Promise<void>((r) => bouncer.listen(0, '127.0.0.1', () => r()));
    const bport = (bouncer.address() as AddressInfo).port;
    await expect(fetch(`http://127.0.0.1:${bport}/`, { redirect: 'error' })).rejects.toThrow(TypeError);
    expect(hits).toBe(0);
    // Control: the default mode follows, so the probe really exercises a redirect.
    const followed = await fetch(`http://127.0.0.1:${bport}/`);
    expect(await followed.text()).toBe('secret');
    expect(hits).toBe(1);
    target.close();
    bouncer.close();
  });
});
