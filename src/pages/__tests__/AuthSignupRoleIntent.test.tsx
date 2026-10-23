// @vitest-environment jsdom
/**
 * B-WEB4: sign-up asks "What do you do?" as a multi-select (Dancer on by
 * default, Organiser, Teacher, DJ). The choice rides to /auth/callback in the
 * sign-up metadata and in this browser's storage (the typed-code path); the
 * older single user_type is organiser when Organiser is ticked, else dancer.
 * Sign-IN of an existing account does not ask and sends nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

const WithQueryClient = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

const rpc = vi.hoisted(() => vi.fn());
const signInWithOtp = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc, auth: { signInWithOtp } },
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/ui/city-picker', () => ({
  CityPicker: ({ onChange }: { onChange: (id: string, city: { name: string }) => void }) => (
    <button type="button" onClick={() => onChange('city-1', { name: 'Madrid' })}>Pick city</button>
  ),
}));

import Auth from '../Auth';
import { PENDING_ROLE_INTENT_KEY, SIGNUP_ROLES_REQUIRED_ERROR } from '@/lib/auth-otp-routing';
import { installJsdomPolyfills } from '../../../tests/client/jsdomPolyfills';

beforeEach(() => {
  installJsdomPolyfills();
  document.elementFromPoint = () => null;
  localStorage.clear();
  sessionStorage.clear();
  rpc.mockReset().mockResolvedValue({ data: null, error: { message: 'permission denied', code: '42501' } });
  signInWithOtp.mockReset().mockResolvedValue({ data: {}, error: null });
});
afterEach(cleanup);

const mount = (entry = '/auth?mode=signup') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
      </Routes>
    </MemoryRouter>,
    { wrapper: WithQueryClient },
  );

const option = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}\\b`, 'i') });
const pressed = (name: string) => option(name).getAttribute('aria-pressed') === 'true';

/** Through details and e-mail to the send, with the given options toggled on the first step. */
const signUpWith = async (toggle: string[]) => {
  for (const name of toggle) fireEvent.click(option(name));
  fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
  fireEvent.change(await screen.findByLabelText(/first name/i), { target: { value: 'Sam' } });
  fireEvent.click(screen.getByRole('button', { name: 'Pick city' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Leader' }));
  const cont = screen.queryByRole('button', { name: /^continue$/i });
  if (cont) fireEvent.click(cont);
  fireEvent.change(await screen.findByLabelText(/^email$/i), { target: { value: 'sam@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: /email me a link/i }));
  await waitFor(() => expect(signInWithOtp).toHaveBeenCalledTimes(1));
  return signInWithOtp.mock.calls[0][0].options.data as Record<string, unknown>;
};

describe('/auth sign-up: What do you do?', () => {
  it('asks in plain words, offers exactly Dancer, Organiser, Teacher, DJ, with Dancer on', () => {
    mount();
    expect(screen.getByText('What do you do?')).toBeTruthy();
    const group = screen.getByRole('group', { name: 'What do you do?' });
    const labels = Array.from(group.querySelectorAll('button')).map((b) => b.querySelector('p')?.textContent);
    expect(labels).toEqual(['Dancer', 'Organiser', 'Teacher', 'DJ']);
    expect([pressed('Dancer'), pressed('Organiser'), pressed('Teacher'), pressed('DJ')]).toEqual([true, false, false, false]);
  });

  it('every choice and Continue is at least 44 px tall (explicit px, not rem)', () => {
    mount();
    const px = (el: HTMLElement) => Number(/(?:^|\s)(?:min-)?h-\[(\d+)px\](?:\s|$)/.exec(el.className)?.[1] ?? 0);
    for (const name of ['Dancer', 'Organiser', 'Teacher', 'DJ']) expect(px(option(name))).toBeGreaterThanOrEqual(44);
    expect(px(screen.getByRole('button', { name: /^continue$/i }))).toBeGreaterThanOrEqual(44);
  });

  it('is a multi-select: several can be on at once, and a second tap turns one off', () => {
    mount();
    fireEvent.click(option('Teacher'));
    fireEvent.click(option('DJ'));
    expect([pressed('Dancer'), pressed('Teacher'), pressed('DJ')]).toEqual([true, true, true]);
    fireEvent.click(option('DJ'));
    expect(pressed('DJ')).toBe(false);
  });

  it('with nothing chosen, Continue is disabled and says why', () => {
    mount();
    fireEvent.click(option('Dancer'));
    const cont = screen.getByRole('button', { name: /^continue$/i });
    expect((cont as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(SIGNUP_ROLES_REQUIRED_ERROR)).toBeTruthy();
    expect(SIGNUP_ROLES_REQUIRED_ERROR).toBe('Choose at least one'); // D109: the short reason, pinned as a literal
    expect(cont.getAttribute('aria-describedby')).toBe('auth-roles-required');
    fireEvent.click(option('Teacher'));
    expect((screen.getByRole('button', { name: /^continue$/i }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText(SIGNUP_ROLES_REQUIRED_ERROR)).toBeNull();
  });

  const SENDS: { toggle: string[]; roleIntent: string[]; userType: string }[] = [
    { toggle: [], roleIntent: ['dancer'], userType: 'dancer' },
    { toggle: ['Teacher'], roleIntent: ['dancer', 'teacher'], userType: 'dancer' },
    { toggle: ['DJ', 'Teacher'], roleIntent: ['dancer', 'teacher', 'dj'], userType: 'dancer' },
    { toggle: ['Organiser'], roleIntent: ['dancer', 'organiser'], userType: 'organiser' },
    { toggle: ['Dancer', 'Organiser', 'DJ'], roleIntent: ['organiser', 'dj'], userType: 'organiser' },
    { toggle: ['Dancer', 'DJ'], roleIntent: ['dj'], userType: 'dancer' },
  ];
  it.each(SENDS)('toggled $toggle -> sends role_intent $roleIntent and user_type $userType', async ({ toggle, roleIntent, userType }) => {
    mount();
    const data = await signUpWith(toggle);
    expect(data.role_intent).toEqual(roleIntent);
    expect(data.user_type).toBe(userType);
    // The typed-code path reads this browser's copy (the metadata is the e-mailed link's).
    expect(JSON.parse(localStorage.getItem(PENDING_ROLE_INTENT_KEY) as string)).toEqual(roleIntent);
    expect(localStorage.getItem('pending_profile_role')).toBe(userType);
  });

  it('an organiser link (?userType=organiser) shows the step with Dancer and Organiser on', () => {
    mount('/auth?mode=signup&userType=organiser');
    expect(screen.getByText('What do you do?')).toBeTruthy();
    expect([pressed('Dancer'), pressed('Organiser'), pressed('Teacher'), pressed('DJ')]).toEqual([true, true, false, false]);
  });
});

describe('/auth sign-in does not ask', () => {
  it('no "What do you do?", no role_intent sent, and a stale stash is cleared', async () => {
    localStorage.setItem(PENDING_ROLE_INTENT_KEY, JSON.stringify(['teacher']));
    mount('/auth?mode=signin');
    expect(screen.queryByText('What do you do?')).toBeNull();
    fireEvent.change(await screen.findByLabelText(/^email$/i), { target: { value: 'sam@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /email me|send/i }));
    await waitFor(() => expect(signInWithOtp).toHaveBeenCalledTimes(1));
    expect(signInWithOtp.mock.calls[0][0].options.data).toBeUndefined();
    expect(localStorage.getItem(PENDING_ROLE_INTENT_KEY)).toBeNull();
  });
});
