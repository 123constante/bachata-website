// @vitest-environment jsdom
/**
 * Type-your-email step on an UNBOUND open invite link (signed out). Table-driven: every RPC status x viewer,
 * one shared copy map, and the R1 pin: redeem is reachable ONLY from the Join click.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { BIND_FAILED_COPY, BIND_UNAVAILABLE_COPY, EMAIL_CHECK_COPY, bindCopy, checkTypedEmail, interpretBind, maskTypedEmail, type BindStatus } from '../bindEmailModel';

const TOKEN = 'ef'.repeat(32);
const h = vi.hoisted(() => ({
  user: null as null | { id: string; email: string },
  rpc: vi.fn(),
  hint: null as string | null,
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: h.user, session: null, isLoading: false, authStatus: 'ready', signOut: vi.fn() }) }));
vi.mock('@/hooks/useProfileCompletion', () => ({
  useProfileCompletion: () => ({ status: 'complete', missing: [], profileId: 'p1', refetch: async () => ({ status: 'complete', missing: [], profileId: 'p1' }) }),
}));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...a: unknown[]) => h.rpc(...a),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { first_name: 'Bea', display_name: null }, error: null }), order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }) }),
  },
}));

import InviteRedeemPage from '../InviteRedeemPage';

const calls = (fn: string) => h.rpc.mock.calls.filter((c) => c[0] === fn);
let bindAnswer: () => Promise<unknown>;

function mount() {
  const Where = () => { const l = useLocation(); return <p data-testid="where">{`${l.pathname}${l.search}`}</p>; };
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/invite/${TOKEN}`]}>
        <Where />
        <Routes>
          <Route path="/invite/:token" element={<InviteRedeemPage />} />
          <Route path="/auth" element={<p data-testid="auth">auth</p>} />
          <Route path="/account/o" element={<p data-testid="landed">home</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  h.user = null;
  h.hint = null;
  localStorage.clear();
  h.rpc.mockReset();
  bindAnswer = () => Promise.resolve({ data: { status: 'bound' }, error: null });
  h.rpc.mockImplementation((fn: string) => {
    if (fn === 'organiser_invite_preview_v1') return Promise.resolve({ data: { status: 'open', organiser_name: 'Salsa Norte', inviter_first_name: 'Marta', email_hint: h.hint }, error: null });
    if (fn === 'bind_organiser_invite_email_v1') return bindAnswer();
    if (fn === 'redeem_organiser_invite_v1') return Promise.resolve({ data: { ok: false, reason: 'expired' }, error: null });
    return Promise.reject(new Error(fn));
  });
});
afterEach(cleanup);

async function typeAndConfirm(email: string) {
  fireEvent.change(await screen.findByTestId('bind-input'), { target: { value: email } });
  fireEvent.click(screen.getByTestId('bind-next'));
  return screen.findByTestId('bind-confirm');
}

describe('model', () => {
  it.each([
    ['  a@x.com ', true],
    ['', false],
    ['a@x', false],
    ['a b@x.com', false],
    ['a​@x.com', false],
    ['é@x.com', false],
  ])('checkTypedEmail(%j) ok=%s', (raw, ok) => {
    expect(checkTypedEmail(raw).ok).toBe(ok);
  });
  it('trims', () => expect(checkTypedEmail('  a@x.com ')).toEqual({ ok: true, email: 'a@x.com' }));
  it('masks', () => expect(maskTypedEmail('anna@x.com')).toBe('a***@x.com'));
  it.each([
    ['already_bound', 'This link was already used with an email. Ask Marta for a new link.', 'stop'],
    ['not_open', 'This link isn’t active any more. Ask Marta for a new one.', 'stop'],
    ['bad_email', 'That doesn’t look like an email address.', 'retry'],
    ['rate_limited', 'Too many tries. Wait a few minutes and try again.', 'retry'],
  ] as [BindStatus, string, string][])('copy for %s', (s, text, next) => {
    expect(bindCopy(s, 'Marta')).toMatchObject({ text, next });
  });
  it('no inviter on file still says who to ask', () => expect(bindCopy('not_open', null).text).toContain('the person who sent it'));
  it.each([
    [{ data: null, error: { message: 'Could not find the function public.bind_organiser_invite_email_v1' } }, 'unavailable'],
    [{ data: null, error: { code: 'PGRST202', message: 'x' } }, 'unavailable'],
    [{ data: null, error: { message: 'boom' } }, 'failed'],
    [{ data: { status: 'weird' }, error: null }, 'failed'],
    [{ data: { status: 'bound' }, error: null }, 'status'],
  ])('interpretBind %#', ({ data, error }, kind) => {
    expect(interpretBind(data, error).kind).toBe(kind);
  });
});

describe('unbound link, signed out', () => {
  it('names the page and the sender, asks for the email, Next is disabled with a reason', async () => {
    mount();
    expect((await screen.findByTestId('invite-title')).textContent).toBe('You’ve been invited to manage Salsa Norte');
    expect(screen.getByTestId('invite-from').textContent).toBe('From Marta.');
    expect((screen.getByTestId('bind-next') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('bind-next-why').textContent).toBe('Type your email to continue.');
  });

  it.each([
    ['a​@x.com', EMAIL_CHECK_COPY.not_ascii],
    ['nope', EMAIL_CHECK_COPY.bad_shape],
  ])('refuses %j client-side, no RPC', async (typed, msg) => {
    mount();
    fireEvent.change(await screen.findByTestId('bind-input'), { target: { value: typed } });
    fireEvent.click(screen.getByTestId('bind-next'));
    expect((await screen.findByTestId('bind-error')).textContent).toBe(msg);
    expect(calls('bind_organiser_invite_email_v1')).toHaveLength(0);
  });

  it('confirm shows the masked address and does not call the RPC until Yes', async () => {
    mount();
    const confirm = await typeAndConfirm('  Anna@x.com ');
    expect(confirm.textContent).toContain('A***@x.com. Is that right?');
    expect(calls('bind_organiser_invite_email_v1')).toHaveLength(0);
    fireEvent.click(screen.getByTestId('bind-change'));
    expect((await screen.findByTestId('bind-input') as HTMLInputElement).value).toBe('Anna@x.com');
  });

  it('bound: calls the RPC once with the trimmed email, goes to sign-in returning here, never redeems', async () => {
    mount();
    await typeAndConfirm('  anna@x.com ');
    fireEvent.click(screen.getByTestId('bind-yes'));
    await screen.findByTestId('auth');
    expect(calls('bind_organiser_invite_email_v1')).toEqual([['bind_organiser_invite_email_v1', { p_token: TOKEN, p_email: 'anna@x.com' }]]);
    expect(decodeURIComponent(screen.getByTestId('where').textContent ?? '')).toContain(`returnTo=/invite/${TOKEN}`);
    expect(localStorage.getItem('auth_last_email')).toBe('anna@x.com');
    expect(calls('redeem_organiser_invite_v1')).toHaveLength(0);
  });

  it.each([
    ['already_bound', 'bind-stopped-text'],
    ['not_open', 'bind-stopped-text'],
    ['bad_email', 'bind-error'],
    ['rate_limited', 'bind-error'],
  ] as [BindStatus, string][])('%s shows the shared copy', async (status, testid) => {
    bindAnswer = () => Promise.resolve({ data: { status }, error: null });
    mount();
    await typeAndConfirm('anna@x.com');
    fireEvent.click(screen.getByTestId('bind-yes'));
    expect((await screen.findByTestId(testid)).textContent).toBe(bindCopy(status, 'Marta').text);
    expect(screen.queryByTestId('auth')).toBeNull();
    // Every end state says what the person can do: retry (input or Yes still on screen) or go home.
    expect(screen.queryByTestId('bind-input') ?? screen.queryByTestId('bind-yes') ?? screen.queryByTestId('invite-home')).not.toBeNull();
  });

  it('function missing (migration not applied): try again later, plain sign-in offered, nothing breaks', async () => {
    bindAnswer = () => Promise.resolve({ data: null, error: { message: 'Could not find the function public.bind_organiser_invite_email_v1 in the schema cache' } });
    mount();
    await typeAndConfirm('anna@x.com');
    fireEvent.click(screen.getByTestId('bind-yes'));
    expect((await screen.findByTestId('bind-error')).textContent).toBe(BIND_UNAVAILABLE_COPY);
    expect(screen.getByTestId('invite-sign-in')).toBeTruthy();
  });

  it('network failure: retryable message', async () => {
    bindAnswer = () => Promise.reject(new Error('network'));
    mount();
    await typeAndConfirm('anna@x.com');
    fireEvent.click(screen.getByTestId('bind-yes'));
    expect((await screen.findByTestId('bind-error')).textContent).toBe(BIND_FAILED_COPY);
    expect((screen.getByTestId('bind-yes') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('other viewers are unchanged', () => {
  it('bound link, signed out: the plain sign-in card with the hint, no bind step', async () => {
    h.hint = 'a***@x.com';
    mount();
    expect(await screen.findByTestId('invite-sign-in')).toBeTruthy();
    expect(screen.queryByTestId('bind-type')).toBeNull();
  });

  it.each([
    ['unbound', null],
    ['bound (hint matches)', 'b***@example.com'],
  ])('%s link, signed in: Join card, ZERO redeem calls until the click, then exactly one', async (_l, hint) => {
    h.user = { id: 'u1', email: 'b@example.com' };
    h.hint = hint;
    mount();
    fireEvent.click(await screen.findByTestId('invite-join'));
    await waitFor(() => expect(calls('redeem_organiser_invite_v1')).toHaveLength(1));
    expect(calls('bind_organiser_invite_email_v1')).toHaveLength(0);
  });

  it.each([
    ['unbound', null],
    ['bound', 'b***@example.com'],
  ])('%s link, signed in: no redeem and no bind just from landing', async (_l, hint) => {
    h.user = { id: 'u1', email: 'b@example.com' };
    h.hint = hint;
    mount();
    await screen.findByTestId('invite-join');
    await new Promise((r) => setTimeout(r, 30));
    expect(calls('redeem_organiser_invite_v1')).toHaveLength(0);
    expect(calls('bind_organiser_invite_email_v1')).toHaveLength(0);
  });
});
