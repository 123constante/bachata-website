/**
 * Every country the nationality picker can offer (world-countries cca2 + the GB home nations,
 * as built by src/constants/countries.ts) must have bespoke flag artwork -- never the grey
 * letters tile. Owner screenshot 2026-11-05: Georgia (GE) showed "GE" on grey.
 */
import { describe, expect, it } from 'vitest';
import worldCountries from 'world-countries';
import { normaliseNationalityCode } from '../nationality';
import { flagArtMarkup, genericFlagArt, hasFlagArt } from '../flagArt';

const PICKER_CODES = [
  ...worldCountries.map((c) => c.cca2.toUpperCase()).filter((c) => normaliseNationalityCode(c) === c),
  'GB-ENG', 'GB-NIR', 'GB-SCT', 'GB-WLS',
].sort();

describe('flag artwork covers the whole nationality picker', () => {
  it('lists a realistic picker (guards against an empty table passing)', () => {
    expect(PICKER_CODES.length).toBeGreaterThan(230);
    expect(PICKER_CODES).toContain('GE');
  });

  it('every picker code has artwork (failing list printed)', () => {
    const missing = PICKER_CODES.filter((c) => !c.startsWith('GB-') && !hasFlagArt(c));
    expect(missing).toEqual([]);
  });

  it.each(PICKER_CODES)('%s renders artwork, not the letters tile', (code) => {
    const markup = flagArtMarkup(code);
    expect(markup).not.toContain('<text');
    expect(markup.length).toBeGreaterThan(40);
  });

  it('GE is white with a red cross and four small crosses', () => {
    const m = flagArtMarkup('GE');
    expect(m.match(/#FF0000/g)?.length).toBe(2 + 8);
  });

  it('an unknown valid code still gets the generic letters tile', () => {
    expect(hasFlagArt('ZZ')).toBe(false);
    expect(flagArtMarkup('ZZ')).toBe(genericFlagArt('ZZ'));
    expect(flagArtMarkup('ZZ')).toContain('<text');
  });
});
