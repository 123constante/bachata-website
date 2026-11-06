// Matrix for the organiser public page "Team" list (organiserTeam.ts). Shapes from
// the 2026-11-05 survey: 37 of 53 organisers list one person, 13 list 2-3, none
// more than 3, 4 list nobody; entity_members has 22 owners and 45 managers.
import { describe, expect, it } from 'vitest';
import {
  TEAM_VISIBLE_CAP,
  buildOrganiserTeam,
  runByLine,
  teamInitials,
  type AccessPerson,
  type ListedPerson,
  type TeamInput,
} from '../organiserTeam';

const listed = (n: number, over: Partial<ListedPerson> = {}): ListedPerson => ({
  personId: `p${n}`,
  name: `Person ${String.fromCharCode(64 + n)}`,
  avatarUrl: null,
  slug: `p${n}`,
  sortOrder: n,
  hidden: false,
  ...over,
});
const access = (userId: string, role: 'owner' | 'manager', over: Partial<AccessPerson> = {}): AccessPerson => ({
  personId: null,
  userId,
  name: `${role} ${userId}`,
  role,
  avatarUrl: null,
  slug: null,
  hidden: false,
  ...over,
});
const run = (input: Partial<TeamInput>) => buildOrganiserTeam({ listed: [], access: [], ...input });
const names = (r: ReturnType<typeof buildOrganiserTeam>) => r.people.map((p) => p.name);

