// @vitest-environment jsdom
/**
 * The REAL public organiser page (src/pages/OrganiserProfile.tsx) over
 * {signed out, visitor, contributor, admin without a role, manager, owner} x
 * owner layer shown/hidden. Only an owner or a manager (ownershipFacts().canEdit)
 * gets the layer -- the pencils (Name and City included) and the Create event
 * buttons -- and for everyone else the lazy chunk is never even imported (no
 * new code, no new request). The Create event rows run over both events shapes:
 * nights upcoming (the "Upcoming events" row) and none (the empty state).
 *
 * Contact (admin #771 split): only the owner or a manager gets the Contact card
 * (each item tagged Public / Hidden, masked) and its "Edit contact details"
 * row; nobody else reads get_organiser_contact_settings_v1 or sees either. The
 * settings here are the LEGACY payload (only show_contact_publicly, the RPC
 * before #771): the card must still render, both items reading that one value.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const h = vi.hoisted(() => ({
  user: null as null | { id: string; email: string },
  ownership: null as null | { is_managed: boolean; i_own_it: boolean; my_role: string | null },
  layerImports: 0,
  rpc: vi.fn(),
  events: [] as Array<Record<string, unknown>>,
  contactReads: 0,
}));

vi.mock('@/modules/organiser/edit-in-place/EditInPlaceLayer', async (importOriginal) => {
  h.layerImports += 1;
  return importOriginal();
});

vi.mock('@/integrations/supabase/client', () => {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'order', 'not', 'gte', 'lte', 'limit']) chain[m] = () => chain;
  chain.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
  chain.maybeSingle = async () => ({ data: null, error: null });
  return { supabase: { from: () => chain, rpc: h.rpc, auth: { getSession: async () => ({ data: { session: null } }) } } };
});
// Every account / organiser route sits behind the dancer-first gate (DancerProfileGate);
// this spec is not about it, so the gate context is supplied empty.
vi.mock('@/hooks/useAuth', async () => ({
  useAuth: () => ({ user: h.user, session: h.user ? { access_token: 'x.y.z' } : null }),
  ProfileGateContext: (await import('react')).createContext(null),
}));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => true }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/lib/seo', () => ({
  useEntitySlugOrId: (param?: string) =>
    param === 'other' ? { id: OTHER_ID, slug: 'other', arrivedViaUuid: false } : { id: ORG_ID, slug: 'ritmo', arrivedViaUuid: false },
  useCanonicalReplaceState: () => {},
}));
vi.mock('@/modules/organiser/shared/ownershipApi', async (orig) => ({
  ...(await orig<object>()),
  fetchOrganiserOwnership: async () => h.ownership,
  fetchPublicContact: async () => ({ contact_phone: null, contact_email: null }),
  fetchContactSettings: async () => {
    h.contactReads += 1;
    return { contact_email: 'hello@ritmo.example', contact_phone: '07700 900123', show_contact_publicly: true, claim_email: null };
  },
}));
vi.mock('@/modules/organiser/shared/selfServeApi', async (orig) => ({
  ...(await orig<object>()),
  fetchClaimHint: async () => (h.ownership?.my_role ? 'yours' : 'managed'),
}));
vi.mock('@/modules/profile/organiserPublicProfile', async (orig) => ({
  ...(await orig<object>()),
  fetchOrganiserEntity: async (id: string) => ({
    id, name: id === OTHER_ID ? 'Other Crew' : 'Ritmo Latino', avatar_url: null, bio: null, socials: { facebook: 'https://www.facebook.com/share/1AbC/' }, city_id: '11111111-1111-4111-8111-111111111111',
    instagram: 'https://www.instagram.com/ritmo/', website: 'ritmo.co.uk', organisation_category: 'Dance School', founded_year: null, cities: { name: 'London', slug: 'london-gb' },
  }),
  fetchOrganiserEvents: async () => h.events,
  fetchOrganiserFutureOccEvents: async () => [],
  fetchOrganiserPastOccEvents: async () => [],
}));

const ORG_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_ID = '33333333-3333-4333-8333-333333333333';

import OrganiserProfile from '@/pages/OrganiserProfile';

const ME = { id: 'me', email: 'me@x.example' };
// Every row that must NOT load the layer runs first: the import counter is
// cumulative (a lazy chunk is fetched once per page load), so 0 here proves no
// earlier row pulled it in either.
const ROLES = [
  { name: 'signed out', user: null, ownership: { is_managed: true, i_own_it: false, my_role: null }, layer: false },
  { name: 'visitor (signed in, no role)', user: ME, ownership: { is_managed: true, i_own_it: false, my_role: null }, layer: false },
  { name: 'contributor', user: ME, ownership: { is_managed: true, i_own_it: false, my_role: 'contributor' }, layer: false },
  { name: 'ownership unknown (RPC failed), signed in', user: ME, ownership: null, layer: false },
  // A site admin is not a member: organiser_ownership_v1 gives no role, so canEdit is false.
  { name: 'admin without a role on this organiser', user: { id: 'admin', email: 'admin@x.example' }, ownership: { is_managed: true, i_own_it: false, my_role: null }, layer: false },
  { name: 'manager', user: ME, ownership: { is_managed: true, i_own_it: false, my_role: 'manager' }, layer: true },
  { name: 'owner', user: ME, ownership: { is_managed: true, i_own_it: true, my_role: 'owner' }, layer: true },
];

function renderPage(start = '/organisers/ritmo') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '/organisers/:id', element: <OrganiserProfile /> }], { initialEntries: [start] });
  render(<QueryClientProvider client={qc}><RouterProvider router={router} /></QueryClientProvider>);
  return router;
}

beforeEach(() => {
  window.localStorage.clear();
  h.events = [];
  h.contactReads = 0;
});
afterEach(cleanup);

describe('the owner layer on the live public page', () => {
  it('a stored draft is never shown to someone who cannot edit', async () => {
    window.localStorage.setItem(`bc:organiser-edit-draft:v1:${ORG_ID}`, JSON.stringify({ v: 1, fields: { bio: 'Secret draft' } }));
    h.user = ME;
    h.ownership = { is_managed: true, i_own_it: false, my_role: 'contributor' };
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Ritmo Latino' });
    await new Promise((res) => setTimeout(res, 50));
    expect(document.body.textContent).not.toContain('Secret draft');
    expect(h.layerImports).toBe(0);
  });

  it.each(ROLES)('$name -> layer shown: $layer', async (r) => {
    h.user = r.user;
    h.ownership = r.ownership;
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Ritmo Latino' });
    if (r.layer) {
      await screen.findByTestId('eip-complete-card');
      expect(document.querySelectorAll('[data-eip-pencil]').length).toBeGreaterThanOrEqual(9);
      expect(document.querySelector('[data-eip-pencil="name"]')).toBeTruthy();
      expect(document.querySelector('[data-eip-pencil="city"]')).toBeTruthy();
      expect(screen.getByTestId('eip-links')).toBeTruthy();
      expect(h.layerImports).toBe(1);
      // The Contact card: masked values, each tagged, and ONE edit row with a pencil.
      const contact = await screen.findByTestId('eip-contact');
      await waitFor(() => expect(within(contact).getByTestId('eip-contact-phone').textContent).toContain('07\u2022\u2022 \u2022\u2022\u2022 123'));
      expect(within(contact).getByTestId('eip-contact-phone').textContent).toContain('Public');
      expect(within(contact).getByTestId('eip-contact-email').textContent).toContain('hello@\u2022\u2022\u2022\u2022\u2022\u2022.example');
      expect(within(contact).getByTestId('eip-contact-email').textContent).toContain('Public');
      expect(contact.textContent).not.toContain('07700 900123');
      expect(within(contact).getByRole('button', { name: 'Edit contact details' })).toBeTruthy();
      expect(h.contactReads).toBeGreaterThanOrEqual(1);
      // The old single toggle is gone from the page.
      expect(screen.queryByText(/Show my contact details on my public page/)).toBeNull();
    } else {
      // Give any lazy load a chance to happen, then prove nothing new is there.
      await new Promise((res) => setTimeout(res, 50));
      expect(screen.queryByTestId('eip-complete-card')).toBeNull();
      expect(document.querySelectorAll('[data-eip-pencil]').length).toBe(0);
      expect(screen.queryByTestId('eip-links')).toBeNull();
      expect(screen.queryByTestId('eip-bar')).toBeNull();
      expect(screen.queryByRole('link', { name: /create/i })).toBeNull();
      expect(h.layerImports).toBe(0);
      // No contact card, no edit row, and the private settings are never read.
      expect(screen.queryByTestId('eip-contact')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Edit contact details' })).toBeNull();
      expect(screen.queryByText(/Hidden: only you and admins/)).toBeNull();
      expect(h.contactReads).toBe(0);
    }
    // Public links: noopener nofollow ugc, for everyone.
    const pills = ['Instagram', 'Facebook', 'Website'].map((n) => screen.getByRole('link', { name: new RegExp(`^${n}`) }));
    for (const a of pills) expect(a.getAttribute('rel')).toBe('noopener nofollow ugc');
    // A facebook.com/share/ link is not announced as a handle.
    expect(screen.getByRole('link', { name: /^Facebook/ }).getAttribute('aria-label')).toBe('Facebook');
    // Nobody is told about review: edits go live on Save.
    expect(document.body.textContent).not.toMatch(/sent for review|pending review/i);
  });

  // The Team card (team picker) reads organiser_team_v1 under ['organiser-team', id]. The
  // page's public line-up query once used that SAME key, so the layer got the line-up
  // array, saw no role, and an owner never got the card. Owner: card; manager: none.
  it.each([
    ['owner', 'owner', true],
    ['manager', 'manager', false],
  ] as const)('the Team card through the real page: %s -> shown %s', async (_n, role, shown) => {
    h.user = ME;
    h.ownership = { is_managed: true, i_own_it: role === 'owner', my_role: role };
    h.rpc.mockImplementation(async (fn: string) => (fn === 'organiser_team_v1'
      ? { data: { my_role: role, members: [{ user_id: 'me', member_role: role, is_me: true }] }, error: null }
      : { data: null, error: null }));
    renderPage();
    await screen.findByTestId('eip-contact');
    await waitFor(() => expect(h.rpc.mock.calls.some(([fn]) => fn === 'organiser_team_v1')).toBe(true));
    if (shown) {
      expect((await screen.findByTestId('eip-team')).textContent).toContain('Add a person');
    } else {
      await new Promise((res) => setTimeout(res, 50));
      expect(screen.queryByTestId('eip-team')).toBeNull();
    }
    expect(screen.queryByRole('button', { name: 'Edit profile' })).toBeNull();
    h.rpc.mockReset();
  });

  it('switching organiser remounts the layer: one organiser\'s draft never lands on another', async () => {
    // A manager of two organisers (prod has one such user) with a draft on the other one.
    window.localStorage.setItem(`bc:organiser-edit-draft:v1:${OTHER_ID}`, JSON.stringify({ v: 1, fields: { bio: 'Other crew draft' } }));
    h.user = ME;
    h.ownership = { is_managed: true, i_own_it: false, my_role: 'manager' };
    // Ritmo first, so its page data is cached when the manager comes back to it.
    const router = renderPage('/organisers/ritmo');
    await screen.findByTestId('eip-complete-card');
    void router.navigate('/organisers/other');
    await screen.findByRole('heading', { level: 1, name: 'Other Crew' });
    await screen.findByTestId('eip-bar');
    // The leave blocker registers one render after the bar shows (as useBlocker does).
    await new Promise((res) => setTimeout(res, 50));
    void router.navigate('/organisers/ritmo');
    const leave = await screen.findByTestId('eip-leave');
    fireEvent.click(within(leave).getByRole('button', { name: 'Leave, keep draft' }));
    await screen.findByRole('heading', { level: 1, name: 'Ritmo Latino' });
    await screen.findByTestId('eip-complete-card');
    await new Promise((res) => setTimeout(res, 50));
    expect(screen.queryByTestId('eip-bar')).toBeNull();
    expect(document.body.textContent).not.toContain('Other crew draft');
    expect(window.localStorage.getItem(`bc:organiser-edit-draft:v1:${ORG_ID}`)).toBeNull();
    expect(window.localStorage.getItem(`bc:organiser-edit-draft:v1:${OTHER_ID}`)).toContain('Other crew draft');
  });
});

// An upcoming night with no dated occurrence: the page lists it as upcoming.
const UPCOMING = [{ id: 'e1', name: 'Friday Social', date: null, start_time: null, is_active: true, poster_url: null, location: 'Studio', city: 'London' }];
const PAST = [{ id: 'e0', name: 'Old Social', date: '2020-01-10', start_time: '2020-01-10T20:00:00', is_active: true, poster_url: null, location: 'Studio', city: 'London' }];
const NEW_EVENT_HREF = `/account/o/new/what?o=${ORG_ID}`;

describe('Create event: only the owner or a manager, on both events shapes', () => {
  it.each(ROLES.flatMap((r) => [
    { ...r, shape: 'upcoming nights' as const },
    { ...r, shape: 'no nights' as const },
    { ...r, shape: 'past nights only' as const },
  ]))('$name, $shape -> Create event shown: $layer', async (r) => {
    h.user = r.user;
    h.ownership = r.ownership;
    h.events = r.shape === 'upcoming nights' ? UPCOMING : r.shape === 'past nights only' ? PAST : [];
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Ritmo Latino' });
    if (r.shape === 'upcoming nights') await screen.findByRole('heading', { name: 'Upcoming events' });
    else await screen.findByTestId('org-public-empty');
    if (r.layer) {
      const link = await screen.findByTestId('eip-create-event');
      // The existing create flow, with THIS organiser preselected (?o=<id>, as useOrganiserChoice).
      expect(link.getAttribute('href')).toBe(NEW_EVENT_HREF);
      // "your first" only when there has never been a night: an organiser with past nights is told "Create an event".
      expect(link.textContent).toBe({ 'upcoming nights': 'Create event', 'no nights': 'Create your first event', 'past nights only': 'Create an event' }[r.shape]);
      expect(screen.getAllByTestId('eip-create-event')).toHaveLength(1);
      if (r.shape === 'upcoming nights') {
        // Beside the date count, in the heading row.
        const row = screen.getByRole('heading', { name: 'Upcoming events' }).parentElement!;
        expect(row.contains(link)).toBe(true);
        expect(row.textContent).toContain('1 date');
      } else {
        // Beside "Browse upcoming nights".
        expect(link.parentElement!.textContent).toContain('Browse upcoming nights');
      }
    } else {
      await new Promise((res) => setTimeout(res, 50));
      expect(screen.queryByTestId('eip-create-event')).toBeNull();
      expect(document.querySelector(`a[href^="/account/o/new/what"]`)).toBeNull();
    }
  });
});
