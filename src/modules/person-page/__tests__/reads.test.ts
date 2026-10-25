import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

// The three public reads the old pages use, faked at the supabase boundary.
let dancerRow: Record<string, unknown> | null = null;
let djRow: unknown = null;
let teacherRows: unknown[] = [];
let djError: unknown = null;
// S7c: the teacher RPC answering an error, or the call itself throwing.
let teacherFail: 'error' | 'throw' | 'missing' | null = null;
let rolesResult: { data: unknown; error: { code?: string; message?: string } | null } = { data: null, error: { code: '42883' } };
const rolesCall = vi.fn();
const names = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => {
      const q: Record<string, unknown> = {};
      q.select = () => q; q.eq = () => q; q.not = () => q;
      q.maybeSingle = async () => ({ data: dancerRow, error: null });
      return q;
    },
    rpc: async (fn: string, args?: unknown) => {
      if (fn === 'get_public_person_roles_v1') { rolesCall(args); return rolesResult; }
      if (fn === 'get_public_dj_v1') return { data: djRow, error: djError };
      if (teacherFail === 'throw') throw new Error('network');
      if (teacherFail === 'missing') return { data: null, error: { code: 'PGRST202' } };
      return { data: teacherRows, error: teacherFail === 'error' ? { code: '57014' } : null };
    },
  },
}));
vi.mock('@/modules/profile/dancerPublicProfile', async (orig) => {
  const real = await orig<typeof import('@/modules/profile/dancerPublicProfile')>();
  return { ...real, attachPublicDancerName: async (r: Record<string, unknown>) => ({ ...r, ...names(r) }) };
});
const flag = vi.hoisted(() => ({ teacherDetail: true }));
vi.mock('@/lib/featureFlags', () => ({ flags: flag }));

import { loadPersonSnapshot } from '../reads';

const base = { id: 'p1', first_name: 'Ana', nationality: null, dance_role: null, instagram: 'https://instagram.com/ana_g', facebook: null, avatar_url: 'https://cdn.example.test/a.jpg', website_url: null, gallery_urls: null, cities: { name: 'London' }, dancing_role_details: null };
const load = () => loadPersonSnapshot(new QueryClient(), 'p1');

beforeEach(() => {
  dancerRow = { ...base };
  djRow = null; teacherRows = []; djError = null; teacherFail = null; flag.teacherDetail = true;
  rolesResult = { data: null, error: { code: '42883' } }; rolesCall.mockClear();
  names.mockReturnValue({ surname: null, display_name: 'Ana' });
});

describe('loadPersonSnapshot', () => {
  it('unknown id or archived/deactivated person (no public dancer row) -> null, so the route 404s', async () => {
    dancerRow = null;
    expect(await load()).toBeNull();
  });

  it('hidden surname: the name comes from the masked read, never the raw columns', async () => {
    names.mockReturnValue({ surname: null, display_name: 'Ana' });
    dancerRow = { ...base, surname: 'Secret' };
    expect((await load())?.name).toBe('Ana');
  });

  it.each([
    ['teacher only', [{ entity_id: 'p1' }], null, ['teacher']],
    ['dj only', [], { id: 'p1', display_name: 'DJ Ana' }, ['dj']],
    ['teacher + dj, no dancer content', [{ entity_id: 'p1' }], { id: 'p1' }, ['teacher', 'dj']],
    ['bare dancer row', [], null, ['dancer']],
  ])('%s', async (_n, t, d, expected) => {
    teacherRows = t; djRow = d;
    expect((await load())?.roles).toEqual(expected);
  });

  it('dancer content adds Dancing next to the other roles', async () => {
    teacherRows = [{ entity_id: 'p1' }]; djRow = { id: 'p1' };
    dancerRow = { ...base, dancing_role_details: { dance_started_year: 2015, favorite_styles: ['Sensual'] } };
    expect((await load())?.roles).toEqual(['teacher', 'dj', 'dancer']);
  });

  it('teacher pages closed (flag off): no Teaching tab, same as the locked old page', async () => {
    flag.teacherDetail = false; teacherRows = [{ entity_id: 'p1' }]; djRow = { id: 'p1' };
    expect((await load())?.roles).toEqual(['dj']);
  });

  it('a DJ-read error hides the DJ tab but does not take the page down', async () => {
    djError = new Error('boom'); teacherRows = [{ entity_id: 'p1' }];
    expect((await load())?.roles).toEqual(['teacher']);
  });

  it('carries city and the Instagram link for the header', async () => {
    const p = await load();
    expect(p?.city).toBe('London');
    expect(p?.instagramUrl).toBe('https://instagram.com/ana_g');
  });
});

