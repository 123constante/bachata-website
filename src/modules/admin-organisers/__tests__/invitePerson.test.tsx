// @vitest-environment jsdom
/**
 * A-WEB2: Invite person, the email_mismatch redeem refusal, the Report a problem link and
 * the Full profile read. The network boundary is faked (invitePersonApi); nothing here
 * touches a network.
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

import { InvitePerson } from '../InvitePerson';
import { INVITE_PERSON_COPY, buildInviteMessage, invitePersonErrorMessage, parsePersonInvite } from '../invitePersonModel';
import { interpretRedeemWithMismatch } from '../redeemMismatch';
import { reportProblemUrl, ReportProblemLink } from '@/lib/contactLinks';

const ORGS = [{ id: 'o1', name: 'Ritmo', lifecycle: 'live' }];
const ANSWER = { invite_id: 'i1', token: 't'.repeat(64), email: 'ana@example.com', link_path: `/invite/${'t'.repeat(64)}`, message: null };

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <InvitePerson organisers={ORGS} />
    </QueryClientProvider>,
  );

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.searchPeople.mockResolvedValue([{ id: 'p9', name: 'Ana Perez' }]);
  api.fetchPageLeader.mockResolvedValue(null);
  api.fetchUpcoming.mockResolvedValue([{ name: 'Friday Social', date: '2026-10-30' }]);
});
afterEach(cleanup);

describe('Invite person', () => {
  it('is disabled with a visible reason until a person and a plausible email are set', async () => {
    mount();
    fireEvent.click(screen.getByTestId('invite-person-open'));
    const submit = screen.getByTestId('invite-person-submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(screen.getByTestId('invite-person-note').textContent).toMatch(/Choose the person/);
    fireEvent.change(screen.getByTestId('invite-person-search'), { target: { value: 'Ana' } });
    fireEvent.click(await screen.findByText('Ana Perez'));
    expect(screen.getByTestId('invite-person-note').textContent).toMatch(/email address/);
    fireEvent.change(screen.getByTestId('invite-person-email'), { target: { value: 'ana@example.com' } });
    expect(submit.disabled).toBe(false);
    expect(screen.queryByTestId('invite-person-note')).toBeNull();
  });

  it('prefills the page Leader and sends the organiser id; result has a message, Copy and WhatsApp', async () => {
    api.fetchPageLeader.mockResolvedValue({ id: 'p1', name: 'Rosa Lima' });
    api.invitePerson.mockResolvedValue(parsePersonInvite(ANSWER));
    mount();
    fireEvent.click(screen.getByTestId('invite-person-open'));
    fireEvent.change(screen.getByTestId('invite-person-page'), { target: { value: 'o1' } });
    expect((await screen.findByTestId('invite-person-chosen')).textContent).toMatch(/Rosa Lima/);
    fireEvent.change(screen.getByTestId('invite-person-email'), { target: { value: 'rosa@example.com' } });
    await waitFor(() => expect(api.fetchUpcoming).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('invite-person-submit'));
    const msg = (await screen.findByTestId('invite-person-message')) as HTMLTextAreaElement;
    expect(api.invitePerson).toHaveBeenCalledWith('p1', 'rosa@example.com', 'o1');
    expect(msg.value).toMatch(/manage Ritmo/);
    expect(msg.value).toMatch(/Friday Social/);
    expect(msg.value).toContain(`/invite/${'t'.repeat(64)}`);
    expect(screen.getByTestId('invite-person-whatsapp').getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(screen.getByTestId('invite-person-copy')).toBeTruthy();
  });

  it('with no page it searches people, sends a null organiser and says nothing about a page', async () => {
    api.invitePerson.mockResolvedValue(parsePersonInvite(ANSWER));
    mount();
    fireEvent.click(screen.getByTestId('invite-person-open'));
    fireEvent.change(screen.getByTestId('invite-person-search'), { target: { value: 'Ana' } });
    fireEvent.click(await screen.findByText('Ana Perez'));
    fireEvent.change(screen.getByTestId('invite-person-email'), { target: { value: 'ana@example.com' } });
    fireEvent.click(screen.getByTestId('invite-person-submit'));
    const msg = (await screen.findByTestId('invite-person-message')) as HTMLTextAreaElement;
    expect(api.invitePerson).toHaveBeenCalledWith('p9', 'ana@example.com', null);
    expect(msg.value).toMatch(/existing profile/);
    expect(msg.value).not.toMatch(/Coming up/);
  });

  it.each(Object.keys(INVITE_PERSON_COPY))('refusal %s shows its plain words, not the code', async (code) => {
    api.invitePerson.mockRejectedValue(new Error(code));
    mount();
    fireEvent.click(screen.getByTestId('invite-person-open'));
    fireEvent.change(screen.getByTestId('invite-person-search'), { target: { value: 'Ana' } });
    fireEvent.click(await screen.findByText('Ana Perez'));
    fireEvent.change(screen.getByTestId('invite-person-email'), { target: { value: 'ana@example.com' } });
    fireEvent.click(screen.getByTestId('invite-person-submit'));
    const err = await screen.findByTestId('invite-person-error');
    expect(err.textContent).toBe(INVITE_PERSON_COPY[code]);
    expect(err.textContent).not.toContain(code);
  });

  it('a missing function shows the normal error state, never raw text', () => {
    expect(invitePersonErrorMessage(new Error('Could not find the function public.admin_invite_person_v1'))).toBe('Something went wrong. Please try again.');
  });

  it('a page without a Leader says to search, an empty search says what to do', async () => {
    api.searchPeople.mockResolvedValue([]);
    mount();
    fireEvent.click(screen.getByTestId('invite-person-open'));
    fireEvent.change(screen.getByTestId('invite-person-page'), { target: { value: 'o1' } });
    await waitFor(() => expect(screen.getByTestId('invite-person-search-note').textContent).toMatch(/no Leader/));
    fireEvent.change(screen.getByTestId('invite-person-search'), { target: { value: 'Zed' } });
    expect((await screen.findByTestId('invite-person-no-hits')).textContent).toMatch(/No one matches/);
  });
});

describe('invite answer parser', () => {
  it.each([[null], [{}], [{ ...ANSWER, link_path: 'https://evil.example' }], [{ ...ANSWER, token: 5 }]])('refuses %j', (v) => {
    expect(parsePersonInvite(v)).toBeNull();
  });
  it('caps the events in the message', () => {
    const upcoming = Array.from({ length: 8 }, (_, i) => ({ name: `E${i}`, date: '2026-11-01' }));
    const m = buildInviteMessage({ personName: 'Ana', organiserName: 'Ritmo', link: 'L', upcoming, pageUrl: 'P' });
    expect(m).toMatch(/and 3 more/);
  });
});

describe('redeem email_mismatch', () => {
  it('names the email when the answer carries it, else says to use the invited one', () => {
    const a = interpretRedeemWithMismatch({ ok: false, reason: 'email_mismatch', invite_email: 'a@b.co' }, null);
    expect(a.kind).toBe('refused');
    expect(a.kind === 'refused' && a.copy.body).toContain('a@b.co');
    const b = interpretRedeemWithMismatch({ ok: false, reason: 'email_mismatch' }, null);
    expect(b.kind === 'refused' && b.copy.terminal).toBe(false);
  });
  it('still delegates everything else', () => {
    expect(interpretRedeemWithMismatch({ ok: false, reason: 'used' }, null).kind).toBe('refused');
    expect(interpretRedeemWithMismatch(null, { message: 'x' }).kind).toBe('failed');
  });
});

describe('Report a problem', () => {
  it('prefills WhatsApp with the page address after mount', async () => {
    render(<ReportProblemLink />);
    const a = screen.getByTestId('report-problem') as HTMLAnchorElement;
    await waitFor(() => expect(decodeURIComponent(a.href)).toContain(window.location.href));
    expect(a.textContent).toMatch(/Something wrong on this page\? Tell us/);
    expect(a.href).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    expect(reportProblemUrl(null)).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
  });
});
