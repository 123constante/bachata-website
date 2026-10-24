/**
 * People arc S1: the consistency matrix for src/modules/person-page/facts. Every fact
 * function x every real prod shape from docs/people-arc/worlds/data.md (branch
 * claude/people-arc-worlds; public display names only). A fact shown on two worlds
 * reads the same because both call the one function tested here.
 */
import { describe, expect, it } from 'vitest';
import type { PersonRole } from '../personRoles';
import { cityLabel, countLabel, dateLabel, flagCode, initials, languageLine, londonDayOf, publicName, stageName, worldNames } from '../facts';
import { languageName, languageNames } from '@/lib/languageNames';
import { formatKeyDayLabel } from '@/lib/londonDate';

type Shape = {
  key: string;
  name: string | null;
  djName?: string | null;
  city: string | null;
  languages: unknown[];
  nationality: string | null;
  roles: PersonRole[];
  expect: {
    names: Partial<Record<PersonRole, { big: string; small: string | null }>>;
    initials: string;
    city: string | null;
    languages: string | null;
    flag: string | null;
  };
};

// The real shapes (data.md + the P0 audit), plus the bug-class shapes the brief names.
const SHAPES: Shape[] = [
  { key: 'Magda (thin dancer-only)', name: 'Magda', city: 'London', languages: [], nationality: null, roles: ['dancer'],
    expect: { names: { dancer: { big: 'Magda', small: null } }, initials: 'M', city: 'London', languages: null, flag: null } },
  { key: 'Sabrina Guzman Pastor (long name)', name: 'Sabrina Guzman Pastor', city: 'London', languages: [], nationality: null, roles: ['dancer'],
    expect: { names: { dancer: { big: 'Sabrina Guzman Pastor', small: null } }, initials: 'SP', city: 'London', languages: null, flag: null } },
  { key: 'Pierre Henry (teacher, no city)', name: 'Pierre Henry', city: null, languages: [], nationality: null, roles: ['teacher'],
    expect: { names: { teacher: { big: 'Pierre Henry', small: null } }, initials: 'PH', city: null, languages: null, flag: null } },
  { key: 'Nadeem Malik (teacher, no city, a class)', name: 'Nadeem Malik', city: null, languages: [], nationality: null, roles: ['teacher'],
    expect: { names: { teacher: { big: 'Nadeem Malik', small: null } }, initials: 'NM', city: null, languages: null, flag: null } },
  { key: 'Papacito / Morcilla (DJ + dancer)', name: 'Papacito', djName: 'Morcilla', city: 'London', languages: [], nationality: 'ZA', roles: ['dj', 'dancer'],
    expect: { names: { dj: { big: 'Morcilla', small: 'Papacito' }, dancer: { big: 'Papacito', small: null } }, initials: 'P', city: 'London', languages: null, flag: 'ZA' } },
  { key: 'Ramiro Zapata x3 (no DJ name)', name: 'Ramiro Zapata', djName: null, city: 'London', languages: ['es', 'en'], nationality: 'BO', roles: ['teacher', 'dj', 'dancer'],
    expect: {
      names: { teacher: { big: 'Ramiro Zapata', small: null }, dj: { big: 'Ramiro Zapata', small: null }, dancer: { big: 'Ramiro Zapata', small: null } },
      initials: 'RZ', city: 'London', languages: 'Spanish, English', flag: 'BO',
    } },
  { key: 'double-space name + "DJ " stage name', name: '  Ana   Maria  Lopez ', djName: 'DJ  DJ Ana', city: ' London ', languages: [], nationality: 'es', roles: ['dj', 'dancer'],
    expect: { names: { dj: { big: 'Ana', small: 'Ana Maria Lopez' }, dancer: { big: 'Ana Maria Lopez', small: null } }, initials: 'AL', city: 'London', languages: null, flag: 'ES' } },
  { key: 'DJ name equal to the public name', name: 'Bobby Blanco', djName: 'DJ Bobby  Blanco', city: 'London', languages: [], nationality: null, roles: ['dj'],
    expect: { names: { dj: { big: 'Bobby Blanco', small: null } }, initials: 'BB', city: 'London', languages: null, flag: null } },
  { key: 'raw language codes', name: 'Lia', city: 'London', languages: ['ES', 'pt_BR', 'english', 'es', 'xx', '', null], nationality: null, roles: ['dancer'],
    expect: { names: { dancer: { big: 'Lia', small: null } }, initials: 'L', city: 'London', languages: 'Spanish, Brazilian Portuguese, English', flag: null } },
  { key: 'postcode city', name: 'Tom', city: 'London SE1 7PB', languages: [], nationality: 'GBR', roles: ['dancer'],
    expect: { names: { dancer: { big: 'Tom', small: null } }, initials: 'T', city: 'London', languages: null, flag: null } },
  { key: 'outward-code city, no name', name: null, city: 'London, E1', languages: [], nationality: '', roles: ['dancer', 'dj'],
    expect: { names: { dancer: { big: 'Dancer', small: null }, dj: { big: 'DJ', small: null } }, initials: '?', city: 'London', languages: null, flag: null } },
];

