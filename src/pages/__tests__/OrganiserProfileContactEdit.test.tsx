// @vitest-environment jsdom
/**
 * Contact split (admin PR #771): the "Edit profile" dialog's ONE contact toggle
 * ("Show my contact details on my public page") and its phone box are REPLACED by
 * the Contact card's "Contact details" sheet in the owner layer
 * (edit-in-place/ContactSheet.tsx). The legacy show_contact_publicly key SETS BOTH
 * new flags on the server, so the dialog must never send it, nor the phone (the
 * sheet owns it), nor contact_email (admin-only). Shapes: flag off / on, no
 * phone, settings read refused, untouched save, an edited bio.
 *
 * The hero's top-right "Edit profile" button is gone (owner decision,
 * 2026-10-12); the dialog now opens only from a wholly blank profile's
 * "Complete your profile", so the organiser here has no bio yet.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
  settings: { contact_email: 'a@x.example', contact_phone: '0113 000', show_contact_publicly: false, claim_email: null } as Record<string, unknown>,
  settingsError: null as { message: string } | null,
  gates: [] as Array<() => void>,
  gated: false,
  calls: [] as Array<[string, Record<string, unknown>]>,
}));

vi.mock('@/lib/seo', async (orig) => ({
  ...(await orig<typeof import('@/lib/seo')>()),
  useEntitySlugOrId: () => ({ id: 'org-1', slug: 'org', arrivedViaUuid: false }),
  useCanonicalReplaceState: () => {},
}));
vi.mock('@/modules/profile/organiserPublicProfile', async (orig) => ({
  ...(await orig<typeof import('@/modules/profile/organiserPublicProfile')>()),
  fetchOrganiserEntity: async () => ({ id: 'org-1', name: 'Ritmo', avatar_url: null, bio: null, socials: null, city_id: 'c1', instagram: null, website: null, cities: { name: 'Leeds', slug: 'leeds' } }),
  fetchOrganiserEvents: async () => [],
  fetchOrganiserFutureOccEvents: async () => [],
  fetchOrganiserPastOccEvents: async () => [],
}));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity: async () => ({ cityId: 'c1' }) }));
vi.mock('@/integrations/supabase/client', () => {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'in', 'order', 'not', 'maybeSingle']) chain[m] = () => chain;
  chain.then = (res: (v: unknown) => void) => res({ data: [], error: null });
  return {
    supabase: {
      from: () => chain,
      rpc: async (fn: string, args: Record<string, unknown>) => {
        h.calls.push([fn, args]);
        if (fn === 'organiser_ownership_v1') return { data: { is_managed: true, i_own_it: true, my_role: 'owner' }, error: null };
        if (fn === 'get_organiser_public_contact_v1') return { data: { contact_email: null, contact_phone: null }, error: null };
        if (fn === 'get_organiser_contact_settings_v1' && h.gated) {
          const snapshot = { ...h.settings };
          await new Promise<void>((release) => h.gates.push(release));
          return { data: snapshot, error: null };
        }
        if (fn === 'get_organiser_contact_settings_v1') return h.settingsError ? { data: null, error: h.settingsError } : { data: h.settings, error: null };
        if (fn === 'organiser_profile_update_p5_v1') return { data: {}, error: null };
        return { data: null, error: null };
      },
    },
  };
});
vi.mock('@/hooks/useAuth', async () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'o@x.example' }, session: null }),
  // PublicClaimCard reads the published completion (signed-in dancer-first gate); none here.
  ProfileGateContext: (await import('react')).createContext(null),
}));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-10-08' }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

import OrganiserProfile from '../OrganiserProfile';

if (!window.matchMedia) {
  window.matchMedia = ((q: string) => ({
    matches: false, media: q, onchange: null, addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const saves = () => h.calls.filter(([fn]) => fn === 'organiser_profile_update_p5_v1');

async function openForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/organisers/org']}>
        <Routes><Route path="/organisers/:id" element={<OrganiserProfile />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const edit = await screen.findByRole('button', { name: 'Complete your profile' });
  expect(screen.queryByRole('button', { name: 'Edit profile' })).toBeNull();
  // The owner layer reads the contact settings for its own Contact card; let it settle first
  // (its lazy chunk can land after the button shows, so wait for its card and its one read).
  await screen.findByTestId('eip-contact');
  await waitFor(() => expect(settingsReads()).toBeGreaterThan(0));
  await new Promise((r) => setTimeout(r, 50));
  readsBeforeOpen = settingsReads();
  fireEvent.click(edit);
  await screen.findByRole('dialog', { name: 'Edit profile' });
}

let readsBeforeOpen = 0;
const settingsReads = () => h.calls.filter(([fn]) => fn === 'get_organiser_contact_settings_v1').length;

beforeEach(() => {
  h.calls.length = 0;
  h.settingsError = null;
  h.gates.length = 0;
  h.gated = false;
  h.settings = { contact_email: 'a@x.example', contact_phone: '0113 000', show_contact_publicly: false, claim_email: null };
});
afterEach(cleanup);

const SETTINGS_SHAPES: Array<[string, Record<string, unknown> | null]> = [
  ['legacy flag off', { contact_email: 'a@x.example', contact_phone: '0113 000', show_contact_publicly: false, claim_email: null }],
  ['legacy flag on', { contact_email: 'a@x.example', contact_phone: '0113 000', show_contact_publicly: true, claim_email: null }],
  ['split: phone on, email off', { contact_email: 'a@x.example', contact_phone: '0113 000', show_phone_publicly: true, show_email_publicly: false, show_contact_publicly: true, claim_email: null }],
  ['no phone, no email', { contact_email: null, contact_phone: null, show_contact_publicly: false, claim_email: null }],
  ['settings read refused', null],
];

describe('the Edit profile dialog no longer edits contact details', () => {
  it.each(SETTINGS_SHAPES)('%s: no contact toggle, no phone box, and no private read when it opens', async (_n, settings) => {
    if (settings) h.settings = settings;
    else h.settingsError = { message: 'permission_denied: reading an organiser contact settings needs its owner' };
    await openForm();
    const dialog = screen.getByRole('dialog', { name: 'Edit profile' });
    expect(within(dialog).queryByLabelText('Show my contact details on my public page')).toBeNull();
    expect(within(dialog).queryByLabelText('Contact phone / WhatsApp')).toBeNull();
    expect(within(dialog).queryByLabelText('Contact email')).toBeNull();
    expect(within(dialog).queryByRole('checkbox')).toBeNull();
    // Opening the dialog reads nothing private (only the owner layer's card does, once).
    await new Promise((r) => setTimeout(r, 50));
    expect(settingsReads()).toBe(readsBeforeOpen);
  });

  it.each(SETTINGS_SHAPES)('%s: saving an edited bio sends NO contact key (never show_contact_publicly)', async (_n, settings) => {
    if (settings) h.settings = settings;
    else h.settingsError = { message: 'permission_denied' };
    await openForm();
    fireEvent.change(screen.getByLabelText('Bio'), { target: { value: 'New bio' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(saves()).toHaveLength(1));
    const patch = saves()[0][1].p_patch as Record<string, unknown>;
    expect(patch.bio).toBe('New bio');
    for (const k of ['show_contact_publicly', 'show_phone_publicly', 'show_email_publicly', 'contact_phone', 'contact_email']) expect(patch).not.toHaveProperty(k);
  });

  it('saving an untouched form sends nothing', async () => {
    await openForm();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit profile' })).toBeNull());
    expect(saves()).toHaveLength(0);
  });
});
