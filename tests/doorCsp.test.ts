import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy } from '../app/csp';

const sources = (policy: string, name: string) => policy.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `))?.split(/\s+/).slice(1) ?? [];

describe('Turnstile host on the CSP', () => {
  for (const forMeta of [false, true]) {
    it.each(['script-src', 'frame-src', 'connect-src'])(`${forMeta ? 'meta' : 'header'} %s admits challenges.cloudflare.com`, (d) => {
      expect(sources(contentSecurityPolicy('n', { forMeta }), d)).toContain('https://challenges.cloudflare.com');
    });
  }
  it('does not widen img-src or default-src', () => {
    const p = contentSecurityPolicy('n');
    expect(sources(p, 'img-src')).not.toContain('https://challenges.cloudflare.com');
    expect(sources(p, 'default-src')).toEqual(["'self'"]);
  });
});