describe('facts x real shapes', () => {
  describe.each(SHAPES)('$key', (s) => {
    it.each(Object.entries(s.expect.names) as [PersonRole, { big: string; small: string | null }][])('name on the %s world', (role, want) => {
      expect(worldNames({ name: s.name, djName: s.djName }, role)).toEqual(want);
    });
    it('never shows a "DJ " prefix or a double space in any name', () => {
      for (const role of s.roles) {
        const n = worldNames({ name: s.name, djName: s.djName }, role);
        for (const text of [n.big, n.small].filter(Boolean) as string[]) {
          expect(text).not.toMatch(/\s{2}|^\s|\s$/);
          if (role === 'dj') expect(text).not.toMatch(/^dj\s/i);
        }
      }
    });
    it('initials', () => expect(initials(s.name)).toBe(s.expect.initials));
    it('city without postcode', () => expect(cityLabel(s.city)).toBe(s.expect.city));
    it('languages as full names', () => expect(languageLine(s.languages)).toBe(s.expect.languages));
    it('nationality as a flag code, never text', () => expect(flagCode(s.nationality)).toBe(s.expect.flag));
  });
});

describe('dateLabel: "Friday 23 October", London calendar day', () => {
  it.each([
    ['2026-10-23', 'Friday 23 October'],
    // Papacito's gig row (UTC; 22:00 BST)
    ['2026-10-23T21:00:00+00:00', 'Friday 23 October'],
    // Nadeem's class (19:30 GMT after the clocks change)
    ['2026-10-29T19:30:00+00:00', 'Thursday 29 October'],
    // 23:30 UTC on Saturday is 00:30 BST on Sunday: the London day, not the UTC one
    ['2026-10-24T23:30:00Z', 'Sunday 25 October'],
    ['2026-12-31T21:30:00+00:00', 'Thursday 31 December'],
    ['2026-11-07 19:30:00+00', 'Saturday 7 November'],
    [null, null], [undefined, null], ['', null], ['soon', null], ['2026-02-30', null],
  ])('%s -> %s', (raw, want) => expect(dateLabel(raw as string | null)).toBe(want));

  it('is the londonDate helper, not a second copy', () => {
    expect(dateLabel('2026-10-23')).toBe(formatKeyDayLabel('2026-10-23'));
    expect(londonDayOf('2026-10-24T23:30:00Z')).toBe('2026-10-25');
  });
});

describe('countLabel: only from 2', () => {
  it.each([
    [0, null], [1, null], [2, '2 gigs coming up'], [3, '3 gigs coming up'], [null, null], [undefined, null], [Number.NaN, null],
  ])('%s -> %s', (n, want) => expect(countLabel(n as number | null, 'gigs coming up')).toBe(want));
});

describe('name helpers', () => {
  it.each([
    ['Papacito', 'Papacito'], ['  John   Otaran ', 'John Otaran'], ['Ana\u00a0 Maria', 'Ana Maria'], ['   ', null], [null, null],
  ])('publicName(%j) -> %j', (raw, want) => expect(publicName(raw)).toBe(want));
  it.each([
    ['DJ Morcilla', 'Morcilla'], ['dj  dj  El Rugido', 'El Rugido'], ['DJ', 'DJ'], ['DJane Kim', 'DJane Kim'], [null, null],
  ])('stageName(%j) -> %j', (raw, want) => expect(stageName(raw)).toBe(want));
});

describe('src/lib/languageNames', () => {
  it('maps codes and old English-name saves, drops the unknown, each once', () => {
    expect(languageName('es')).toBe('Spanish');
    expect(languageName('English')).toBe('English');
    expect(languageName('xx')).toBeNull();
    expect(languageNames(['en', 'EN', 'English'])).toEqual(['English']);
    expect(languageNames(null)).toEqual([]);
  });
});
