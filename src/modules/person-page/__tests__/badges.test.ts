import { describe, expect, it } from 'vitest';
import { ROLE_LABEL, type PersonRole } from '@/lib/searchEntities';
import {
  hrefForRole, leadRole, linkFor, nameFor, parseBadges, roleTagsFor, type PersonBadge,
} from '../badges';

const ID = '11111111-1111-1111-1111-111111111111';
const raw = (roles: unknown, extra: Record<string, unknown> = {}) => ({
  id: ID, roles, dj_name: null, next_gig_date: null, dj_has_upcoming: false, ...extra,
});

type Shape = {
  name: string;
  row: unknown;
  labels: string[]; // roleTagsFor, no stage name
  stageLabels: string[]; // roleTagsFor withStageName
  link: (open: boolean) => string | null;
  lead: PersonRole | null;
};
const dj = `/djs/${ID}`;
const dancer = `/dancers/${ID}`;
const teacher = `/teachers/${ID}`;

const SHAPES: Shape[] = [
  { name: 'dancer-only', row: raw(['dancer']), labels: ['Dancer'], stageLabels: ['Dancer'], link: () => dancer, lead: 'dancer' },
  {
    name: 'DJ-only with gig', row: raw(['dj'], { dj_name: 'Kiko', dj_has_upcoming: true, next_gig_date: '2026-11-01' }),
    labels: ['DJ'], stageLabels: ['DJ \u00b7 Kiko'], link: () => dj, lead: 'dj',
  },
  { name: 'DJ-only without gig', row: raw(['dj'], { dj_name: 'Kiko' }), labels: ['DJ'], stageLabels: ['DJ \u00b7 Kiko'], link: () => dj, lead: 'dj' },
  {
    name: 'DJ+dancer with gig', row: raw(['dj', 'dancer'], { dj_name: 'Kiko', dj_has_upcoming: true }),
    labels: ['DJ', 'Dancer'], stageLabels: ['DJ \u00b7 Kiko', 'Dancer'], link: () => dj, lead: 'dj',
  },
  {
    name: 'DJ+dancer without gig', row: raw(['dancer', 'dj'], { dj_name: 'Kiko' }),
    labels: ['DJ', 'Dancer'], stageLabels: ['DJ \u00b7 Kiko', 'Dancer'], link: () => dj, lead: 'dancer',
  },
  { name: 'dancer+teacher', row: raw(['dancer', 'teacher']), labels: ['Teacher', 'Dancer'], stageLabels: ['Teacher', 'Dancer'], link: () => dancer, lead: 'dancer' },
  { name: 'teacher-only', row: raw(['teacher']), labels: ['Teacher'], stageLabels: ['Teacher'], link: (o) => (o ? teacher : null), lead: 'teacher' },
  {
    name: 'djName starts with DJ', row: raw(['dj'], { dj_name: 'DJ X' }),
    labels: ['DJ'], stageLabels: ['DJ \u00b7 X'], link: () => dj, lead: 'dj',
  },
  // review 7b: the label never repeats the word ("DJ \u00b7 DJ El Rugido"); the tile/page name keeps it
  {
    name: 'djName "DJ El Rugido"', row: raw(['dj', 'dancer'], { dj_name: 'DJ El Rugido' }),
    labels: ['DJ', 'Dancer'], stageLabels: ['DJ \u00b7 El Rugido', 'Dancer'], link: () => dj, lead: 'dancer',
  },
  { name: 'djName lower-case "dj kiko"', row: raw(['dj'], { dj_name: 'dj  kiko' }), labels: ['DJ'], stageLabels: ['DJ \u00b7 kiko'], link: () => dj, lead: 'dj' },
  { name: 'djName "DJane Kiko" (no space after DJ)', row: raw(['dj'], { dj_name: 'DJane Kiko' }), labels: ['DJ'], stageLabels: ['DJ \u00b7 DJane Kiko'], link: () => dj, lead: 'dj' },
  { name: 'djName is just "DJ "', row: raw(['dj'], { dj_name: 'DJ ' }), labels: ['DJ'], stageLabels: ['DJ'], link: () => dj, lead: 'dj' },
  { name: 'djName null', row: raw(['dj']), labels: ['DJ'], stageLabels: ['DJ'], link: () => dj, lead: 'dj' },
  { name: 'empty roles', row: raw([]), labels: [], stageLabels: [], link: () => null, lead: null },
  { name: 'unknown roles only', row: raw(['organising', 'filming']), labels: [], stageLabels: [], link: () => null, lead: null },
  {
    name: 'person_roles spellings', row: raw(['dancing', 'djing', 'teaching', 'performing']),
    labels: ['Teacher', 'DJ', 'Dancer'], stageLabels: ['Teacher', 'DJ', 'Dancer'], link: () => dj, lead: 'dancer',
  },
];

