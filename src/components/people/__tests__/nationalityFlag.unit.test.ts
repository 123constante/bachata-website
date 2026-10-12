/**
 * The nationality rule (nationality.ts), the artwork (flagArt.ts) and the Silk wave
 * maths (flagWave.ts). Shapes from the production survey of 2026-10-12 (read-only,
 * counts only): 17 of 166 dancer profiles and 1 of 2 videographers carry a code;
 * 11 distinct codes (ES 4, CO 4, AR 2, EC BO ZA IT VE GB DE CY 1 each); stored values
 * that cannot be mapped (Kosovo, one ambiguous value) are emitted as null.
 */
import { describe, expect, it } from 'vitest';
import { nationalityLabel, normaliseNationalityCode, pickNationalityCode } from '../nationality';
import { FLAG_ART, flagSvg, genericFlagArt, hasFlagArt } from '../flagArt';
import { SILK, STILL_T, column, flagGeometry, randomSeed, waveAt } from '../flagWave';

const PROD_CODES = ['ES', 'CO', 'AR', 'EC', 'BO', 'ZA', 'IT', 'VE', 'GB', 'DE', 'CY'];

describe('normaliseNationalityCode', () => {
  it.each([
    ['ES', 'ES'],
    ['co', 'CO'],
    ['  gb ', 'GB'],
    ['NZ', 'NZ'], // valid, no bespoke artwork: generic cloth
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
      const svg = flagSvg(code);
      expect(svg).toContain('viewBox="0 0 30 20"');
      expect(/[^\x20-\x7e]/.test(inner)).toBe(false);
      expect(inner).not.toMatch(/https?:|href=/); // the xmlns namespace is the only URL
    }
  });
  it('a valid code without artwork gets the generic cloth with its letters', () => {
    expect(hasFlagArt('NZ')).toBe(false);
    expect(flagSvg('NZ')).toBe(flagSvg('NZ'));
    expect(flagSvg('NZ')).toContain('>NZ</text>');
    expect(genericFlagArt('N<Z')).toContain('>NZ</text>');
  });
});

describe('Silk wave (ported from the reference)', () => {
  it('uses the owner-picked Silk preset exactly', () => {
    expect(SILK).toEqual({ amp: 45, spd: 30, len: 25, shd: 70, gst: 10 });
  });

  it('geometry matches the reference for photos of 40px and up', () => {
    // reference: fw = max(22, round(.46s)), fh = round(fw*2/3), pad = round(.2fw)
    expect(flagGeometry(96)).toMatchObject({ fw: 44, fh: 29, pad: 9, cw: 57, ch: 51, left: 60, top: -22 });
    expect(flagGeometry(56)).toMatchObject({ fw: 26, fh: 17, pad: 5 });
    expect(flagGeometry(40)).toMatchObject({ fw: 22, fh: 15, pad: 4 });
  });

  it('small circles keep a flag smaller than the photo', () => {
    for (const s of [20, 24, 28, 32, 36]) expect(flagGeometry(s).fw).toBeLessThan(s);
    expect(flagGeometry(24).fw).toBe(15);
  });

  it('the cloth is pinned at the pole: the column at u=0 moves least', () => {
    const seed = { ph: 1, g: 2 };
    const { A, waves, phase } = waveAt(1234, 15, seed);
    const atPole = Math.abs(column(0, A, waves, phase, seed.ph, 1).y);
    const maxFree = Math.max(...Array.from({ length: 50 }, (_, i) => Math.abs(column(0.5 + i / 100, A, waves, phase, seed.ph, 1).y)));
    expect(atPole).toBeLessThan(maxFree);
    expect(atPole).toBeLessThanOrEqual(A * 0.18 * 1.25 + 1e-9);
  });

  it('ripple height: amplitude is fh * .45 * .28, lifted at most 11% by Silk gusts', () => {
    const seed = { ph: 0, g: 0 };
    for (let t = 0; t < 20000; t += 250) {
      const { A } = waveAt(t, 20, seed);
      expect(A).toBeGreaterThanOrEqual(20 * 0.45 * 0.28 - 1e-9);
      expect(A).toBeLessThanOrEqual(20 * 0.45 * 0.28 * 1.11 + 1e-9);
    }
  });

  it('a reduced-motion flag is one fixed frame', () => {
    const seed = randomSeed(() => 0.5);
    expect(waveAt(STILL_T, 15, seed)).toEqual(waveAt(STILL_T, 15, seed));
  });

  it('per-flag random phase: two seeds do not move in step', () => {
    const a = randomSeed(() => 0.1);
    const b = randomSeed(() => 0.9);
    expect(a.ph).not.toBe(b.ph);
    expect(waveAt(5000, 15, a).phase).not.toBe(waveAt(5000, 15, b).phase);
  });
});
