import { describe, expect, it } from 'vitest';
import {
  derivePersonRoles,
  otherRoles,
  peoplePath,
  roleFromHash,
  rolePagePath,
  strongestRole,
  type PersonRole,
  type RoleSignals,
} from '../personRoles';

const S = (isTeacher: boolean, isDj: boolean, hasDancerRow: boolean, hasDancerContent: boolean): RoleSignals => ({
  isTeacher, isDj, hasDancerRow, hasDancerContent,
});

// Expected values are literals. The 11 shapes: the 7 non-empty subsets of
// {teacher, dj, dancer}, the four-role person (performing/organising are not tabs, so
// it reads like teacher+dj+dancer), performing-only (a dancer row, nothing else), a
// dancing+teaching person with NO dancer content (the documented inference gap), and
// no public person at all.
const COMBOS: Array<[string, RoleSignals, PersonRole[]]> = [
  ['teacher only', S(true, false, true, false), ['teacher']],
  ['dj only', S(false, true, true, false), ['dj']],
  ['dancer only', S(false, false, true, true), ['dancer']],
  ['teacher + dj', S(true, true, true, false), ['teacher', 'dj']],
  ['teacher + dancer', S(true, false, true, true), ['teacher', 'dancer']],
  ['dj + dancer', S(false, true, true, true), ['dj', 'dancer']],
  ['teacher + dj + dancer', S(true, true, true, true), ['teacher', 'dj', 'dancer']],
  ['four roles (+performing)', S(true, true, true, true), ['teacher', 'dj', 'dancer']],
  ['performing only (bare dancer row)', S(false, false, true, false), ['dancer']],
  ['teacher + dancer without dancer content (inference gap, never a false Dancing)', S(true, false, true, false), ['teacher']],
  ['no public person', S(false, false, false, false), []],
];

describe('derivePersonRoles: role combinations', () => {
  it.each(COMBOS)('%s', (_n, signals, expected) => {
    expect(derivePersonRoles(signals)).toEqual(expected);
  });

  it('is always in tab order Teaching, DJ, Dancing', () => {
    for (const [, signals] of COMBOS) {
      const order = ['teacher', 'dj', 'dancer'];
      const got = derivePersonRoles(signals).map((r) => order.indexOf(r));
      expect(got).toEqual([...got].sort((a, b) => a - b));
    }
  });

  it('the first tab is the strongest role: teacher, else dj, else dancer', () => {
    expect(strongestRole(['teacher', 'dj', 'dancer'])).toBe('teacher');
    expect(strongestRole(['dj', 'dancer'])).toBe('dj');
    expect(strongestRole(['dancer'])).toBe('dancer');
    expect(strongestRole([])).toBeNull();
  });
});

describe('roleFromHash', () => {
  const ALL: PersonRole[] = ['teacher', 'dj', 'dancer'];
  it.each([
    ['#teaching', ALL, 'teacher'],
    ['#dj', ALL, 'dj'],
    ['#dancing', ALL, 'dancer'],
    ['#DJ', ALL, 'dj'],
    ['', ALL, 'teacher'],
    ['#nonsense', ALL, 'teacher'],
    ['#teaching', ['dj', 'dancer'] as PersonRole[], 'dj'],
    ['#dancing', ['teacher'] as PersonRole[], 'teacher'],
  ])('hash %j over %j opens %s', (hash, roles, expected) => {
    expect(roleFromHash(hash, roles)).toBe(expected);
  });
});

describe('links', () => {
  it('role pages and person tabs', () => {
    expect(rolePagePath('teacher', 'ana-g')).toBe('/teachers/ana-g');
    expect(rolePagePath('dj', 'ana-g')).toBe('/djs/ana-g');
    expect(rolePagePath('dancer', 'ana-g')).toBe('/dancers/ana-g');
    expect(peoplePath('ana-g')).toBe('/people/ana-g');
    expect(peoplePath('ana-g', 'teacher')).toBe('/people/ana-g#teaching');
    expect(peoplePath('ana-g', 'dj')).toBe('/people/ana-g#dj');
    expect(peoplePath('ana-g', 'dancer')).toBe('/people/ana-g#dancing');
  });
  it('"Also" lists every other role in tab order', () => {
    expect(otherRoles(['teacher', 'dj', 'dancer'], 'dj')).toEqual(['teacher', 'dancer']);
    expect(otherRoles(['dancer'], 'dancer')).toEqual([]);
  });
});
