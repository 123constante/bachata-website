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
// Every vocabulary value prod holds (section kinds, item types, date-only types), plus junk.
const TOKENS = ['party', 'social', 'classes', 'class', 'workshop', 'masterclass', 'showcase', 'competition', 'performance', 'show', 'concert', 'ceremony', null, ''];

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

describe('categoryAgrees over every vocabulary token prod holds (plus junk)', () => {
  it.each(TOKENS)('token %s: the stored value agrees exactly with the set it stands for', (token) => {
    const set = setForStored(token);
    // A token the CHECK vocabulary holds agrees with its own set; anything else agrees with nothing.
    expect(categoryAgrees(token, set)).toBe(set.length > 0);
    expect(categoryAgrees(token, [])).toBe(false);
    expect(categoryAgrees(token, ['party', 'class', 'masterclass'])).toBe(set.length > 0);
  });
});
// Parity with the P0 guard's own JS copy (scripts/check-event-truth-v1.mjs) lives in
// src/lib/__tests__/eventCategory.parity.test.ts, owned by the guard slice.

// The admin repo holds the byte-identical twin (lib/eventCategory.ts). CI cannot read a
// private sibling repo, so this runs only where the admin checkout sits next to this one
// (the owner's machine); in CI it reports itself skipped rather than passing blind.
const ADMIN_TWIN = resolve(__dirname, '../../../../bachata-admin-11april/lib/eventCategory.ts');
describe.skipIf(!existsSync(ADMIN_TWIN))('the admin twin (local only: needs ../bachata-admin-11april)', () => {
  it('holds the same bytes as this file (line endings aside)', () => {
    const lf = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
    expect(lf(ADMIN_TWIN)).toBe(lf(resolve(__dirname, '../eventCategory.ts')));
  });
});