// S2b2: roles from get_public_person_roles_v1.
describe('loadPersonSnapshot: roles from the database', () => {
  const ok = (roles: string[]) => { rolesResult = { data: roles, error: null }; };

  it('asks the function with the person id and uses its answer, ignoring the inferred signals', async () => {
    ok(['teacher', 'dancer']);
    djRow = { id: 'p1' }; // would infer dj; the database says no
    const p = await load();
    expect(rolesCall).toHaveBeenCalledWith({ p_person_id: 'p1' });
    expect(p?.roles).toEqual(['teacher', 'dancer']);
  });

  it('holds dancing with an EMPTY dancer section -> Dancing tab (the inference gap is closed)', async () => {
    ok(['teacher', 'dj', 'dancer']);
    expect((await load())?.roles).toEqual(['teacher', 'dj', 'dancer']);
  });

  it('no public roles -> empty roles (the route 404s)', async () => {
    ok([]);
    expect((await load())?.roles).toEqual([]);
  });

  it('teacher flag off: Teaching AND the Teacher role are both gone; on: both there', async () => {
    ok(['teacher', 'dancer']);
    flag.teacherDetail = false;
    expect((await load())?.roles).toEqual(['dancer']);
    flag.teacherDetail = true;
    expect((await load())?.roles).toEqual(['teacher', 'dancer']);
  });

  it('heldRoles keeps the closed Teacher (the wall\'s chips), from the same read, no second call', async () => {
    ok(['teacher', 'dj', 'dancer']);
    flag.teacherDetail = false;
    const p = await load();
    expect(p?.roles).toEqual(['dj', 'dancer']);
    expect(p?.heldRoles).toEqual(['teacher', 'dj', 'dancer']);
    expect(rolesCall).toHaveBeenCalledTimes(1);
  });

  it.each([['42883'], ['PGRST202']])('function missing (%s): falls back to the inferred signals', async (code) => {
    rolesResult = { data: null, error: { code } };
    teacherRows = [{ entity_id: 'p1' }]; djRow = { id: 'p1' };
    expect((await load())?.roles).toEqual(['teacher', 'dj']);
    expect((await load())?.heldRoles).toEqual(['teacher', 'dj']);
  });

  it('any OTHER error is surfaced, never a silent guess', async () => {
    rolesResult = { data: null, error: { code: '57014', message: 'statement timeout' } };
    teacherRows = [{ entity_id: 'p1' }];
    await expect(load()).rejects.toMatchObject({ code: '57014' });
  });
});

// S7c: a swallowed role read still answers (the page stays up), but says it is partial, so the
// loaders bound the edge TTL instead of caching a page that lost a tab for the full hour.
describe('loadPersonSnapshot: partial answers', () => {
  const ROWS: { name: string; dj: boolean; teacher: 'error' | 'throw' | 'missing' | null; teacherDetail?: boolean; partial: boolean }[] = [
    { name: 'neither fails', dj: false, teacher: null, partial: false },
    { name: 'DJ read fails', dj: true, teacher: null, partial: true },
    { name: 'teacher RPC answers an error', dj: false, teacher: 'error', partial: true },
    { name: 'teacher RPC throws', dj: false, teacher: 'throw', partial: true },
    { name: 'both fail', dj: true, teacher: 'error', partial: true },
    { name: 'teacher RPC not deployed (a deploy gap, not a failure)', dj: false, teacher: 'missing', partial: false },
    { name: 'teacher pages closed: the teacher RPC is not called, so it cannot fail', dj: false, teacher: 'throw', teacherDetail: false, partial: false },
  ];
  it.each(ROWS)('$name -> partial $partial, the person still answers', async (r) => {
    djRow = { id: 'p1' }; teacherRows = [{ entity_id: 'p1' }];
    if (r.dj) djError = new Error('boom');
    teacherFail = r.teacher;
    flag.teacherDetail = r.teacherDetail ?? true;
    const p = await load();
    expect(p).not.toBeNull();
    expect(p?.partial === true).toBe(r.partial);
    // Only a partial answer carries the flag: a complete one is the same object shape as before.
    expect('partial' in (p as object)).toBe(r.partial);
  });

  it('roles from the database: a failed teacher RPC is NOT partial (its answer is not used)', async () => {
    rolesResult = { data: ['teacher', 'dancer'], error: null };
    teacherFail = 'error';
    const p = await load();
    expect(p?.roles).toEqual(['teacher', 'dancer']);
    expect(p && 'partial' in p).toBe(false);
  });

  it.each([
    ['DB says no dj, avatar set: nothing lost', ['dancer'], 'https://cdn.example.test/a.jpg', false],
    ['DB says no dj, no avatar: the DJ photo stand-in is lost', ['dancer'], null, true],
  ])('roles from the database, DJ read fails, %s -> partial %s', async (_n, roles, avatar, partial) => {
    rolesResult = { data: roles, error: null };
    dancerRow = { ...base, avatar_url: avatar };
    djError = new Error('boom');
    expect((await load())?.partial === true).toBe(partial);
  });

  it('DJ function not deployed (PGRST202): a deploy gap, not partial', async () => {
    djError = { code: 'PGRST202' };
    expect('partial' in ((await load()) as object)).toBe(false);
  });

  it('roles from the database: a failed DJ read is still partial (the DJ tab can show)', async () => {
    rolesResult = { data: ['dj', 'dancer'], error: null };
    djError = new Error('boom');
    const p = await load();
    expect(p?.roles).toEqual(['dj', 'dancer']);
    expect(p?.partial).toBe(true);
  });
});
