// @vitest-environment jsdom
/**
 * TODAY's /auth (src/pages/Auth.tsx + components/auth/AuthStepper.tsx) and the two
 * organiser email-code screens (organiser/home/onboarding/EmailCode.tsx and
 * organiser/shared/components/EmailCodeProof.tsx -- the brief names the second
 * under onboarding/, it lives under shared/components/), as the accessible tree of
 * sign-in, each sign-up step, each error copy and the code entry, at 390x844 and
 * desktop. No captcha site key is set, so this is the byte-identical "no key" form.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { installJsdomPolyfills } from '../../client/jsdomPolyfills';
import { a11yTree } from './helpers/a11yTree';
import { VIEWPORTS, setViewport } from './helpers/viewports';

const rpc = vi.hoisted(() => vi.fn());
const signInWithOtp = vi.hoisted(() => vi.fn());
const verifyOtp = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, auth: { signInWithOtp, verifyOtp } } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/ui/city-picker', () => ({
  CityPicker: ({ onChange }: { onChange: (id: string, city: { name: string }) => void }) => (
    <button type="button" onClick={() => onChange('city-1', { name: 'Madrid' })}>Pick city</button>
  ),
}));

import Auth from '@/pages/Auth';
import { AuthStepper } from '@/components/auth/AuthStepper';
import { AuthFormProvider } from '@/contexts/AuthFormContext';
import { EmailCode } from '@/modules/organiser/home/onboarding/EmailCode';
import { EmailCodeProof } from '@/modules/organiser/shared/components/EmailCodeProof';

const WithQueryClient = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

const mountAuth = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
      </Routes>
    </MemoryRouter>,
    { wrapper: WithQueryClient },
  );

const mountStepper = () => {
  localStorage.setItem('profile_entry_role', 'dancer');
  return render(
    <MemoryRouter>
      <AuthFormProvider>
        <AuthStepper initialIntent="new" />
      </AuthFormProvider>
    </MemoryRouter>,
    { wrapper: WithQueryClient },
  );
};

const tick = () => new Promise((r) => setTimeout(r, 40));
const sendLink = (email: string) => {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: /email me a (sign-in )?link/i }));
};
const signUpDetails = async () => {
  fireEvent.click(screen.getByRole('button', { name: /continue as dancer/i }));
  fireEvent.change(await screen.findByLabelText(/first name/i), { target: { value: 'Sam' } });
  fireEvent.click(screen.getByRole('button', { name: 'Pick city' }));
};
const signUpToEmail = async () => {
  await signUpDetails();
  fireEvent.click(screen.getByRole('radio', { name: 'Follower' }));
  const cont = screen.queryByRole('button', { name: /^continue$/i });
  if (cont) fireEvent.click(cont);
  await screen.findByLabelText(/^email$/i);
};
const ERR_403 = { name: 'AuthApiError', status: 403, message: 'Sign-up is limited to approved organisers.' };
const ERR_422 = { name: 'AuthApiError', status: 422, code: 'otp_disabled', message: 'Signups not allowed for otp' };

beforeEach(() => {
  installJsdomPolyfills();
  document.elementFromPoint = () => null;
  localStorage.clear();
  sessionStorage.clear();
  rpc.mockReset().mockResolvedValue({ data: null, error: { message: 'permission denied', code: '42501' } });
  signInWithOtp.mockReset().mockResolvedValue({ data: {}, error: null });
  verifyOtp.mockReset().mockResolvedValue({ error: null });
  toast.mockReset();
});
afterEach(cleanup);

describe.each(VIEWPORTS)('/auth at $name', (vp) => {
  beforeEach(() => setViewport(vp));

  it('sign-in', async () => {
    mountAuth('/auth?mode=signin&returnTo=%2Forganisers%2Fritmo');
    await tick();
    expect(a11yTree()).toMatchSnapshot();
  });

  it('sign-in: link sent (8-digit code box)', async () => {
    mountAuth('/auth?mode=signin');
    sendLink('known@example.com');
    await waitFor(() => expect(signInWithOtp).toHaveBeenCalled());
    await tick();
    expect(signInWithOtp.mock.calls[0][0].options.shouldCreateUser).toBe(false);
    expect(a11yTree()).toMatchSnapshot();
  });

  it('sign-in error: generic send failure', async () => {
    signInWithOtp.mockResolvedValue({ data: null, error: { status: 500, message: 'boom' } });
    mountAuth('/auth?mode=signin');
    sendLink('someone@example.com');
    await screen.findByText(/couldn.t send your email/i);
    expect(a11yTree()).toMatchSnapshot();
  });

  it('sign-in error: otp_disabled switches to create-account with its notice', async () => {
    signInWithOtp.mockResolvedValue({ data: null, error: ERR_422 });
    mountAuth('/auth?mode=signin&returnTo=%2Forganisers%2Fritmo');
    sendLink('new@example.com');
    await screen.findByText('No account for this email yet. Create one to continue.');
    await tick();
    expect(a11yTree()).toMatchSnapshot();
  });

  it('sign-up step 1: role', async () => {
    mountAuth('/auth?mode=signup&userType=dancer');
    await tick();
    expect(a11yTree()).toMatchSnapshot();
  });

  it('sign-up step 2: name / city / role', async () => {
    mountAuth('/auth?mode=signup&userType=dancer');
    await signUpDetails();
    expect(a11yTree()).toMatchSnapshot();
  });

  it('sign-up step 2 error: continue without a dance role', async () => {
    mountAuth('/auth?mode=signup&userType=dancer');
    await signUpDetails();
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    await screen.findByText('Choose your dance role.');
    expect(a11yTree()).toMatchSnapshot();
  });

  it('sign-up step 3: email', async () => {
    mountAuth('/auth?mode=signup&userType=dancer');
    await signUpToEmail();
    expect(a11yTree()).toMatchSnapshot();
  });

  it('sign-up error: allowlist 403 (invite-only + WhatsApp link)', async () => {
    signInWithOtp.mockResolvedValue({ data: null, error: ERR_403 });
    mountAuth('/auth?mode=signup&userType=dancer');
    await signUpToEmail();
    sendLink('stranger@example.com');
    await screen.findByText(/Sign-up is invite-only for now/);
    expect(signInWithOtp.mock.calls[0][0].options.shouldCreateUser).toBe(true);
    expect(a11yTree()).toMatchSnapshot();
  });

  it('sign-up: link sent', async () => {
    mountAuth('/auth?mode=signup&userType=dancer');
    await signUpToEmail();
    sendLink('sam@example.com');
    await waitFor(() => expect(signInWithOtp).toHaveBeenCalled());
    await tick();
    expect(signInWithOtp.mock.calls[0][0].options.data).toMatchObject({ dance_role: 'Follower', first_name: 'Sam', city_id: 'city-1' });
    expect(a11yTree()).toMatchSnapshot();
  });
});

describe.each(VIEWPORTS)('AuthStepper sign-up wizard at $name', (vp) => {
  beforeEach(() => setViewport(vp));

  it('name step', async () => {
    mountStepper();
    await screen.findByPlaceholderText('Your first name');
    expect(a11yTree()).toMatchSnapshot();
  });

  it('name step error: continue without a dance role', async () => {
    mountStepper();
    fireEvent.change(await screen.findByPlaceholderText('Your first name'), { target: { value: 'Sam' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pick city' }));
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    await screen.findByText('Choose your dance role.');
    expect(a11yTree()).toMatchSnapshot();
  });

  it('email step, then send code, then the 8-digit code entry', async () => {
    mountStepper();
    fireEvent.change(await screen.findByPlaceholderText('Your first name'), { target: { value: 'Sam' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pick city' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Leader' }));
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    fireEvent.change(await screen.findByPlaceholderText('you@example.com'), { target: { value: 'sam@example.com' } });
    expect(a11yTree()).toMatchSnapshot('email step');
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /send code/i }));
    await waitFor(() => expect(signInWithOtp).toHaveBeenCalledTimes(1));
    await tick();
    expect(a11yTree()).toMatchSnapshot('code entry');
  });

  it('allowlist 403 on send', async () => {
    signInWithOtp.mockResolvedValue({ data: null, error: ERR_403 });
    mountStepper();
    fireEvent.change(await screen.findByPlaceholderText('Your first name'), { target: { value: 'Sam' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pick city' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Leader' }));
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    fireEvent.change(await screen.findByPlaceholderText('you@example.com'), { target: { value: 'x@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /send code/i }));
    await waitFor(() => expect(signInWithOtp).toHaveBeenCalled());
    await tick();
    expect(a11yTree()).toMatchSnapshot();
  });
});

describe.each(VIEWPORTS)('organiser email-code screens at $name', (vp) => {
  beforeEach(() => setViewport(vp));

  describe.each([
    ['EmailCode', (onProven: () => void) => <EmailCode email="a@b.example" onProven={onProven} />],
    ['EmailCodeProof', (onProven: () => void) => <EmailCodeProof email="a@b.example" onProven={onProven} />],
  ])('%s', (_name, el) => {
    it('before sending', () => {
      render(el(vi.fn()), { wrapper: WithQueryClient });
      expect(a11yTree()).toMatchSnapshot();
    });
    it('code box after sending, then a short code is refused in words', async () => {
      render(el(vi.fn()), { wrapper: WithQueryClient });
      fireEvent.click(screen.getByRole('button', { name: /send|email/i }));
      await waitFor(() => expect(signInWithOtp).toHaveBeenCalled());
      expect(signInWithOtp.mock.calls[0][0].options.shouldCreateUser).toBe(false);
      await tick();
      expect(a11yTree()).toMatchSnapshot('sent');
    });
    it('send failure', async () => {
      signInWithOtp.mockResolvedValue({ data: null, error: { message: 'x' } });
      render(el(vi.fn()), { wrapper: WithQueryClient });
      fireEvent.click(screen.getByRole('button', { name: /send|email/i }));
      await tick();
      expect(a11yTree()).toMatchSnapshot();
    });
  });
});
