// @vitest-environment jsdom
/**
 * A signed-in dancer can reach "Edit my profile" from the dancer home and save a surname.
 *
 * The original failure (2026-10-14): the editor (Profile / EditProfile) had no route, so no
 * dancer could add a surname. This renders the REAL route table at the real URLs, follows the
 * link a person would tap, and checks exactly what is sent.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { FULL, makeBackend, type Backend } from './helpers/dancerBackend';

const h = vi.hoisted(() => ({ backend: null as unknown as { client: unknown } }));
vi.mock('@/integrations/supabase/client', () => ({
  get supabase() {
    return h.backend.client;
  },
}));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => h.backend.client }));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({
    user: { id: 'u1', email: 'ana@example.com', is_anonymous: false },
    session: null,
    isLoading: false,
    authStatus: 'ready',
    signOut: async () => 'signed_out',
  }),
}));
vi.mock('@/lib/featureFlags', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/featureFlags')>();
  return { ...real, flags: { ...real.flags, organiserSelfServe: true } };
});
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/contexts/CityContext', () => ({ useCity: () => ({ citySlug: 'london-gb' }) }));
// The city list is a network picker of its own; the screen's payload is what is under test.
vi.mock('@/components/ui/city-picker', () => ({ CityPicker: () => <div data-testid="city-picker" /> }));

import { AnimatedRoutes } from '@/components/AnimatedRoutes';
import { AccountScreen } from '@/pages/Account';

const mount = (backend: Backend, at: string) => {
  h.backend = backend;
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[at]}>
        <AnimatedRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const saves = (b: Backend) => b.calls.filter((c) => c.name === 'save_my_dancer_profile_v1');

beforeEach(() => {
  // jsdom has no ResizeObserver; Radix's Switch measures itself inside a <form>.
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('a signed-in dancer with no surname', () => {
  it('follows Edit my profile from the dancer home, types a surname, and exactly {surname} is sent', async () => {
    const b = makeBackend({ row: { ...FULL, surname: null }, organisers: 0, requests: [] });
    mount(b, '/account/dancer');
    fireEvent.click(await screen.findByTestId('dancer-home-edit'));
    const field = (await screen.findByLabelText('Surname')) as HTMLInputElement;
    const save = screen.getByTestId('dancer-edit-save') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(screen.getByText('Nothing to save yet')).toBeTruthy();
    fireEvent.change(field, { target: { value: 'Santos' } });
    await waitFor(() => expect(save.disabled).toBe(false));
    fireEvent.click(save);
    await waitFor(() => expect(saves(b)).toHaveLength(1));
    expect(saves(b)[0].args).toEqual({ p_payload: { surname: 'Santos' } });
  });

  it('the edit URL is routed (not bounced home)', async () => {
    mount(makeBackend({ row: { ...FULL }, organisers: 0, requests: [] }), '/account/dancer/edit');
    expect(await screen.findByLabelText('Surname')).toBeTruthy();
  });
});

const field = async (label: string) => (await screen.findByLabelText(label)) as HTMLInputElement;
const saveBtn = () => screen.getByTestId('dancer-edit-save') as HTMLButtonElement;

describe('/account/dancer/edit by prod shape', () => {
  it('the link is on the dancer home whether the profile is complete or not', async () => {
    // AccountScreen is the home itself: the route's gate would send an unfinished profile to Finish first.
    const stub = { first_name: null, based_city_id: null, dance_role: null, avatar_url: null, archived_at: null };
    for (const row of [stub, FULL]) {
      h.backend = makeBackend({ row, organisers: 0, requests: [] });
      const { unmount } = render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <MemoryRouter initialEntries={['/account/dancer']}>
            <AccountScreen view="dancer" />
          </MemoryRouter>
        </QueryClientProvider>,
      );
      expect(await screen.findByTestId('dancer-home-edit')).toBeTruthy();
      unmount();
    }
  });

  it('stub row: form shows, untouched Save is disabled with the reason, nothing sent', async () => {
    const b = makeBackend({ row: { first_name: null, based_city_id: null, dance_role: null, avatar_url: null, archived_at: null }, organisers: 0, requests: [] });
    mount(b, '/account/dancer/edit');
    expect((await field('First name')).value).toBe('');
    expect(saveBtn().disabled).toBe(true);
    expect(screen.getByText('Nothing to save yet')).toBeTruthy();
    expect(saves(b)).toEqual([]);
  });

  it('hide switch sits right under the surname and sends exactly hide_surname_publicly: true', async () => {
    const b = makeBackend({ row: { ...FULL, surname: 'Santos' }, organisers: 0, requests: [] });
    mount(b, '/account/dancer/edit');
    const surname = await field('Surname');
    expect(surname.value).toBe('Santos');
    const sw = await screen.findByRole('switch');
    expect(surname.compareDocumentPosition(sw) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sw.hasAttribute('disabled')).toBe(false);
    fireEvent.click(sw);
    await waitFor(() => expect(saveBtn().disabled).toBe(false));
    fireEvent.click(saveBtn());
    await waitFor(() => expect(saves(b)).toHaveLength(1));
    expect(saves(b)[0].args).toEqual({ p_payload: { hide_surname_publicly: true } });
    // The completion cache and the own row are re-asked after the save.
    await waitFor(() => expect(saveBtn().disabled).toBe(true));
  });

  it('role pick sends exactly dance_role', async () => {
    const b = makeBackend({ row: { ...FULL, dance_role: null }, organisers: 0, requests: [] });
    mount(b, '/account/dancer/edit');
    await field('Surname');
    fireEvent.click(screen.getByRole('radio', { name: 'Leader' }));
    await waitFor(() => expect(saveBtn().disabled).toBe(false));
    fireEvent.click(saveBtn());
    await waitFor(() => expect(saves(b)).toHaveLength(1));
    expect(saves(b)[0].args).toEqual({ p_payload: { dance_role: 'Leader' } });
  });

  it('clearing a saved surname: Save disabled with the reason, nothing sent', async () => {
    const b = makeBackend({ row: { ...FULL, surname: 'Santos' }, organisers: 0, requests: [] });
    mount(b, '/account/dancer/edit');
    fireEvent.change(await field('Surname'), { target: { value: '' } });
    await waitFor(() => expect(screen.getByText(/can.t be removed here yet/)).toBeTruthy());
    expect(saveBtn().disabled).toBe(true);
    expect(saves(b)).toEqual([]);
  });

  it('no dancer profile: the "message us" text, not the form', async () => {
    mount(makeBackend({ row: null, organisers: 0, requests: [] }), '/account/dancer/edit');
    await screen.findByTestId('dancer-edit-no-profile');
    expect(screen.queryByLabelText('Surname')).toBeNull();
  });
});
