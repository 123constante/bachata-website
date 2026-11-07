// Slice 10: walk pictures pinned to the head they were taken at, void after any
// push (contract 11 item 3). Mutants that must turn this suite red: comparing
// only the first 7 characters of the head; ignoring a changed sha256.
import { describe, it, expect } from 'vitest';
import { pinPictureSet, pictureSetValid, picturesMatchVerdict, main } from '../scripts/lib/walk-pictures-pin.mjs';

const HEAD = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const sha = (c: string) => c.repeat(64);
const PICS = [
  { path: 'home--empty--chromium.png', sha256: sha('1') },
  { path: 'home--empty--webkit.png', sha256: sha('2') },
  { path: 'event--long--chromium.png', sha256: sha('3') },
];
const flip = (s: string, i: number) => s.slice(0, i) + (s[i] === '0' ? '1' : '0') + s.slice(i + 1);

describe('walk-pictures-pin: head', () => {
  const rec = pinPictureSet(HEAD, PICS);
  const rows: [string, unknown, boolean][] = [
    ['same head', HEAD, true],
    ['one hex char different (last)', flip(HEAD, 39), false],
    ['one hex char different (8th, past a 7-char prefix)', flip(HEAD, 7), false],
    ['one hex char different (first)', flip(HEAD, 0), false],
    ['short head (7-char prefix)', HEAD.slice(0, 7), false],
    ['upper-case head', HEAD.toUpperCase(), false],
    ['missing head', undefined, false],
    ['empty head', '', false],
  ];
  it.each(rows)('%s -> %s', (_n, live, want) => {
    const r = pictureSetValid(rec, live);
    expect(r.valid).toBe(want);
    if (!want) expect(r.reasons.length).toBeGreaterThan(0);
  });

  it('a different head names both heads', () => {
    const live = flip(HEAD, 39);
    const r = pictureSetValid(rec, live);
    expect(r.reasons.join(' ')).toContain(HEAD);
    expect(r.reasons.join(' ')).toContain(live);
  });

  it('never throws on junk', () => {
    for (const junk of [null, undefined, 'x', 1, [], {}, { headSha: HEAD }]) {
      expect(pictureSetValid(junk, HEAD).valid).toBe(false);
    }
    const hostile = { get headSha() { throw new Error('boom'); } };
    expect(pictureSetValid(hostile, HEAD).valid).toBe(false);
  });

  it('a record round-tripped through JSON stays valid; a tampered count does not', () => {
    const json = JSON.parse(JSON.stringify(rec));
    expect(pictureSetValid(json, HEAD).valid).toBe(true);
    expect(pictureSetValid({ ...json, count: 2 }, HEAD).valid).toBe(false);
    expect(pictureSetValid({ ...json, pictures: [] , count: 0 }, HEAD).valid).toBe(false);
  });
});

describe('walk-pictures-pin: pinPictureSet', () => {
  it('returns a frozen record', () => {
    const r = pinPictureSet(HEAD, PICS);
    expect(r).toEqual({ headSha: HEAD, pictures: PICS, count: 3 });
    expect(Object.isFrozen(r)).toBe(true);
    expect(Object.isFrozen(r.pictures)).toBe(true);
    expect(Object.isFrozen(r.pictures[0])).toBe(true);
  });

  it('copies, so mutating the input afterwards does not move the pin', () => {
    const input = PICS.map((p) => ({ ...p }));
    const r = pinPictureSet(HEAD, input);
    input[0].sha256 = sha('9');
    expect(r.pictures[0].sha256).toBe(sha('1'));
  });

  const bad: [string, unknown, unknown][] = [
    ['short head', HEAD.slice(0, 7), PICS],
    ['missing head', undefined, PICS],
    ['upper-case head', HEAD.toUpperCase(), PICS],
    ['empty list', HEAD, []],
    ['not a list', HEAD, 'pics'],
    ['duplicate path', HEAD, [...PICS, { path: PICS[0].path, sha256: sha('4') }]],
    ['malformed sha256 (short)', HEAD, [{ path: 'a.png', sha256: 'abc' }]],
    ['malformed sha256 (upper)', HEAD, [{ path: 'a.png', sha256: sha('A') }]],
    ['missing sha256', HEAD, [{ path: 'a.png' }]],
    ['blank path', HEAD, [{ path: ' ', sha256: sha('1') }]],
  ];
  it.each(bad)('throws on %s', (_n, head, pics) => {
    expect(() => pinPictureSet(head as string, pics as never)).toThrow();
  });
});

describe('walk-pictures-pin: picturesMatchVerdict', () => {
  const rec = pinPictureSet(HEAD, PICS);
  const asNames = PICS.map((p) => ({ name: p.path, sha256: p.sha256 }));
  const rows: [string, unknown, boolean][] = [
    ['matching (list of paths)', PICS, true],
    ['matching (report shape, names, any order)', { headSha: HEAD, pictures: [...asNames].reverse() }, true],
    ['one changed sha256', [PICS[0], PICS[1], { ...PICS[2], sha256: sha('4') }], false],
    ['one changed sha256 (one hex char)', [PICS[0], PICS[1], { ...PICS[2], sha256: flip(PICS[2].sha256, 63) }], false],
    ['one missing', PICS.slice(0, 2), false],
    ['one extra', [...PICS, { path: 'x--y--webkit.png', sha256: sha('5') }], false],
    ['duplicate path', [...PICS, PICS[0]], false],
    ['duplicate path replacing one', [PICS[0], PICS[1], PICS[1]], false],
    ['empty', [], false],
    ['report at a different head', { headSha: flip(HEAD, 39), pictures: asNames }, false],
    ['report pictures not a list', { headSha: HEAD }, false],
    ['null input', null, false],
  ];
  it.each(rows)('%s -> %s', (_n, input, want) => {
    expect(picturesMatchVerdict(rec, input)).toBe(want);
  });

  it('an invalid record never matches', () => {
    expect(picturesMatchVerdict(null, PICS)).toBe(false);
    expect(picturesMatchVerdict({ headSha: HEAD, pictures: [], count: 0 }, [])).toBe(false);
  });
});

describe('walk-pictures-pin: main', () => {
  it('exit 0 valid, 1 invalid or unreadable, 2 usage', () => {
    const files: Record<string, string> = {
      'r.json': JSON.stringify(pinPictureSet(HEAD, PICS)),
      'bad.json': '{not json',
    };
    const deps = { readFile: (p: string) => { if (!(p in files)) throw new Error('ENOENT'); return files[p]; }, log: () => {}, error: () => {} };
    expect(main(['--record', 'r.json', '--head', HEAD], deps)).toBe(0);
    expect(main(['--record', 'r.json', '--head', flip(HEAD, 39)], deps)).toBe(1);
    expect(main(['--record', 'r.json', '--head', HEAD.slice(0, 7)], deps)).toBe(1);
    expect(main(['--record', 'missing.json', '--head', HEAD], deps)).toBe(1);
    expect(main(['--record', 'bad.json', '--head', HEAD], deps)).toBe(1);
    expect(main(['--record', 'r.json'], deps)).toBe(2);
    expect(main(['--head', HEAD], deps)).toBe(2);
    expect(main([], deps)).toBe(2);
  });
});