const parse = (s: Shape): PersonBadge => parseBadges([s.row]).get(ID) as PersonBadge;

describe.each([false, true])('badges, teacherPagesOpen=%s', (open) => {
  const opts = { teacherPagesOpen: open };

  it.each(SHAPES)('$name', (s) => {
    const b = parse(s);
    const tags = roleTagsFor(b, opts);
    // the Teacher tag shows as plain text while closed, so labels do not depend on `open`
    expect(tags.map((t) => t.label)).toEqual(s.labels);
    expect(roleTagsFor(b, { ...opts, withStageName: true }).map((t) => t.label)).toEqual(s.stageLabels);
    expect(linkFor(b, opts)).toBe(s.link(open));
    expect(leadRole(b)).toBe(s.lead);
    for (const t of tags) {
      expect(t.href).toBe(t.role === 'teacher' && !open ? null : hrefForRole(t.role, ID, opts));
    }
  });

  it('invariants across the whole table', () => {
    for (const s of SHAPES) {
      const b = parse(s);
      const tags = [...roleTagsFor(b, { ...opts, withStageName: true }), ...roleTagsFor(b, opts)];
      for (const t of tags) {
        if (!open && t.href) expect(t.href.startsWith('/teachers/')).toBe(false);
        expect(t.label === ROLE_LABEL[t.role] || t.label.startsWith(`${ROLE_LABEL.dj} \u00b7 `)).toBe(true);
      }
      const link = linkFor(b, opts);
      if (!open) expect(link === null || !link.startsWith('/teachers/')).toBe(true);
      const linkable = b.roles.some((r) => r !== 'teacher' || open);
      expect(link === null).toBe(!linkable);
    }
  });
});

describe('names, exclude, parse', () => {
  it('stage name leads only in the dj context', () => {
    const p = { name: 'Real Name', djName: 'Kiko' };
    expect(nameFor('dj', p)).toBe('Kiko');
    expect(nameFor('other', p)).toBe('Real Name');
    expect(nameFor('dj', { name: 'Real Name', djName: null })).toBe('Real Name');
    expect(nameFor('dj', { name: 'Real Name' })).toBe('Real Name');
  });

  it('exclude drops the role of the page you are on', () => {
    const b = parse(SHAPES[3]);
    expect(roleTagsFor(b, { teacherPagesOpen: true, exclude: 'dj' }).map((t) => t.label)).toEqual(['Dancer']);
  });

  it('linkFor on a missing badge is null', () => {
    expect(linkFor(undefined, { teacherPagesOpen: true })).toBeNull();
  });

  it('garbage input to parseBadges', () => {
    for (const g of [null, undefined, 5, 'x', {}, [null, 1, 'x', {}, { id: 3 }, { id: '' }], [{ id: 'a', roles: 'dj' }]]) {
      const m = parseBadges(g);
      expect([...m.values()].every((b) => Array.isArray(b.roles))).toBe(true);
    }
    expect(parseBadges(null).size).toBe(0);
    expect(parseBadges([{ id: 'a', roles: 'dj' }]).get('a')?.roles).toEqual([]);
    const ok = parseBadges([raw(['dj'], { dj_name: '  ', dj_has_upcoming: 'yes' })]).get(ID);
    expect(ok).toMatchObject({ djName: null, djHasUpcoming: false, nextGigDate: null });
  });
});
