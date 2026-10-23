// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

// Arc 1 PR 2 slice B: the sender screens (5a-5f) and the two request lists, mocked at the RPC boundary.
const h = vi.hoisted(() => ({ rpc: vi.fn(), organisers: [] as unknown[] }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'a1' }, authStatus: 'ready' }) }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...a: unknown[]) => h.rpc(...a),
    from: () => ({ select: () => ({ order: () => ({ limit: async () => ({ data: h.organisers, error: null }) }) }) }),
  },
}));

import AdminOrganisersPage from '../AdminOrganisersPage';
import { ACCESS_REQUESTS_EMPTY, EMAIL_HELP, PREFILL_NEEDS_EMAIL, ISSUE_REFUSAL, ISSUE_REFUSALS, LINK_REQUESTS_EMPTY, NO_EMAIL_NOTE, RESOLVE_REFUSAL } from '../senderModel';

const TOKEN = 'b'.repeat(64);
const ok = (data: unknown) => Promise.resolve({ data, error: null });
let issueAnswer: unknown;
let linkRequests: unknown[];
let accessRequests: unknown[];
let resolveAnswer: unknown;

beforeEach(() => {
  h.organisers = [
    { id: 'o1', name: 'Salsa Norte', lifecycle_status: 'live' },
    { id: 'o2', name: 'Bachata Sur', lifecycle_status: 'live' },
  ];
  issueAnswer = { ok: true, invite_id: 'i9', organiser_id: 'o1', token: TOKEN, expires_at: '2026-10-28T10:00:00Z', email_bound: true, revoked_previous: [] };
  linkRequests = [];
  accessRequests = [];
  resolveAnswer = { ok: true };
  h.rpc.mockReset().mockImplementation((fn: string) => {
    switch (fn) {
      case 'admin_is_admin': return ok(true);
      case 'organiser_ownership_v1': return ok({ is_managed: false });
      case 'admin_list_organiser_invites_v1': return ok([]);
      case 'admin_issue_organiser_invite_v1': return ok(issueAnswer);
      case 'admin_list_invite_requests_v1': return ok(linkRequests);
      case 'admin_list_signup_access_requests_v1': return ok(accessRequests);
      case 'admin_resolve_invite_request_v1': return ok(resolveAnswer);
      case 'admin_resolve_signup_access_request_v1': return ok(resolveAnswer);
      default: return Promise.reject(new Error(`unexpected rpc ${fn}`));
    }
  });
});
afterEach(cleanup);

const mount = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><AdminOrganisersPage /></MemoryRouter>
  </QueryClientProvider>,
);
const openLinkForm = async (name = 'Salsa Norte') => {
  mount();
  const row = (await screen.findByText(name)).closest('li') as HTMLElement;
  await waitFor(() => expect(row.getAttribute('data-status')).toBe('unclaimed'));
  fireEvent.click(row.querySelector('button')!);
  fireEvent.click(screen.getByTestId('row-primary'));
  fireEvent.click(screen.getByTestId('choice-link'));
};
const calls = (fn: string) => h.rpc.mock.calls.filter((c) => c[0] === fn);

describe('5b the Invite sheet', () => {
  it('one Invite button opens three choices; each opens its own path', async () => {
    await openLinkForm();
    fireEvent.click(screen.getByTestId('link-cancel'));
    fireEvent.click(screen.getByTestId('row-primary'));
    const sheet = screen.getByTestId('invite-choices');
    expect(within(sheet).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Send a linkCopy or WhatsApp. Works once, 7 days.',
      'They already have an accountAdd them now by email.',
      'Invite by emailA ready message for one address.',
      'Cancel',
    ]);
    fireEvent.click(screen.getByTestId('choice-email'));
    expect(screen.getByTestId('invite-person').textContent).toContain('Invite by email to Salsa Norte');
    expect(screen.queryByTestId('invite-person-page')).toBeNull();
    fireEvent.click(screen.getByTestId('mode-back'));
    fireEvent.click(screen.getByTestId('row-primary'));
    fireEvent.click(screen.getByTestId('choice-existing'));
    expect(screen.getByTestId('add-person')).toBeTruthy();
  });
});

