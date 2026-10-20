// @vitest-environment node
/**
 * The custom media address `media.bachatacalendar.co.uk` must be accepted
 * everywhere the R2 development address already is, BEFORE the upload secret
 * (R2_PUBLIC_DOMAIN) is flipped to it. Stored rows keep the r2.dev address, so
 * that one must stay accepted too.
 *
 * The host is a fact held in four places (app/csp.ts, vercel.json
 * images.remotePatterns, src/lib/imageCdn.ts, scripts/check-og-images.mjs).
 * Every case reads the real artefact, and every table also pins the REJECT
 * edge: an unrelated host and a look-alike that only starts with our name.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { contentSecurityPolicy } from '../app/csp';
import { optimizedImageUrl } from '../src/lib/imageCdn';
import { isOnBakeHost } from '../scripts/check-og-images.mjs';

const NEW_HOST = 'media.bachatacalendar.co.uk';
const OLD_HOST = 'pub-07f606224cac4f2596903c44df723644.r2.dev';

const ACCEPTED = [
  `https://${NEW_HOST}/events/a.jpg`,
  `https://${NEW_HOST}/venue-videos/x.mp4`,
  `https://${OLD_HOST}/events/a.jpg`,
  `https://${OLD_HOST}/venue-videos/x.mp4`,
];
const REJECTED = [
  'https://evil.example/a.jpg',
  `https://${NEW_HOST}.evil.example/a.jpg`,
];

/** One directive's source list, as the browser would read it. */
function directive(policy: string, name: string): string[] {
  const found = policy
    .split(';')
    .map((d) => d.trim())
    .find((d) => d === name || d.startsWith(`${name} `));
  if (!found) throw new Error(`CSP has no ${name} directive at all`);
  return found.split(/\s+/).slice(1);
}

/** CSP host-source matching, including the `*.` wildcard form. */
function permits(sources: string[], url: string): boolean {
  const { protocol, hostname } = new URL(url);
  return sources.some((src) => {
    if (!src.startsWith(`${protocol}//`)) return false;
    const bare = src.slice(protocol.length + 2);
    if (bare === hostname) return true;
    if (bare.startsWith('*.')) {
      const suffix = bare.slice(1);
      return hostname.endsWith(suffix) && hostname.length > suffix.length;
    }
    return false;
  });
}

describe('CSP admits the new media host beside the old one', () => {
  const policies = [
    ['header', contentSecurityPolicy('n')],
    ['meta', contentSecurityPolicy('n', { forMeta: true })],
  ] as const;
  for (const [form, policy] of policies) {
    for (const name of ['img-src', 'media-src']) {
      const sources = directive(policy, name);
      it.each(ACCEPTED)(`${form} ${name} permits %s`, (url) => {
        expect(permits(sources, url)).toBe(true);
      });
      it.each(REJECTED)(`${form} ${name} rejects %s`, (url) => {
        expect(permits(sources, url)).toBe(false);
      });
      it(`${form} ${name} names the new host literally`, () => {
        expect(sources).toContain(`https://${NEW_HOST}`);
      });
    }
  }
});

describe('vercel.json images.remotePatterns', () => {
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const hosts = vercel.images.remotePatterns.map((p: { protocol: string; hostname: string }) => `${p.protocol}://${p.hostname}`);
  it.each([NEW_HOST, OLD_HOST, 'pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev'])('lists https://%s', (host) => {
    expect(hosts).toContain(`https://${host}`);
  });
});

describe('imageCdn gate routes the new host through the optimiser', () => {
  afterEach(() => vi.unstubAllEnvs());
  const IMAGES = ACCEPTED.filter((u) => u.endsWith('.jpg'));
  it.each(IMAGES)('optimises %s', (url) => {
    vi.stubEnv('DEV', false);
    expect(optimizedImageUrl(url, 320)).toBe(`/_vercel/image?url=${encodeURIComponent(url)}&w=320&q=70`);
  });
  it.each(REJECTED)('leaves %s untouched', (url) => {
    vi.stubEnv('DEV', false);
    expect(optimizedImageUrl(url, 320)).toBe(url);
  });
});

describe('check-og-images recognises a baked image on either host', () => {
  it.each([`https://${NEW_HOST}/og/x.jpg`, `https://${OLD_HOST}/og/x.jpg`])('accepts %s', (url) => {
    expect(isOnBakeHost(url)).toBe(true);
  });
  it.each(['https://evil.example/a.jpg', `https://${NEW_HOST}.evil.example/a.jpg`])('rejects %s', (url) => {
    expect(isOnBakeHost(url)).toBe(false);
  });
});
