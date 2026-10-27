import { describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs script helper
import { PROD_HOST, ciBypassHeaders, ciBypassHeadersFor, isProductionUrl } from '../../scripts/lib/ciBypassHeader.mjs';

const SECRET = 'abc123-SECRET_value';

describe('ciBypassHeaders', () => {
  it.each([
    ['unset', {}, {}],
    ['empty', { CI_BYPASS_HEADER: '' }, {}],
    ['blank', { CI_BYPASS_HEADER: '   \t' }, {}],
    ['set', { CI_BYPASS_HEADER: SECRET }, { 'x-ci-bypass': SECRET }],
    ['set with trailing newline (trimmed)', { CI_BYPASS_HEADER: SECRET + '\n' }, { 'x-ci-bypass': SECRET }],
  ])('%s', (_n, env, want) => {
    expect(ciBypassHeaders(env)).toEqual(want);
  });

  it.each([
    ['embedded LF', 'abc\ndef'],
    ['embedded CRLF', 'abc\r\nX-Evil: 1'],
    ['embedded CR', 'abc\rdef'],
    ['non-ASCII', 'abcédef'],
    ['control char', 'abc\u0007def'],
  ])('refuses %s and never echoes the value', (_n, bad) => {
    let message = '';
    try {
      ciBypassHeaders({ CI_BYPASS_HEADER: bad });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).not.toBe('');
    expect(message).not.toContain(bad);
    expect(message).not.toContain('abc');
  });
});

describe('ciBypassHeadersFor (host scoping)', () => {
  const env = { CI_BYPASS_HEADER: SECRET };
  it.each([
    ['production', `https://${PROD_HOST}/sitemap.xml`, true],
    ['production image path', `https://${PROD_HOST}/_vercel/image?url=x&w=640`, true],
    ['vercel preview', 'https://bachata-website-git-x-team.vercel.app/', false],
    ['apex (not the production host)', 'https://bachatacalendar.co.uk/', false],
    ['look-alike suffix', `https://${PROD_HOST}.evil.example/`, false],
    ['look-alike prefix', `https://evil-${PROD_HOST}/`, false],
    ['http downgrade', `http://${PROD_HOST}/`, false],
    ['supabase', 'https://stsdtacfauprzrdebmzg.supabase.co/rest/v1/events', false],
    ['google', 'https://www.google.com/ping?sitemap=x', false],
    ['media/r2', 'https://media.bachatacalendar.co.uk/og/x.jpg', false],
    ['garbage', 'not a url', false],
  ])('%s', (_n, url, sent) => {
    expect(isProductionUrl(url)).toBe(sent);
    expect(ciBypassHeadersFor(url, env)).toEqual(sent ? { 'x-ci-bypass': SECRET } : {});
  });

  it('sends nothing to production when the secret is absent', () => {
    expect(ciBypassHeadersFor(`https://${PROD_HOST}/`, {})).toEqual({});
  });
});
