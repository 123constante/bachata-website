import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

// The three public reads the old pages use, faked at the supabase boundary.
let dancerRow: Record<string, unknown> | null = null;
let djRow: unknown = null;
let teacherRows: unknown[] = [];
let djError: unknown = null;
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
      return fn === 'get_public_dj_v1' ? { data: djRow, error: djError } : { data: teacherRows, error: null };
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
  djRow = null; teacherRows = []; djError = null; flag.teacherDetail = true;
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

  it.each([['42883'], ['PGRST202']])('function missing (%s): falls back to the inferred signals', async (code) => {
    rolesResult = { data: null, error: { code } };
    teacherRows = [{ entity_id: 'p1' }]; djRow = { id: 'p1' };
    expect((await load())?.roles).toEqual(['teacher', 'dj']);
  });

  it('any OTHER error is surfaced, never a silent guess', async () => {
    rolesResult = { data: null, error: { code: '57014', message: 'statement timeout' } };
    teacherRows = [{ entity_id: 'p1' }];
    await expect(load()).rejects.toMatchObject({ code: '57014' });
  });
});
