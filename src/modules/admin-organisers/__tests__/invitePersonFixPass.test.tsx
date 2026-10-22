// @vitest-environment jsdom
/**
 * A-WEB2 fix pass (review findings 3, 5, 6, 8, 9). Each block pins a rule the first build's
 * tests let a mutation through: the D16 refusal list literally, the masked-only invite email
 * (D36), "more than one Leader" prefills nothing, the server's own message, the nameless
 * greeting, the 44 px Report link and the four Full profile answers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const api = vi.hoisted(() => ({
  searchPeople: vi.fn(),
  fetchPageLeader: vi.fn(),
  fetchUpcoming: vi.fn(),
  invitePerson: vi.fn(),
}));
vi.mock('../invitePersonApi', async (orig) => ({ ...(await orig<typeof import('../invitePersonApi')>()), ...api }));
const rpcLoose = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose }));

import { InvitePerson } from '../InvitePerson';
import { INVITE_PERSON_COPY, buildInviteMessage, invitePersonErrorMessage, parsePersonInvite } from '../invitePersonModel';
import { interpretRedeem, reasonScreen } from '../inviteModel';

/** What the landing shows for an answer: interpretRedeem, then the ONE reason -> screen mapping. */
const shownFor = (answer: unknown) => {
  const o = interpretRedeem(answer, null);
  return o.kind === 'refused' ? { ...o, copy: reasonScreen(o.reason, { emailHint: o.emailHint }) } : o;
};

import { ReportProblemLink } from '@/lib/contactLinks';
import { fetchOrganiserFullProfile } from '@/modules/profile/organiserPublicProfile';

const ORGS = [{ id: 'o1', name: 'Ritmo', lifecycle: 'live' }];
const TOKEN = 't'.repeat(64);
const ANSWER = { invite_id: 'i1', token: TOKEN, email: 'ana@example.com', link_path: `/invite/${TOKEN}`, message: null as string | null };

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <InvitePerson organisers={ORGS} />
    </QueryClientProvider>,
  );

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  rpcLoose.mockReset();
  api.searchPeople.mockResolvedValue([{ id: 'p9', name: 'Ana Perez', firstName: 'Ana' }]);
  api.fetchPageLeader.mockResolvedValue({ kind: 'none' });
  api.fetchUpcoming.mockResolvedValue([]);
});
afterEach(cleanup);

// D16, written out by hand: iterating INVITE_PERSON_COPY would let a deleted row pass (mutation M4).
const D16_CODES = ['not_admin', 'invalid_email', 'email_in_use', 'profile_not_found', 'organiser_not_found'];

describe('D16 refusal codes (pinned literally)', () => {
  it.each(D16_CODES)('%s has its own plain words', (code) => {
    expect(Object.keys(INVITE_PERSON_COPY)).toContain(code);
    const words = invitePersonErrorMessage(new Error(code));
    expect(words).toBe(INVITE_PERSON_COPY[code]);
    expect(words).not.toBe('Something went wrong. Please try again.');
    expect(words).not.toContain(code);
  });
  it('the copy has no raw curly punctuation (CLAUDE.md: entities or plain ASCII only)', () => {
    for (const words of Object.values(INVITE_PERSON_COPY)) expect(words).toMatch(/^[\x20-\x7e]*$/);
  });
});

