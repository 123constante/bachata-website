/**
 * Search v7 review F1+F2: the search row and /people/:id must agree. For EVERY role
 * combination on prod (person_roles survey 2026-10-20, counts in the name) x the teacher
 * flag x get_public_person_roles_v1 present / missing (prod today), the roles on the search
 * row == the person page's tabs == its chips, and a search click never lands on a 404 or
 * on a Dancer page for someone who does not dance.
 *
 * Search side: searchPublicV3 (the header omnibox and the overlay). Since W1 (review M1) the
 * overlay row links the role pages through badges.ts, as the /search PersonRow does
 * (tests/searchV7People.test.tsx pins the two agree). Page side: the /people loader's
 * loadPersonSnapshot over faked public reads, i.e. what a typed /people URL shows.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

type Role = 'teacher' | 'dj' | 'dancer';

const h = vi.hoisted(() => ({
  people: [] as unknown[],
  dancerRow: null as Record<string, unknown> | null,
  djRow: null as unknown,
  teacherRows: [] as unknown[],
  roles: { data: null, error: { code: 'PGRST202' } } as { data: unknown; error: { code?: string } | null },
}));
const flag = vi.hoisted(() => ({ searchV5: true, searchV6: true, searchV7: true, teacherDetail: false }));
vi.mock('@/lib/featureFlags', () => ({ flags: flag }));
vi.mock('@/lib/festivalsList', () => ({ fetchPublicFestivalsList: async () => [], filterUpcomingFestivals: (rows: unknown[]) => rows }));
const rpc = vi.hoisted(() => async (fn: string) => {
  if (fn === 'search_public_v7') {
    return { data: { query: 'x', events: [], organisers: [], venues: [], vendors: [], cities: [], people: h.people, total_count: h.people.length }, error: null };
  }
  if (fn === 'get_public_person_roles_v1') return h.roles;
  if (fn === 'get_public_dj_v1') return { data: h.djRow, error: null };
  if (fn === 'get_public_teacher_detail_v1') return { data: h.teacherRows, error: null };
  return { data: null, error: null };
});
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => ({ rpc }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc,
    from: () => {
      const q: Record<string, unknown> = {};
      q.select = () => q; q.eq = () => q; q.not = () => q;
      q.maybeSingle = async () => ({ data: h.dancerRow, error: null });
      return q;
    },
  },
}));
vi.mock('@/modules/profile/dancerPublicProfile', async (orig) => {
  const real = await orig<typeof import('@/modules/profile/dancerPublicProfile')>();
  return { ...real, attachPublicDancerName: async (r: Record<string, unknown>) => ({ ...r, display_name: 'Ana' }) };
});

import { searchPublicV3 } from '@/lib/searchRpc';
import { loadPersonSnapshot } from '../reads';
import { ROLE_ORDER } from '../personRoles';

// person_roles -> the public roles search v7 returns (organising / performing are not public).
const PUBLIC: Record<string, Role> = { teaching: 'teacher', djing: 'dj', dancing: 'dancer' };
const PROD_COMBOS: Array<[string, number]> = [
  ['teaching', 62], ['dancing+teaching', 34], ['dancing+djing+teaching', 21], ['dancing', 19],
  ['dancing+djing', 10], ['djing', 4], ['djing+teaching', 2], ['dancing+djing+organising+teaching', 2],
  ['dancing+performing+teaching', 1], ['dancing+organising+teaching', 1],
];
const toPublic = (combo: string): Role[] =>
  ROLE_ORDER.filter((r) => combo.split('+').some((c) => PUBLIC[c] === r));

type Data = {
  /** get_public_teacher_detail_v1 returns a row (61 of 63 teacher-only personas: no). */
  teacherRow: boolean;
  /** The dancer section carries content (27 of 34 dancing+teaching: no). */
  dancerContent: boolean;
};
const DATA: Array<[string, Data]> = [
  ['every read agrees with person_roles', { teacherRow: true, dancerContent: true }],
  ['no teacher-detail row', { teacherRow: false, dancerContent: true }],
  ['empty dancer section', { teacherRow: true, dancerContent: false }],
];

