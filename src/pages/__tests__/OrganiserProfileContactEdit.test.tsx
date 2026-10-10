// @vitest-environment jsdom
/**
 * Arc PR 3 (P6.b): the owner's edit form reads the private contact fields through
 * get_organiser_contact_settings_v1 and saves the "Show my contact details"
 * toggle through organiser_profile_update_p5_v1. Shapes: flag off / on, no phone,
 * settings read refused, untouched save, toggled save.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  fetchOrganiserEntity: async () => ({ id: 'org-1', name: 'Ritmo', avatar_url: null, bio: 'Hi', socials: null, city_id: 'c1', instagram: null, website: null, cities: { name: 'Leeds', slug: 'leeds' } }),
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
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'o@x.example' }, session: null }) }));
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
  fireEvent.click(await screen.findByLabelText('Edit profile'));
  await screen.findByLabelText('Show my contact details on my public page');
}

beforeEach(() => {
  h.calls.length = 0;
  h.settingsError = null;
  h.gates.length = 0;
  h.gated = false;
  h.settings = { contact_email: 'a@x.example', contact_phone: '0113 000', show_contact_publicly: false, claim_email: null };
});
afterEach(cleanup);

describe('owner edit form: contact fields and the show-contact toggle', () => {
  it('fills phone and email from get_organiser_contact_settings_v1; email stays read-only; the toggle says it is OFF', async () => {
    await openForm();
    await waitFor(() => expect((screen.getByLabelText('Contact phone / WhatsApp') as HTMLInputElement).value).toBe('0113 000'));
    const email = screen.getByLabelText('Contact email') as HTMLInputElement;
    expect(email.value).toBe('a@x.example');
    expect(email.disabled).toBe(true);
    expect((screen.getByLabelText('Show my contact details on my public page') as HTMLInputElement).checked).toBe(false);
    expect(screen.getByTestId('show-contact-publicly').textContent).toMatch(/Currently off/);
    expect(h.calls.some(([fn]) => fn === 'get_organiser_contact_settings_v1')).toBe(true);
  });

  it('saving an untouched form sends nothing', async () => {
    await openForm();
    await waitFor(() => expect((screen.getByLabelText('Contact phone / WhatsApp') as HTMLInputElement).value).toBe('0113 000'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByLabelText('Show my contact details on my public page')).toBeNull());
    expect(saves()).toHaveLength(0);
  });

  it('turning the toggle on saves show_contact_publicly through the profile RPC', async () => {
    await openForm();
    await waitFor(() => expect((screen.getByLabelText('Contact phone / WhatsApp') as HTMLInputElement).value).toBe('0113 000'));
    fireEvent.click(screen.getByLabelText('Show my contact details on my public page'));
    expect(screen.getByTestId('show-contact-publicly').textContent).toMatch(/anyone can see/);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(saves()).toHaveLength(1));
    const [, args] = saves()[0];
    expect(args.p_organiser_id).toBe('org-1');
    expect(args.p_patch).toMatchObject({ show_contact_publicly: true, contact_phone: '0113 000' });
    expect(args.p_patch).not.toHaveProperty('contact_email');
  });

  it('no phone and no email: says there is nothing to show yet and what to do', async () => {
    h.settings = { contact_email: null, contact_phone: null, show_contact_publicly: false, claim_email: null };
    await openForm();
    await waitFor(() => expect(screen.getByTestId('show-contact-publicly').textContent).toMatch(/Add a phone above first/));
  });

  it('settings read refused: phone and toggle are disabled with a reason, and a save never sends them', async () => {
    h.settingsError = { message: 'permission_denied: reading an organiser contact settings needs its owner' };
    await openForm();
    await screen.findByTestId('contact-load-failed');
    expect((screen.getByLabelText('Contact phone / WhatsApp') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('Show my contact details on my public page') as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByTestId('show-contact-publicly').textContent).toMatch(/Locked because/);
    // Change something else: the patch must leave the private fields out.
    fireEvent.change(screen.getByLabelText('Bio'), { target: { value: 'New bio' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(saves()).toHaveLength(1));
    const patch = saves()[0][1].p_patch as Record<string, unknown>;
    expect(patch).not.toHaveProperty('contact_phone');
    expect(patch).not.toHaveProperty('show_contact_publicly');
    expect(patch.bio).toBe('New bio');
  });

  it('a read that lands after the form was closed does not touch the next open', async () => {
    h.gated = true;
    h.settings = { contact_email: 'a@x.example', contact_phone: 'OLD-PHONE', show_contact_publicly: false, claim_email: null };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/organisers/org']}>
          <Routes><Route path="/organisers/:id" element={<OrganiserProfile />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByLabelText('Edit profile'));
    await screen.findByLabelText('Show my contact details on my public page');
    await waitFor(() => expect(h.gates).toHaveLength(1));
    // Close while the first read is pending, change what the server holds, reopen.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByLabelText('Show my contact details on my public page')).toBeNull());
    h.settings = { contact_email: 'a@x.example', contact_phone: 'NEW-PHONE', show_contact_publicly: false, claim_email: null };
    fireEvent.click(screen.getByLabelText('Edit profile'));
    await screen.findByLabelText('Show my contact details on my public page');
    // Release every pending read: the form must end on the newest open's data and be savable only once ready.
    await act(async () => { h.gates.splice(0).forEach((release) => release()); });
    await waitFor(() => expect((screen.getByLabelText('Contact phone / WhatsApp') as HTMLInputElement).disabled).toBe(false));
    expect((screen.getByLabelText('Contact phone / WhatsApp') as HTMLInputElement).value).not.toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByLabelText('Show my contact details on my public page')).toBeNull());
    expect(saves()).toHaveLength(0);
  });
});
