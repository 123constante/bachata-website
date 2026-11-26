// @vitest-environment jsdom
/**
 * flags.hubOrganiserCard: the hub shows one Organiser card per organiser page the person is on the
 * public team of, after the role cards. Flag off = no card and no `organisers` key in the snapshot.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
  flags: { teacherDetail: true, hubOrganiserCard: false },
  orgs: { data: [] as unknown, error: null as null | { code?: string }, throws: false },
}));

vi.mock('@/lib/featureFlags', () => ({ flags: h.flags }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => {
      const q: Record<string, unknown> = {};
      q.select = () => q; q.eq = () => q; q.not = () => q;
      q.maybeSingle = async () => ({ data: { id: 'p1', first_name: 'Ana', cities: { name: 'London' }, dancing_role_details: { dance_started_year: 2015 } }, error: null });
      return q;
    },
    rpc: async (fn: string) => {
      if (fn === 'get_public_person_organisers_v1') {
        if (h.orgs.throws) throw new Error('network');
        return { data: h.orgs.data, error: h.orgs.error };
      }
      if (fn === 'get_public_person_roles_v1') return { data: ['dancer'], error: null };
      return { data: null, error: null };
    },
  },
}));
vi.mock('@/modules/profile/dancerPublicProfile', async (orig) => {
  const real = await orig<typeof import('@/modules/profile/dancerPublicProfile')>();
  return { ...real, attachPublicDancerName: async (r: Record<string, unknown>) => ({ ...r, surname: null, display_name: 'Ana' }) };
});
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/hooks/useProfileProgramAppearances', () => ({ useProfileProgramAppearances: () => ({ data: undefined }) }));
vi.mock('@/lib/profileViewEmit', () => ({ emitProfileView: vi.fn() }));

import { loadPersonSnapshot, type PersonSnapshot } from '../../reads';
import { hubModel } from '../model';
import PersonHub from '../PersonHub';

const ORGS = [
  { organiser_id: 'o1', slug: 'salsa-nights', name: 'Salsa Nights' },
  { organiser_id: 'o2', slug: null, name: 'Bachata Club' },
];
const snap = (organisers?: PersonSnapshot['organisers']): PersonSnapshot => ({
  id: 'p1', name: 'Ana Garcia', avatarUrl: null, city: 'London', instagramUrl: null,
  roles: ['dancer'], heldRoles: ['dancer'], djPhoto: null, ...(organisers ? { organisers } : {}),
});
const renderHub = (person: PersonSnapshot) =>
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient()}><PersonHub person={person} /></QueryClientProvider>
    </MemoryRouter>,
  );

beforeEach(() => { h.flags.hubOrganiserCard = false; h.orgs.data = ORGS; h.orgs.error = null; h.orgs.throws = false; });
afterEach(cleanup);

describe('loader snapshot', () => {
  it('flag off: no organisers key', async () => {
    const s = await loadPersonSnapshot(new QueryClient(), 'p1');
    expect(s).not.toBeNull();
    expect('organisers' in (s as object)).toBe(false);
  });
  it('flag on: organisers mapped', async () => {
    h.flags.hubOrganiserCard = true;
    const s = await loadPersonSnapshot(new QueryClient(), 'p1');
    expect(s?.organisers).toEqual([
      { id: 'o1', slug: 'salsa-nights', name: 'Salsa Nights' },
      { id: 'o2', slug: null, name: 'Bachata Club' },
    ]);
  });
  it.each([
    ['error', () => { h.orgs.error = { code: '57014' }; }],
    ['missing function', () => { h.orgs.error = { code: 'PGRST202' }; }],
    ['throws', () => { h.orgs.throws = true; }],
    ['non-array', () => { h.orgs.data = null; }],
  ])('flag on, read failure (%s): [] and the page still loads', async (_n, arrange) => {
    h.flags.hubOrganiserCard = true;
    arrange();
    const s = await loadPersonSnapshot(new QueryClient(), 'p1');
    expect(s?.organisers).toEqual([]);
    expect(s?.roles).toEqual(['dancer']);
  });
});

describe('hub model and render', () => {
  it('flag off / no organisers: only the role cards', () => {
    renderHub(snap());
    expect(screen.getAllByTestId('hub-role-card').map((c) => c.getAttribute('data-role'))).toEqual(['dancer']);
  });
  it('2 organisers: 2 cards after the role cards, with the organiser page hrefs', () => {
    const m = hubModel({ person: snap([{ id: 'o1', slug: 'salsa-nights', name: 'Salsa Nights' }, { id: 'o2', slug: null, name: 'Bachata Club' }]), dancerRow: null, dj: null, appearances: undefined, opts: { teacherPagesOpen: true } });
    expect(m.cards.map((c) => [c.role, c.label, c.line, c.href])).toEqual([
      ['dancer', m.cards[0].label, m.cards[0].line, m.cards[0].href],
      ['organiser', 'Organiser', 'Salsa Nights', '/organisers/salsa-nights'],
      ['organiser', 'Organiser', 'Bachata Club', '/organisers/o2'],
    ]);
    renderHub(snap([{ id: 'o1', slug: 'salsa-nights', name: 'Salsa Nights' }, { id: 'o2', slug: null, name: 'Bachata Club' }]));
    const cards = screen.getAllByTestId('hub-role-card');
    expect(cards.map((c) => c.getAttribute('data-role'))).toEqual(['dancer', 'organiser', 'organiser']);
    expect(cards.slice(1).map((c) => c.getAttribute('href'))).toEqual(['/organisers/salsa-nights', '/organisers/o2']);
  });
  it('empty organisers (failed read): no organiser card, page renders', () => {
    renderHub(snap([]));
    expect(screen.getByTestId('person-hub')).toBeTruthy();
    expect(screen.getAllByTestId('hub-role-card')).toHaveLength(1);
  });
});