const setUp = (roles: Role[], data: Data, rpcPresent: boolean) => {
  h.people = [{ id: 'p1', first_name: 'Ana', surname: null, display_name: 'Ana', photo_url: null, avatar_url: null, slug: null, nationality_code: null, roles, primary_role: roles[0] }];
  h.dancerRow = {
    id: 'p1', first_name: 'Ana', nationality: null, dance_role: null, instagram: null, facebook: null, avatar_url: null,
    website_url: null, gallery_urls: null, cities: { name: 'London' },
    dancing_role_details: roles.includes('dancer') && data.dancerContent ? { dance_started_year: 2015 } : null,
  };
  h.djRow = roles.includes('dj') ? { id: 'p1', display_name: 'DJ Ana' } : null;
  h.teacherRows = roles.includes('teacher') && data.teacherRow ? [{ entity_id: 'p1' }] : [];
  h.roles = rpcPresent ? { data: roles, error: null } : { data: null, error: { code: 'PGRST202' } };
};

const CASES = PROD_COMBOS.flatMap(([combo, n]) =>
  [false, true].flatMap((teacherOpen) =>
    [true, false].flatMap((rpcPresent) =>
      DATA.map(([dataName, data]) => ({
        name: `${combo} (${n}), teacher ${teacherOpen ? 'on' : 'off'}, roles RPC ${rpcPresent ? 'present' : 'missing'}, ${dataName}`,
        roles: toPublic(combo), teacherOpen, rpcPresent, data,
      })),
    ),
  ),
);

beforeEach(() => { flag.teacherDetail = false; });

describe('search row == person page (tabs, chips), every prod combination', () => {
  it.each(CASES)('$name', async ({ roles, teacherOpen, rpcPresent, data }) => {
    flag.teacherDetail = teacherOpen;
    setUp(roles, data, rpcPresent);
    const rows = await searchPublicV3('ana', 'london', 5, false);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    const visible = roles.filter((r) => r !== 'teacher' || teacherOpen);

    // W1 review M1: the search row is the badges mapping's answer (the /search PersonRow's):
    // every public role as a tag (Teacher plain while closed), link DJ page, else dancer page,
    // else teacher page while open, else the (city-scoped) search results. Never /people/, never the gate.
    expect(row.kind).toBe('person');
    expect(row.roles ?? []).toEqual(roles);
    const want = roles.includes('dj') ? '/djs/p1' : roles.includes('dancer') ? '/dancers/p1'
      : roles.includes('teacher') && teacherOpen ? '/teachers/p1' : '/city/london/search?q=Ana';
    expect(row.href).toBe(want);

    if (roles.length === 1 && roles[0] === 'teacher') {
      expect(row.subtitle).toBe('Teacher');
      // Not reachable from search, but pinned: what a typed /people URL shows for them.
      const direct = await loadPersonSnapshot(new QueryClient(), 'p1');
      if (rpcPresent) {
        expect(direct!.roles).toEqual(teacherOpen ? ['teacher'] : []); // closed = 404, like the gate
      } else if (teacherOpen && data.teacherRow) {
        expect(direct!.roles).toEqual(['teacher']);
      } else {
        // KNOWN GAP until get_public_person_roles_v1 is on prod: no visible teacher signal, so the
        // inferred default shows Dancer (owner data question: 61 of 63 have no teacher-detail row).
        expect(direct!.roles).toEqual(['dancer']);
      }
      return;
    }
    // A typed /people URL (no search row links it any more) never 404s and never shows
    // Dancing to someone who does not dance.
    const page = await loadPersonSnapshot(new QueryClient(), 'p1');
    expect(page).not.toBeNull();
    expect(page!.roles.length).toBeGreaterThan(0);
    if (!roles.includes('dancer')) expect(page!.roles).not.toContain('dancer');
    for (const r of page!.roles) expect(visible).toContain(r);

    // Tabs and chips are the one list `roles` (PersonPage renders both from it).
    const exact = rpcPresent || (data.teacherRow && data.dancerContent);
    if (exact) expect(page!.roles).toEqual(visible);
  });
});
