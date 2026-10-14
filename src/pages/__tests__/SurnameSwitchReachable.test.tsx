// @vitest-environment jsdom
/**
 * The "hide my surname" switch is reachable by a signed-in dancer.
 *
 * #746 shipped the switch on EditProfile, a page with no route (retired
 * 2026-09-12), so no real person could turn it on -- and every test rendered
 * EditProfile directly under a hand-made route, so they all passed. This one
 * renders the REAL route table (AnimatedRoutes) at the real URL.
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

import { AnimatedRoutes } from '@/components/AnimatedRoutes';
import { HIDE_SURNAME_LABEL } from '@/components/profile/HideSurnameSwitch';

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

const backendWith = (row: Partial<typeof FULL> | null) =>
  makeBackend({ row: row === null ? null : { ...FULL, ...row }, organisers: 0, requests: [] });

const saves = (b: Backend) => b.calls.filter((c) => c.name === 'save_my_dancer_profile_v1');
const theSwitch = () => screen.findByRole('switch', { name: HIDE_SURNAME_LABEL });
const saveButton = () => screen.getByTestId('hide-surname-save') as HTMLButtonElement;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe.each(['/account', '/account/dancer'])('a signed-in dancer at %s', (url) => {
  it('sees the switch, off by default, with nothing to save', async () => {
    const b = backendWith({});
    mount(b, url);
    const sw = await theSwitch();
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(sw.hasAttribute('disabled')).toBe(false);
    expect(saveButton().disabled).toBe(true);
    expect(saves(b)).toEqual([]);
  });

  it('toggling on and saving sends exactly hide_surname_publicly: true', async () => {
    const b = backendWith({});
    mount(b, url);
    fireEvent.click(await theSwitch());
    await waitFor(() => expect(saveButton().disabled).toBe(false));
    fireEvent.click(saveButton());
    await waitFor(() => expect(saves(b)).toHaveLength(1));
    expect(saves(b)[0].args).toEqual({ p_payload: { hide_surname_publicly: true } });
    await waitFor(() => expect(saveButton().disabled).toBe(true));
    expect((await theSwitch()).getAttribute('aria-checked')).toBe('true');
  });

  it('a profile already hidden shows on; turning it off sends false', async () => {
    const b = backendWith({ hide_surname_publicly: true });
    mount(b, url);
    const sw = await theSwitch();
    await waitFor(() => expect(sw.getAttribute('aria-checked')).toBe('true'));
    fireEvent.click(sw);
    await waitFor(() => expect(saveButton().disabled).toBe(false));
    fireEvent.click(saveButton());
    await waitFor(() => expect(saves(b)).toHaveLength(1));
    expect(saves(b)[0].args).toEqual({ p_payload: { hide_surname_publicly: false } });
  });

  it('toggling there and back is untouched: nothing to save, nothing sent', async () => {
    const b = backendWith({});
    mount(b, url);
    const sw = await theSwitch();
    fireEvent.click(sw);
    fireEvent.click(sw);
    expect(saveButton().disabled).toBe(true);
    expect(saves(b)).toEqual([]);
  });

  it('a setting that cannot be read is disabled WITH a reason, and cannot save', async () => {
    const b = backendWith({ hide_surname_publicly: undefined });
    mount(b, url);
    const sw = await theSwitch();
    expect(sw.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/could not load this setting/i)).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
  });
});

describe('who does not get the switch', () => {
  it('no dancer profile: sent to the Finish screen, no switch', async () => {
    mount(backendWith(null), '/account');
    await screen.findByTestId('finish-profile-settings');
    expect(screen.queryByRole('switch', { name: HIDE_SURNAME_LABEL })).toBeNull();
  });
});