describe('the link form', () => {
  it('a bound link: email, first name and city go to the RPC; the shown link names who can use it', async () => {
    await openLinkForm();
    expect(screen.getByTestId('link-email-help').textContent).toBe(NO_EMAIL_NOTE);
    fireEvent.change(screen.getByTestId('link-email'), { target: { value: ' Ana@Example.com ' } });
    expect(screen.getByTestId('link-email-help').textContent).toBe(EMAIL_HELP);
    fireEvent.change(screen.getByTestId('link-first-name'), { target: { value: ' Ana ' } });
    fireEvent.click(screen.getByTestId('link-submit'));
    await screen.findByTestId('one-time-link');
    expect(calls('admin_issue_organiser_invite_v1')[0][1]).toEqual({ p_organiser_id: 'o1', p_email: 'Ana@Example.com', p_first_name: 'Ana', p_city_id: null });
    expect(screen.getByTestId('link-once-note').textContent).toBe('Shown once. Works once, runs out in 7 days. Only ana@example.com can use it.');
  });

  it('a mistyped email is stopped before the server, with the reason beside the button', async () => {
    await openLinkForm();
    fireEvent.change(screen.getByTestId('link-email'), { target: { value: 'ana@' } });
    expect((screen.getByTestId('link-submit') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('link-blocked').textContent).toBe(ISSUE_REFUSAL.invalid_email.text);
  });

  // Every refusal the RPC RETURNS x the link form: shown under its own field, never as a generic error.
  it.each(ISSUE_REFUSALS)('returned refusal %s shows under its field', async (reason) => {
    issueAnswer = { ok: false, reason };
    await openLinkForm();
    fireEvent.click(screen.getByTestId('link-submit'));
    const el = await screen.findByTestId(`link-error-${ISSUE_REFUSAL[reason].field}`);
    expect(el.textContent).toBe(ISSUE_REFUSAL[reason].text);
    expect(screen.queryByTestId('invite-error')).toBeNull();
    expect(screen.queryByTestId('one-time-link')).toBeNull();
  });

  it('a raised error (not an admin) reads in plain words', async () => {
    h.rpc.mockImplementation((fn: string) => (fn === 'admin_issue_organiser_invite_v1' ? Promise.resolve({ data: null, error: { message: 'not_authorised' } }) : fn === 'admin_is_admin' ? ok(true) : fn === 'organiser_ownership_v1' ? ok({ is_managed: false }) : ok([])));
    await openLinkForm();
    fireEvent.click(screen.getByTestId('link-submit'));
    expect((await screen.findByTestId('invite-error')).textContent).toMatch(/Only an admin can do that/);
  });
});

describe('F6: a link request starts the form with the request\u2019s email', () => {
  it.each([
    ['a bound request', 'luis@example.com', 'luis@example.com'],
    ['an unbound request', null, ''],
  ])('%s', async (_n, inviteEmail, expected) => {
    linkRequests = [{ id: 'r1', organiser_id: 'o2', organiser_name: 'Bachata Sur', invite_id: 'i1', invite_email: inviteEmail, requested_at: '2026-10-21T10:00:00Z', handled_at: null }];
    mount();
    fireEvent.click(await screen.findByTestId('link-requests-toggle'));
    fireEvent.click(await screen.findByTestId('link-request-send'));
    await screen.findByTestId('link-form');
    expect((screen.getByTestId('link-email') as HTMLInputElement).value).toBe(expected);
  });
});

describe('F7: first name and city only while there is an email', () => {
  it.each([
    ['empty email', '', true],
    ['blank email', '   ', true],
    ['an email', 'ana@example.com', false],
  ])('%s', async (_n, email, disabled) => {
    await openLinkForm();
    fireEvent.change(screen.getByTestId('link-email'), { target: { value: email } });
    expect((screen.getByTestId('link-first-name') as HTMLInputElement).disabled).toBe(disabled);
    expect((document.getElementById('link-city') as HTMLButtonElement | null)?.disabled ?? false).toBe(disabled);
    expect(screen.queryByTestId('link-prefill-reason')?.textContent ?? null).toBe(disabled ? PREFILL_NEEDS_EMAIL : null);
  });
});

describe('admin lists: link requests and access requests', () => {
  it('empty lists say what will appear there', async () => {
    mount();
    fireEvent.click(await screen.findByTestId('link-requests-toggle'));
    fireEvent.click(screen.getByTestId('access-requests-toggle'));
    expect((await screen.findByTestId('link-requests-empty')).textContent).toBe(LINK_REQUESTS_EMPTY);
    expect((await screen.findByTestId('access-requests-empty')).textContent).toBe(ACCESS_REQUESTS_EMPTY);
  });

  it('a link request: waiting count, Send a new link opens that row\u2019s link form, Mark done resolves it', async () => {
    linkRequests = [
      { id: 'r1', organiser_id: 'o2', organiser_name: 'Bachata Sur', invite_id: 'i1', invite_email: 'luis@example.com', requested_at: '2026-10-21T10:00:00Z', handled_at: null },
      { id: 'r0', organiser_id: 'o1', organiser_name: 'Salsa Norte', invite_id: 'i0', invite_email: null, requested_at: '2026-10-19T10:00:00Z', handled_at: '2026-10-19T12:00:00Z' },
    ];
    mount();
    await waitFor(() => expect(screen.getByTestId('link-requests-count').textContent).toBe('1'));
    fireEvent.click(screen.getByTestId('link-requests-toggle'));
    const rows = await screen.findAllByTestId('link-request-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('luis@example.com');
    fireEvent.click(within(rows[0]).getByTestId('link-request-done'));
    await waitFor(() => expect(calls('admin_resolve_invite_request_v1')[0][1]).toEqual({ p_id: 'r1' }));
    fireEvent.click(within(rows[0]).getByTestId('link-request-send'));
    expect((screen.getByTestId('admin-search') as HTMLInputElement).value).toBe('Bachata Sur');
    expect(await screen.findByTestId('link-form')).toBeTruthy();
    expect(screen.getAllByTestId('organiser-row')).toHaveLength(1);
  });

  it.each(Object.keys(RESOLVE_REFUSAL))('a returned %s refusal is shown in words', async (reason) => {
    resolveAnswer = { ok: false, reason };
    accessRequests = [{ id: 'a1', email: 'new@example.com', note: 'I run Sunday socials', requested_at: '2026-10-21T10:00:00Z', status: 'pending' }];
    mount();
    fireEvent.click(await screen.findByTestId('access-requests-toggle'));
    fireEvent.click(await screen.findByTestId('access-approve'));
    expect((await screen.findByTestId('access-requests-refused')).textContent).toBe(RESOLVE_REFUSAL[reason]);
  });

  it('access requests: waiting first with Approve and Dismiss; handled ones show their status only', async () => {
    accessRequests = [
      { id: 'a2', email: 'old@example.com', note: null, requested_at: '2026-10-20T10:00:00Z', status: 'dismissed' },
      { id: 'a1', email: 'new@example.com', note: 'I run Sunday socials', requested_at: '2026-10-19T10:00:00Z', status: 'pending' },
    ];
    mount();
    await waitFor(() => expect(screen.getByTestId('access-requests-count').textContent).toBe('1'));
    fireEvent.click(screen.getByTestId('access-requests-toggle'));
    const rows = await screen.findAllByTestId('access-request-row');
    expect(rows.map((r) => r.getAttribute('data-status'))).toEqual(['pending', 'dismissed']);
    expect(within(rows[1]).queryByTestId('access-approve')).toBeNull();
    fireEvent.click(within(rows[0]).getByTestId('access-dismiss'));
    await waitFor(() => expect(calls('admin_resolve_signup_access_request_v1')[0][1]).toEqual({ p_id: 'a1', p_action: 'dismiss' }));
  });
});
