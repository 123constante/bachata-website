import { describe, expect, it } from 'vitest';
import { buildSignInHref, sanitizeReturnTo } from '../authRouting';

describe('sanitizeReturnTo', () => {
  it('keeps an on-site page with its query and anchor', () => {
    expect(sanitizeReturnTo('/faq?q=1#refunds')).toBe('/faq?q=1#refunds');
    expect(sanitizeReturnTo('/authors')).toBe('/authors');
    expect(sanitizeReturnTo('/event/caf%C3%A9')).toBe('/event/caf%C3%A9');
  });

  it('refuses the auth pages however they are spelled', () => {
    for (const p of ['/auth', '/auth?mode=signup', '/auth#x', '/Auth', '/AUTH/callback', '/auth/callback?x=1', '/%61uth?mode=signin', '/%41UTH']) {
      expect(sanitizeReturnTo(p), p).toBeNull();
    }
  });

  it('refuses anything a browser could read as off-site', () => {
    for (const p of ['//evil.example', '/\\evil.example', '/\t/evil.example', '/\n/evil.example', 'https://evil.example']) {
      expect(sanitizeReturnTo(p), JSON.stringify(p)).toBeNull();
    }
  });

  it('refuses empty and malformed values', () => {
    expect(sanitizeReturnTo('')).toBeNull();
    expect(sanitizeReturnTo(null)).toBeNull();
    expect(sanitizeReturnTo('/%E0%A4%A')).toBeNull();
  });
});

describe('buildSignInHref', () => {
  it('returns to the given page, encoded', () => {
    expect(buildSignInHref('/event/abc?occ=2')).toBe('/auth?mode=signin&returnTo=%2Fevent%2Fabc%3Focc%3D2');
    expect(buildSignInHref('/')).toBe('/auth?mode=signin&returnTo=%2F');
  });

  it('carries the requested mode', () => {
    expect(buildSignInHref('/profile', 'signup')).toBe('/auth?mode=signup&returnTo=%2Fprofile');
  });

  it('drops an unsafe returnTo rather than passing it on', () => {
    expect(buildSignInHref('/auth?mode=signup')).toBe('/auth?mode=signin');
    expect(buildSignInHref('/\\evil.example')).toBe('/auth?mode=signin');
    expect(buildSignInHref(null)).toBe('/auth?mode=signin');
  });
});