describe('Leader prefill (finding 3)', () => {
  it('one Leader is prefilled', async () => {
    api.fetchPageLeader.mockResolvedValue({ kind: 'one', person: { id: 'p1', name: 'Rosa Lima', firstName: 'Rosa' } });
    mount();
    fireEvent.click(screen.getByTestId('invite-person-open'));
    fireEvent.change(screen.getByTestId('invite-person-page'), { target: { value: 'o1' } });
    expect((await screen.findByTestId('invite-person-chosen')).textContent).toMatch(/Rosa Lima/);
  });
  it('two or more Leaders prefill nobody and say to search', async () => {
    api.fetchPageLeader.mockResolvedValue({ kind: 'several' });
    mount();
    fireEvent.click(screen.getByTestId('invite-person-open'));
    fireEvent.change(screen.getByTestId('invite-person-page'), { target: { value: 'o1' } });
    await waitFor(() =>
      expect(screen.getByTestId('invite-person-search-note').textContent).toBe('This page has more than one Leader. Search for the person to invite.'),
    );
    expect(screen.queryByTestId('invite-person-chosen')).toBeNull();
    expect((screen.getByTestId('invite-person-submit') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('invite message (findings 8, 9)', () => {
  const base = { organiserName: 'Ritmo', link: 'https://x/invite/t', upcoming: [], pageUrl: null };
  it("uses the server's message instead of a hardcoded expiry", () => {
    const m = buildInviteMessage({ ...base, personName: 'Ana', serverMessage: 'It works once and runs out on 3 November.' });
    expect(m).toContain('It works once and runs out on 3 November.');
    expect(m).not.toMatch(/7 days/);
  });
  it('never states an expiry the server did not send', () => {
    expect(buildInviteMessage({ ...base, personName: 'Ana', serverMessage: null })).not.toMatch(/7 days/);
  });
  it('greets without a name when the person has none (never "Hi Unnamed!")', () => {
    const m = buildInviteMessage({ ...base, personName: null, serverMessage: null });
    expect(m.split('\n')[0]).toBe('Hi!');
  });
  // Review finding 5: a server message is the whole message (it greets by itself), so the nameless
  // greeting is the one built here when the server sent none. groupAFixPass covers the server text.
  it('with no server message, the sent message greets a nameless person plainly', async () => {
    api.searchPeople.mockResolvedValue([{ id: 'p9', name: 'Unnamed person', firstName: null }]);
    api.invitePerson.mockResolvedValue(parsePersonInvite({ ...ANSWER, message: null }));
    mount();
    fireEvent.click(screen.getByTestId('invite-person-open'));
    fireEvent.change(screen.getByTestId('invite-person-search'), { target: { value: 'Un' } });
    fireEvent.click(await screen.findByText('Unnamed person'));
    fireEvent.change(screen.getByTestId('invite-person-email'), { target: { value: 'ana@example.com' } });
    fireEvent.click(screen.getByTestId('invite-person-submit'));
    const msg = ((await screen.findByTestId('invite-person-message')) as HTMLTextAreaElement).value;
    expect(msg.split('\n')[0]).toBe('Hi!');
    expect(msg).not.toMatch(/Unnamed/);
  });
});

describe('email_mismatch never shows the full invite email (D36, finding 5)', () => {
  it.each([
    ['full invite_email only', { invite_email: 'rosa.lima@ymail.com' }, null],
    ['full email only', { email: 'rosa.lima@ymail.com' }, null],
    ['a hint that is really a full address', { invite_email_hint: 'rosa.lima@ymail.com' }, null],
    ['masked hint', { invite_email_hint: 'r...@ymail.com' }, 'r...@ymail.com'],
    ['masked hint beside a full address', { invite_email_hint: 'r***@ymail.com', invite_email: 'rosa.lima@ymail.com' }, 'r***@ymail.com'],
  ])('%s', (_label, extra, shown) => {
    const out = shownFor({ ok: false, reason: 'email_mismatch', ...extra });
    expect(out.kind).toBe('refused');
    const body = out.kind === 'refused' ? out.copy.body : '';
    expect(body).not.toContain('rosa.lima');
    if (shown) expect(body).toContain(shown);
    else expect(body).toBe('It was sent to another email address.');
  });
});

describe('Report a problem tap target (mutation M6)', () => {
  it('is at least 44 px high', () => {
    render(<ReportProblemLink />);
    expect(screen.getByTestId('report-problem').className).toMatch(/(^|\s)min-h-\[44px\](\s|$)/);
  });
});

describe('Full profile mark answer (mutation M7)', () => {
  it.each([
    ['true', { data: true, error: null }, true],
    ['false', { data: false, error: null }, false],
    ['function missing', { data: null, error: { message: 'Could not find the function public.organiser_full_profile_v1' } }, false],
    ['error', { data: null, error: { message: 'boom' } }, false],
    ['an object', { data: {}, error: null }, false],
    ['the string "true"', { data: 'true', error: null }, false],
  ])('%s', async (_label, answer, shown) => {
    rpcLoose.mockResolvedValue(answer);
    expect(await fetchOrganiserFullProfile('o1')).toBe(shown);
  });
  it('a thrown call is false', async () => {
    rpcLoose.mockRejectedValue(new Error('network'));
    expect(await fetchOrganiserFullProfile('o1')).toBe(false);
  });
});
