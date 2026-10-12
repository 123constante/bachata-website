// @vitest-environment jsdom
/**
 * The hero's small uppercase 'Dance School \u00b7 London' line is shown to everyone
 * except the owner layer's people (owner, manager), whose chips already say it.
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
  fetchContactSettings: async () => ({ contact_email: null, contact_phone: null, show_contact_publicly: false }),
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

beforeEach(() => { window.localStorage.clear(); h.events = []; });
afterEach(cleanup);

describe('hero meta line vs the owner layer', () => {
  it.each(ROLES)('$name -> meta line shown: $name', async (r) => {
    h.user = r.user;
    h.ownership = r.ownership;
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Ritmo Latino' });
    if (r.layer) await screen.findByTestId('eip-complete-card');
    else await new Promise((res) => setTimeout(res, 50));
    const line = screen.queryAllByText('Dance School \u00b7 London');
    expect(line.length > 0).toBe(!r.layer);
  });
});
