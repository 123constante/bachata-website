// @vitest-environment jsdom
/**
 * Both sign-up screens ask the dance role (required) and send it in the sign-up
 * metadata as one of the exact values dancer_profiles_dance_role_check admits:
 * Leader / Follower / Lead and Follow. /auth also shows the WhatsApp contact
 * next to its invite-only message. The Supabase client is mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

// The sign-in paths take the QueryClient (the self-claim invalidates the persona caches).
const WithQueryClient = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

const rpc = vi.hoisted(() => vi.fn());
const signInWithOtp = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc, auth: { signInWithOtp } },
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/ui/city-picker', () => ({
  CityPicker: ({ onChange }: { onChange: (id: string, city: { name: string }) => void }) => (
    <button type="button" onClick={() => onChange('city-1', { name: 'Madrid' })}>Pick city</button>
  ),
}));

import Auth from '../Auth';
import { AuthStepper } from '@/components/auth/AuthStepper';
import { AuthFormProvider } from '@/contexts/AuthFormContext';
import { WHATSAPP_GET_LISTED_URL } from '@/lib/contactLinks';
import { installJsdomPolyfills } from '../../../tests/client/jsdomPolyfills';

beforeEach(() => {
  installJsdomPolyfills();
  document.elementFromPoint = () => null;
  localStorage.clear();
  rpc.mockReset().mockResolvedValue({ data: null, error: { message: 'permission denied', code: '42501' } });
  signInWithOtp.mockReset().mockResolvedValue({ data: {}, error: null });
  toast.mockReset();
});
afterEach(cleanup);

const ROLES: [label: string, stored: string][] = [
  ['Leader', 'Leader'],
  ['Follower', 'Follower'],
  ['Both', 'Lead and Follow'],
];

describe('/auth create account', () => {
  const mount = () =>
    render(
      <MemoryRouter initialEntries={['/auth?mode=signup&userType=dancer']}>
        <Routes>
          <Route path="/auth" element={<Auth />} />
        </Routes>
      </MemoryRouter>,
      { wrapper: WithQueryClient },
    );

  const toDetails = async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: /continue as dancer/i }));
    fireEvent.change(await screen.findByLabelText(/first name/i), { target: { value: 'Sam' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pick city' }));
  };

  it('the details step asks the dance role and will not continue without it', async () => {
    await toDetails();
    expect(screen.getByRole('radiogroup', { name: /dance role/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    expect(await screen.findByText('Choose your dance role.')).toBeTruthy();
    expect(screen.queryByLabelText(/^email$/i)).toBeNull();
  });

  it.each(ROLES)('%s is sent in the sign-up metadata as "%s"', async (label, stored) => {
    await toDetails();
    fireEvent.click(screen.getByRole('radio', { name: label }));
    const cont = screen.queryByRole('button', { name: /^continue$/i });
    if (cont) fireEvent.click(cont);
    fireEvent.change(await screen.findByLabelText(/^email$/i), { target: { value: 'sam@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /email me a link/i }));
    await waitFor(() => expect(signInWithOtp).toHaveBeenCalledTimes(1));
    expect(signInWithOtp.mock.calls[0][0].options.data).toMatchObject({ dance_role: stored, first_name: 'Sam', city_id: 'city-1' });
  });

  it('invite-only refusal shows the WhatsApp contact next to the message', async () => {
    signInWithOtp.mockResolvedValue({
      data: null,
      error: { name: 'AuthApiError', status: 403, message: 'Sign-up is limited to approved organisers.' },
    });
    await toDetails();
    fireEvent.click(screen.getByRole('radio', { name: 'Follower' }));
    const cont = screen.queryByRole('button', { name: /^continue$/i });
    if (cont) fireEvent.click(cont);
    fireEvent.change(await screen.findByLabelText(/^email$/i), { target: { value: 'stranger@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /email me a link/i }));
    await waitFor(() => expect(screen.getByText(/Sign-up is invite-only for now/)).toBeTruthy());
    const link = screen.getByRole('link', { name: /message us on whatsapp/i });
    expect(link.getAttribute('href')).toBe(WHATSAPP_GET_LISTED_URL);
    expect(link.getAttribute('target')).toBe('_blank');
  });
});

describe('AuthStepper create account', () => {
  const mount = () =>
    render(
      <MemoryRouter>
        <AuthFormProvider>
          {/* No userType prop: AuthStepper re-sets the role on every render when one is passed (setRole is not memoised) -- a pre-existing loop outside this change. The role is seeded via storage in toName instead. */}
          <AuthStepper initialIntent="new" />
        </AuthFormProvider>
      </MemoryRouter>,
      { wrapper: WithQueryClient },
    );

  const toName = async () => {
    // The entry role arrives the way AuthFormProvider reads a legacy one.
    localStorage.setItem('profile_entry_role', 'dancer');
    mount();
    // With a role and no details yet, the stepper opens on the name step.
    fireEvent.change(await screen.findByPlaceholderText('Your first name'), { target: { value: 'Sam' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pick city' }));
  };

  it('the name step asks the dance role and will not continue without it', async () => {
    await toName();
    expect(screen.getByRole('radiogroup', { name: /dance role/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    expect(await screen.findByText('Choose your dance role.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /send code/i })).toBeNull();
  });

  it.each(ROLES)('%s is sent in the sign-up metadata as "%s"', async (label, stored) => {
    await toName();
    fireEvent.click(screen.getByRole('radio', { name: label }));
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    fireEvent.change(await screen.findByPlaceholderText('you@example.com'), { target: { value: 'sam@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /send code/i }));
    await waitFor(() => expect(signInWithOtp).toHaveBeenCalledTimes(1));
    expect(signInWithOtp.mock.calls[0][0].options.data).toMatchObject({ dance_role: stored, first_name: 'Sam' });
  });
});
