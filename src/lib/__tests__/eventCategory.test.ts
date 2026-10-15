import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CATEGORY_WORD_LABEL,
  categoryAgrees,
  categoryLabelFor,
  deriveCategories,
  setForStored,
  storedCategory,
  wordForStored,
  type DerivedGenre,
} from '../eventCategory';

const FORMATS = ['one_off', 'recurring', 'course', 'festival', null] as const;
const STORED = ['party', 'class', 'workshop', 'masterclass', null] as const;

describe('deriveCategories: the set and the word for every (format x session set)', () => {
  it.each([
    // [format, section kinds, item types, set, word]
    ['recurring', ['party'], [], ['party'], 'night'],
    ['recurring', ['classes', 'party'], ['class', 'party'], ['party', 'class'], 'night'],
    ['recurring', ['classes'], ['class'], ['class'], 'class'],
    ['one_off', [], ['workshop'], ['class'], 'class'],
    ['recurring', ['masterclass'], [], ['class', 'masterclass'], 'masterclass'],
    ['recurring', [], ['social'], ['party'], 'night'],
    ['recurring', ['showcase', 'competition'], ['performance'], [], null],
    ['recurring', [], [], [], null],
    ['course', ['classes'], ['class'], ['class'], 'course'],
    ['course', [], [], [], 'course'],
    ['festival', ['party', 'classes'], [], ['party', 'class'], 'festival'],
    [null, ['party'], [], ['party'], 'night'],
  ] as const)('%s / %j / %j -> %j %s', (format, kinds, types, set, word) => {
    expect(deriveCategories(format, [...kinds], [...types])).toEqual({ set: [...set], word });
  });
});

describe('storedCategory: keep the value while it agrees, else party > masterclass > class, else null', () => {
  it.each([
    [null, ['class'], 'class'],
    ['party', ['class'], 'class'],
    ['party', ['party', 'class'], 'party'],
    ['class', ['party', 'class'], 'class'],
    ['workshop', ['class'], 'workshop'],
    ['workshop', ['party'], 'party'],
    ['masterclass', ['class'], 'class'],
    ['class', ['class', 'masterclass'], 'class'],
    [null, ['class', 'masterclass'], 'masterclass'],
    ['party', [], null],
    [null, [], null],
  ] as const)('%s over %j -> %s', (current, set, expected) => {
    expect(storedCategory(current, set as unknown as DerivedGenre[])).toBe(expected);
  });

  it('is a fixed point: the stored value re-derived from its own set never moves', () => {
    for (const s of STORED) {
      const set = setForStored(s);
      expect(storedCategory(s, set)).toBe(s === null ? null : s);
    }
  });
});

describe('the word every single-word screen shows (wordForStored / categoryLabelFor)', () => {
  it.each(FORMATS.flatMap((f) => STORED.map((s) => [f, s] as const)))('%s + %s', (format, stored) => {
    const word = wordForStored(format, stored);
    // The word is the format's when it has one, else the stored value's genre.
    if (format === 'festival' || format === 'course') expect(word).toBe(format);
    else if (stored === 'party') expect(word).toBe('night');
    else if (stored === 'masterclass') expect(word).toBe('masterclass');
    else if (stored === 'class' || stored === 'workshop') expect(word).toBe('class');
    else expect(word).toBeNull();
    expect(categoryLabelFor(format, stored)).toBe(word ? CATEGORY_WORD_LABEL[word] : 'Not set');
  });
});

describe('categoryAgrees: an explicit table over every vocabulary token prod holds (plus junk)', () => {
  // [token, agrees over {party}, over {class}, over {class, masterclass}, over all three]. Spelled out,
  // not re-derived from the lib: only the four CHECK values ever agree (workshop counts as class,
  // masterclass only over a masterclass set); a section kind (classes, social), a show, NULL and ''
  // agree with nothing, whatever the set.
  it.each([
    ['party', true, false, false, true],
    ['class', false, true, true, true],
    ['workshop', false, true, true, true],
    ['masterclass', false, false, true, true],
    ['social', false, false, false, false],
    ['classes', false, false, false, false],
    ['showcase', false, false, false, false],
    ['competition', false, false, false, false],
    ['performance', false, false, false, false],
    ['show', false, false, false, false],
    ['concert', false, false, false, false],
    ['ceremony', false, false, false, false],
    [null, false, false, false, false],
    ['', false, false, false, false],
  ] as const)('token %s', (token, overParty, overClass, overMasterclass, overAll) => {
    expect(categoryAgrees(token, ['party'])).toBe(overParty);
    expect(categoryAgrees(token, ['class'])).toBe(overClass);
    expect(categoryAgrees(token, ['class', 'masterclass'])).toBe(overMasterclass);
    expect(categoryAgrees(token, ['party', 'class', 'masterclass'])).toBe(overAll);
    expect(categoryAgrees(token, [])).toBe(false);
  });
});
// Parity with the P0 guard's own JS copy (scripts/check-event-truth-v1.mjs) lives in
// src/lib/__tests__/eventCategory.parity.test.ts, owned by the guard slice.

// ---- the byte pin (Website CI) ---------------------------------------------------------
// The derivation must read the same here, in admin's lib/eventCategory.ts and in the SQL twin.
// CI cannot read the private sibling repo, so Website CI pins THIS file's bytes: an edit here
// reds this test until the same edit lands in admin and both pins move together (admin's own
// test pins its copy the same way). LF-normalised, so a CRLF checkout hashes alike.
const LIB_PATH = resolve(__dirname, '../eventCategory.ts');
const LIB_LF_SHA256 = 'a8d972e7602ba026e4dd65fa587942c21c3c1188e5978d4b4ed3a0ac9400471f';
describe('the byte pin on src/lib/eventCategory.ts', () => {
  it(`hashes (LF) to ${LIB_LF_SHA256.slice(0, 8)}: edit the lib only with its admin twin, then move both pins`, () => {
    const lf = readFileSync(LIB_PATH, 'utf8').replace(/\r\n/g, '\n');
    expect(createHash('sha256').update(lf, 'utf8').digest('hex')).toBe(LIB_LF_SHA256);
  });
});

// The admin repo's lib/eventCategory.ts is meant to be this file byte for byte (review B,
// 2026-10-13: no admin ref held these bytes yet). CI cannot read a private sibling repo, so this
// is NOT CI-enforced: it runs only where the admin checkout sits next to this one (the owner's
// machine) and in CI reports itself skipped rather than passing blind. The pin above is what CI holds.
const ADMIN_TWIN = resolve(__dirname, '../../../../bachata-admin-11april/lib/eventCategory.ts');
describe.skipIf(!existsSync(ADMIN_TWIN))('the admin twin (local only: needs ../bachata-admin-11april)', () => {
  it('holds the same bytes as this file (line endings aside)', () => {
    const lf = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
    expect(lf(ADMIN_TWIN)).toBe(lf(resolve(__dirname, '../eventCategory.ts')));
  });
});