describe('organiser Team mapping: counts and mode', () => {
  it.each([
    { n: 0, mode: 'empty', shown: 0, overflow: 0 },
    { n: 1, mode: 'solo', shown: 1, overflow: 0 },
    { n: 2, mode: 'list', shown: 2, overflow: 0 },
    { n: 3, mode: 'list', shown: 3, overflow: 0 },
    { n: 6, mode: 'list', shown: 6, overflow: 0 },
    { n: 7, mode: 'list', shown: 6, overflow: 1 },
  ])('$n listed people -> $mode, $shown shown, $overflow in overflow', ({ n, mode, shown, overflow }) => {
    const r = run({ listed: Array.from({ length: n }, (_, i) => listed(i + 1)) });
    expect(r.mode).toBe(mode);
    expect(r.people).toHaveLength(shown);
    expect(r.overflow).toHaveLength(overflow);
  });

  it('the cap is a named constant of 6', () => {
    expect(TEAM_VISIBLE_CAP).toBe(6);
  });

  it('7 people: the first 6 by rank are shown, the 7th overflows', () => {
    const r = run({ listed: Array.from({ length: 7 }, (_, i) => listed(i + 1)) });
    expect(r.people.map((p) => p.personId)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
    expect(r.overflow.map((p) => p.personId)).toEqual(['p7']);
  });

  it('a caller cap overrides the default; a nonsense cap falls back to it', () => {
    const seven = Array.from({ length: 7 }, (_, i) => listed(i + 1));
    expect(run({ listed: seven, cap: 3 }).people).toHaveLength(3);
    expect(run({ listed: seven, cap: 0 }).people).toHaveLength(6);
    expect(run({ listed: seven, cap: Number.NaN }).people).toHaveLength(6);
  });

  it('one person reads as "Run by <name>"', () => {
    const r = run({ listed: [listed(1, { name: 'Maya Rossi' })] });
    expect(r.mode).toBe('solo');
    expect(runByLine(r)).toBe('Run by Maya Rossi');
    expect(runByLine(run({}))).toBeNull();
    expect(runByLine(run({ listed: [listed(1), listed(2)] }))).toBeNull();
  });
});

describe('organiser Team mapping: merge and order', () => {
  it('owners first, then managers, then listed by sort_order', () => {
    const r = run({
      listed: [listed(2, { name: 'Zed' }), listed(1, { name: 'Yan' })],
      access: [access('u2', 'manager', { name: 'Mo' }), access('u1', 'owner', { name: 'Olu' })],
    });
    expect(names(r)).toEqual(['Olu', 'Mo', 'Yan', 'Zed']);
  });

  it('owner + manager and zero listed still gives a Team', () => {
    const r = run({ access: [access('u1', 'manager', { name: 'Ana' }), access('u2', 'owner', { name: 'Bo' })] });
    expect(r.mode).toBe('list');
    expect(names(r)).toEqual(['Bo', 'Ana']);
  });

  it('an owner who is also listed appears once, at owner rank', () => {
    const r = run({
      listed: [listed(1, { name: 'First' }), listed(2, { name: 'Owner Too', personId: 'dp9', slug: 'dp9', avatarUrl: 'a.jpg' })],
      access: [access('u9', 'owner', { personId: 'dp9', name: 'Owner Too' })],
    });
    expect(names(r)).toEqual(['Owner Too', 'First']);
    // The listed row fills what the access row lacks (page link, photo).
    expect(r.people[0]).toMatchObject({ personId: 'dp9', href: '/dancers/dp9', avatarUrl: 'a.jpg' });
  });

  it('duplicates across and within sources collapse to one person at the best rank', () => {
    const r = run({
      listed: [listed(1, { personId: 'dp1', name: 'Dup' }), listed(5, { personId: 'dp1', name: 'Dup' })],
      access: [access('u1', 'manager', { personId: 'dp1', name: 'Dup' }), access('u1b', 'owner', { personId: 'dp1', name: 'Dup' })],
    });
    expect(r.people).toHaveLength(1);
    expect(r.mode).toBe('solo');
  });

  it('access rows without a personId are distinct people, keyed by user', () => {
    const r = run({ access: [access('u1', 'owner', { name: 'Same Name' }), access('u2', 'owner', { name: 'Same Name' })] });
    expect(r.people).toHaveLength(2);
    expect(new Set(r.people.map((p) => p.personId)).size).toBe(2);
  });

  it('ties: equal sort_order (or none) falls to name A-Z, case-insensitive', () => {
    const r = run({
      listed: [
        listed(1, { name: 'carla', sortOrder: 1 }),
        listed(2, { name: 'Bea', sortOrder: 1 }),
        listed(3, { name: 'Ana', sortOrder: null }),
        listed(4, { name: 'Dee', sortOrder: 0 }),
      ],
      access: [access('u1', 'owner', { name: 'zoe' }), access('u2', 'owner', { name: 'Al' })],
    });
    expect(names(r)).toEqual(['Al', 'zoe', 'Dee', 'Bea', 'carla', 'Ana']);
    // Ana (no sort_order) sorts after every numbered row; carla after Bea.
    const all = run({
      listed: [listed(1, { name: 'carla', sortOrder: 1 }), listed(2, { name: 'Bea', sortOrder: 1 }), listed(3, { name: 'Ana', sortOrder: null })],
    });
    expect(names(all)).toEqual(['Bea', 'carla', 'Ana']);
  });

  it('the result is stable for any input order', () => {
    const rows = [listed(1, { sortOrder: 1, name: 'X' }), listed(2, { sortOrder: 1, name: 'X' }), listed(3)];
    const a = run({ listed: rows });
    const b = run({ listed: [...rows].reverse() });
    expect(a).toEqual(b);
  });
});

describe('organiser Team mapping: what a visitor may see', () => {
  it('a hidden person never appears', () => {
    const r = run({ listed: [listed(1), listed(2, { hidden: true })], access: [access('u1', 'manager', { hidden: true })] });
    expect(r.people.map((p) => p.personId)).toEqual(['p1']);
    expect(r.mode).toBe('solo');
  });

  it('hidden in any source hides the merged person', () => {
    const r = run({
      listed: [listed(1, { personId: 'dp1', hidden: true })],
      access: [access('u1', 'owner', { personId: 'dp1' })],
    });
    expect(r.mode).toBe('empty');
  });

  it('everyone hidden -> empty', () => {
    expect(run({ listed: [listed(1, { hidden: true })] }).mode).toBe('empty');
  });

  it('blank and whitespace names are dropped; names are trimmed', () => {
    const r = run({
      listed: [listed(1, { name: '' }), listed(2, { name: '   \t' }), listed(3, { name: null }), listed(4, { name: '  Lia  ' })],
      access: [access('u1', 'manager', { name: ' ' })],
    });
    expect(names(r)).toEqual(['Lia']);
    expect(r.mode).toBe('solo');
  });

  it('a blank name on the best-rank row borrows the name from another source', () => {
    const r = run({ listed: [listed(1, { personId: 'dp1', name: 'Real Name' })], access: [access('u1', 'owner', { personId: 'dp1', name: '' })] });
    expect(names(r)).toEqual(['Real Name']);
  });

  it('a very long name is kept whole (truncation is the screen job)', () => {
    const long = 'Maria '.repeat(40).trim();
    expect(names(run({ listed: [listed(1, { name: long })] }))).toEqual([long]);
  });

  it('no slug -> href null (shown, not tappable); a slug -> the dancer page', () => {
    const r = run({ listed: [listed(1, { slug: null }), listed(2, { slug: 'abc' }), listed(3, { slug: '  ' })] });
    expect(r.people.map((p) => p.href)).toEqual([null, '/dancers/abc', null]);
  });

  it('never exposes anything but the public fields', () => {
    const r = run({ access: [access('u1', 'owner', { name: 'Kay' })] });
    expect(Object.keys(r.people[0]).sort()).toEqual(['avatarUrl', 'href', 'initials', 'name', 'personId']);
  });

  it('avatar: kept when set, null when missing or blank, initials always present', () => {
    const r = run({ listed: [listed(1, { name: 'Ana Silva', avatarUrl: 'x.jpg' }), listed(2, { name: 'Bo', avatarUrl: ' ' })] });
    expect(r.people.map((p) => [p.avatarUrl, p.initials])).toEqual([['x.jpg', 'AS'], [null, 'B']]);
  });
});

describe('organiser Team mapping: unicode', () => {
  it('keeps accented and non-Latin names and sorts them sensibly', () => {
    const r = run({
      listed: [
        listed(1, { name: 'Élodie Durand', sortOrder: null }),
        listed(2, { name: 'Zoë', sortOrder: null }),
        listed(3, { name: 'Ana', sortOrder: null }),
      ],
    });
    expect(names(r)).toEqual(['Ana', 'Élodie Durand', 'Zoë']);
    expect(r.people[1].initials).toBe('ÉD');
  });

  it('initials never split a surrogate pair', () => {
    expect(teamInitials('💃 Dancer')).toBe('💃D');
    expect(teamInitials('张伟')).toBe('张');
    expect(teamInitials('')).toBe('?');
  });
});
