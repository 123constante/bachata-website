/**
 * The nationality rule (nationality.ts) and the artwork (flagArt.ts). Shapes from the production survey of 2026-10-12 (read-only,
 * counts only): 17 of 166 dancer profiles and 1 of 2 videographers carry a code;
 * 11 distinct codes (ES 4, CO 4, AR 2, EC BO ZA IT VE GB DE CY 1 each); stored values
 * that cannot be mapped (Kosovo, one ambiguous value) are emitted as null.
 */
import { describe, expect, it } from 'vitest';
import { nationalityLabel, normaliseNationalityCode, pickNationalityCode } from '../nationality';
import { FLAG_ART, flagArtMarkup, genericFlagArt, hasFlagArt } from '../flagArt';
import { MIN_SMALL_STICKER_PX, MIN_STICKER_PX, SMALL_PHOTO_MAX_PX, stickerSize } from '../NationalityFlag';

const PROD_CODES = ['ES', 'CO', 'AR', 'EC', 'BO', 'ZA', 'IT', 'VE', 'GB', 'DE', 'CY'];

describe('normaliseNationalityCode', () => {
  it.each([
    ['ES', 'ES'],
    ['co', 'CO'],
    ['  gb ', 'GB'],
    ['NZ', 'NZ'], // valid, no bespoke artwork: generic flag
  ])('%j -> %s', (raw, want) => expect(normaliseNationalityCode(raw)).toBe(want));

  it.each([
    [null], [undefined], [''], ['   '], ['E'], ['ESP'], ['Spanish'], ['Colombia'], ['E5'], [42], [{}],
    ['ZZ'], ['AA'], ['XX'], ['QZ'], ['EU'], ['UN'], ['UK'],
    ['XK'], // Kosovo: the backend emits null for it on purpose; a direct read must agree
  ])('%j -> null (no flag)', (raw) => expect(normaliseNationalityCode(raw)).toBeNull());

  it('every code in use on production is valid and has bespoke artwork', () => {
    for (const c of PROD_CODES) {
      expect(normaliseNationalityCode(c)).toBe(c);
      expect(hasFlagArt(c)).toBe(true);
    }
  });
});

describe('nationalityLabel (the one wording)', () => {
  it('names the country in English', () => {
    expect(nationalityLabel('ES')).toEqual({ code: 'ES', name: 'Spain', ariaLabel: 'Nationality: Spain' });
    expect(nationalityLabel('gb')?.name).toBe('United Kingdom');
    expect(nationalityLabel('ZA')?.name).toBe('South Africa');
  });
  it('is null whenever there is no flag', () => {
    expect(nationalityLabel(null)).toBeNull();
    expect(nationalityLabel('')).toBeNull();
    expect(nationalityLabel('ZZ')).toBeNull();
  });
});

describe('pickNationalityCode', () => {
  it('reads nationality_code when the read emits the key', () => {
    expect(pickNationalityCode({ nationality_code: 'CO', nationality: 'ES' })).toBe('CO');
  });
  it('a null code is a decision: never overridden by the stored text', () => {
    expect(pickNationalityCode({ nationality_code: null, nationality: 'ES' })).toBeNull();
    expect(pickNationalityCode({ nationality_code: null, nationality: 'Kosovar' })).toBeNull();
  });
  it('a direct table read (no key) falls back to the stored alpha-2', () => {
    expect(pickNationalityCode({ nationality: 'IT' })).toBe('IT');
    expect(pickNationalityCode({ nationality: 'Italian' })).toBeNull();
    expect(pickNationalityCode({ nationality: null })).toBeNull();
    expect(pickNationalityCode(null)).toBeNull();
  });
});

describe('flag artwork', () => {
  it('is inline SVG on the 30x20 grid, ASCII only, no external reference', () => {
    for (const [code, inner] of Object.entries(FLAG_ART)) {
      expect(code).toMatch(/^[A-Z]{2}$/);
      expect(normaliseNationalityCode(code)).toBe(code);
      expect(flagArtMarkup(code)).toBe(inner);
      expect(/[^\x20-\x7e]/.test(inner)).toBe(false);
      expect(inner).not.toMatch(/https?:|href=/); // the xmlns namespace is the only URL
    }
  });
  it('a valid code without artwork gets the generic flag with its letters', () => {
    expect(hasFlagArt('NZ')).toBe(false);
    expect(flagArtMarkup('NZ')).toBe(genericFlagArt('NZ'));
    expect(flagArtMarkup('NZ')).toContain('>NZ</text>');
    expect(genericFlagArt('N<Z')).toContain('>NZ</text>');
  });
});


describe('stickerSize (the one size rule, every surface)', () => {
  // Owner decision 2026-10-13: under 28px no sticker (NationalityFlag renders nothing);
  // 28-47px: max(14, round(photo * 0.4)); 48px and up: max(20, round(photo * 0.46)); 3:2.
  it.each([
    [27, 14, 9.33], // never rendered (under 28px), but the rule stays total
    [28, 14, 9.33],
    [36, 14, 9.33],
    [40, 16, 10.67],
    [47, 19, 12.67],
    [48, 22, 14.67],
    [56, 26, 17.33],
    [96, 44, 29.33],
  ])('%ipx photo -> %ipx x %spx', (photo, w, h) => {
    expect(stickerSize(photo)).toEqual({ w, h });
  });
  it('the band edges are the pinned constants', () => {
    expect(SMALL_PHOTO_MAX_PX).toBe(47);
    expect(MIN_SMALL_STICKER_PX).toBe(14);
    expect(MIN_STICKER_PX).toBe(20);
  });
  it('a small photo never gets a bigger sticker than the first big one', () => {
    for (let p = 28; p <= SMALL_PHOTO_MAX_PX; p++) expect(stickerSize(p).w).toBeLessThan(stickerSize(48).w);
  });
});
