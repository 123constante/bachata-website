// @vitest-environment jsdom
/**
 * RELEASE-A-WEB review, group A fix pass (findings 1, 5, 9, 13, 17).
 * The network boundary is faked (invitePersonApi); the fake runs the REAL answer parser,
 * exactly as invitePersonApi.invitePerson does, so a refused answer shows the error state.
 * The server messages below are built the way admin_invite_person_v1 builds them
 * (admin 20261129240000_people_a_db2_invites_v1.sql), not one-line stand-ins.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const api = vi.hoisted(() => ({
  searchPeople: vi.fn(),
  fetchPageLeader: vi.fn(),
  fetchUpcoming: vi.fn(),
  invitePerson: vi.fn(),
}));
vi.mock('../invitePersonApi', async (orig) => ({ ...(await orig<typeof import('../invitePersonApi')>()), ...api }));

import { InvitePerson } from '../InvitePerson';
import { buildInviteMessage, parsePersonInvite } from '../invitePersonModel';
import { interpretRedeemWithMismatch } from '../redeemMismatch';
import { REDEEM_COPY } from '../inviteModel';

const TOKEN = 'ab'.repeat(32);
const SITE = 'https://bachatacalendar.co.uk';

/** admin_invite_person_v1 with a page: greeting, link, events and expiry are all in it. */
const SERVER_PAGE_MESSAGE = [
  'Hello Rosa! You are invited to manage Ritmo on Bachata Calendar.',
  '',
  'Open this link and sign in with rosa@example.com:',
  `${SITE}/invite/${TOKEN}`,
  '',
  'We will send a sign-in link to that email. Once you are in, the page is yours: you can edit it and add events.',
  '',
  'Events already on the page:',
  '- Friday Social',
  '- Sunday Party',
  '',
  'The link works for 7 days.',
].join('\n');

/** admin_invite_person_v1 with no page (teacher, DJ or other): no invite row, no token. */
const SERVER_NO_PAGE_MESSAGE = [
  'Hello Ana! You are invited to Bachata Calendar.',
  '',
  `Open ${SITE}/account and sign in with ana@example.com.`,
  'We will send a sign-in link to that email. Your profile is ready for you when you sign in.',
].join('\n');

const PAGE_ANSWER = { invite_id: 'i1', token: TOKEN, email: 'rosa@example.com', link_path: `/invite/${TOKEN}`, message: SERVER_PAGE_MESSAGE };
const NO_PAGE_ANSWER = { invite_id: null, token: null, email: 'ana@example.com', link_path: '/account', message: SERVER_NO_PAGE_MESSAGE };

const ORGS = [{ id: 'o1', name: 'Ritmo', lifecycle: 'live' }];
const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <InvitePerson organisers={ORGS} />
    </QueryClientProvider>,
  );

/** What invitePersonApi.invitePerson does with the RPC answer. */
const answerWith = (data: unknown) =>
  api.invitePerson.mockImplementation(async () => {
    const parsed = parsePersonInvite(data);
    if (!parsed) throw new Error('malformed_invite_answer');
    return parsed;
  });

const pickAnaAndInvite = async (email = 'ana@example.com') => {
  fireEvent.change(screen.getByTestId('invite-person-search'), { target: { value: 'Ana' } });
  fireEvent.click(await screen.findByText('Ana Perez'));
  fireEvent.change(screen.getByTestId('invite-person-email'), { target: { value: email } });
  fireEvent.click(screen.getByTestId('invite-person-submit'));
};

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.searchPeople.mockResolvedValue([{ id: 'p9', name: 'Ana Perez', firstName: 'Ana' }]);
  api.fetchPageLeader.mockResolvedValue({ kind: 'none' });
  api.fetchUpcoming.mockResolvedValue([{ name: 'Friday Social', date: '2026-10-30' }]);
});
afterEach(cleanup);

// ---- finding 1 + 17: the answer parser, one row per shape --------------------------------

describe('parsePersonInvite: every answer shape (findings 1, 17)', () => {
  const ROWS: { shape: string; data: unknown; out: 'page' | 'no_page' | null }[] = [
    { shape: 'page invite', data: PAGE_ANSWER, out: 'page' },
    { shape: "no page -> {invite_id:null, token:null, link_path:'/account'}", data: NO_PAGE_ANSWER, out: 'no_page' },
    { shape: 'no page, message null', data: { ...NO_PAGE_ANSWER, message: null }, out: 'no_page' },
    { shape: 'link_path missing', data: { ...PAGE_ANSWER, link_path: undefined }, out: null },
    { shape: 'link_path missing, no page', data: { ...NO_PAGE_ANSWER, link_path: undefined }, out: null },
    { shape: 'link_path not a path', data: { ...NO_PAGE_ANSWER, link_path: 'account' }, out: null },
    { shape: 'link_path off-site', data: { ...PAGE_ANSWER, link_path: 'https://evil.example' }, out: null },
    { shape: 'email missing', data: { ...NO_PAGE_ANSWER, email: undefined }, out: null },
    { shape: 'invite path with null invite_id', data: { ...PAGE_ANSWER, invite_id: null }, out: null },
    { shape: 'invite path with null token', data: { ...PAGE_ANSWER, token: null }, out: null },
    { shape: 'invite path with both null', data: { ...PAGE_ANSWER, invite_id: null, token: null }, out: null },
    { shape: 'no page with a token but no invite id', data: { ...NO_PAGE_ANSWER, token: TOKEN }, out: null },
    { shape: 'no page with an invite id but no token', data: { ...NO_PAGE_ANSWER, invite_id: 'i1' }, out: null },
    { shape: 'no page with the keys missing (not null)', data: { email: 'ana@example.com', link_path: '/account', message: null }, out: null },
    { shape: 'token a number', data: { ...PAGE_ANSWER, token: 5 }, out: null },
    { shape: 'null', data: null, out: null },
    { shape: 'empty object', data: {}, out: null },
  ];
  it.each(ROWS)('$shape', ({ data, out }) => {
    const p = parsePersonInvite(data);
    if (out === null) return expect(p).toBeNull();
    expect(p).not.toBeNull();
    if (out === 'page') expect(p).toMatchObject({ inviteId: 'i1', token: TOKEN, linkPath: `/invite/${TOKEN}` });
    else expect(p).toMatchObject({ inviteId: null, token: null, linkPath: '/account', email: 'ana@example.com' });
  });
});

describe('Invite person with no page (finding 1)', () => {
  it('no page -> the result card with the server message and the no-page note, never the error', async () => {
    answerWith(NO_PAGE_ANSWER);
    mount();
    fireEvent.click(screen.getByTestId('invite-person-open'));
    await pickAnaAndInvite();
    const msg = (await screen.findByTestId('invite-person-message')) as HTMLTextAreaElement;
    expect(api.invitePerson).toHaveBeenCalledWith('p9', 'ana@example.com', null);
    expect(screen.queryByTestId('invite-person-error')).toBeNull();
    expect(msg.value).toBe(SERVER_NO_PAGE_MESSAGE);
    expect(screen.getByTestId('invite-person-no-page').textContent).toMatch(/sign in with that email/);
    // There is no one-time link to lose, so the "only time the link is shown" warning is not drawn.
    expect(screen.queryByTestId('invite-person-once')).toBeNull();
  });

  it('a page invite keeps the one-time-link warning and has no no-page note', async () => {
    answerWith(PAGE_ANSWER);
    mount();
    fireEvent.click(screen.getByTestId('invite-person-open'));
    await pickAnaAndInvite('rosa@example.com');
    await screen.findByTestId('invite-person-message');
    expect(screen.getByTestId('invite-person-once')).toBeTruthy();
    expect(screen.queryByTestId('invite-person-no-page')).toBeNull();
  });
});

// ---- finding 5: the server message is the message ----------------------------------------

describe('invite message uses the server text as is (finding 5)', () => {
  const base = { personName: 'Rosa', organiserName: 'Ritmo', link: `https://www.bachatacalendar.co.uk/invite/${TOKEN}`, upcoming: [{ name: 'Friday Social', date: '2026-10-24' }], pageUrl: 'https://www.bachatacalendar.co.uk/organisers/o1' };
  it('page invite: exactly the server message, one greeting, one link, one event list', () => {
    const m = buildInviteMessage({ ...base, serverMessage: SERVER_PAGE_MESSAGE });
    expect(m).toBe(SERVER_PAGE_MESSAGE);
    expect(m.match(/\b(Hi|Hello)\b/g)).toHaveLength(1);
    expect(m.match(/\/invite\//g)).toHaveLength(1);
    expect(m).not.toMatch(/Coming up/);
    expect(m).not.toMatch(/2026-10-24/);
  });
  it('no page: exactly the server message', () => {
    expect(buildInviteMessage({ ...base, organiserName: null, pageUrl: null, upcoming: [], link: 'https://x/account', serverMessage: SERVER_NO_PAGE_MESSAGE })).toBe(SERVER_NO_PAGE_MESSAGE);
  });
  it('server message null: still built here, with a greeting and the link', () => {
    const m = buildInviteMessage({ ...base, serverMessage: null });
    expect(m.split('\n')[0]).toBe('Hi Rosa!');
    expect(m).toContain(base.link);
    expect(m).toMatch(/Coming up/);
  });
  it('the copied text on screen is the server message', async () => {
    api.fetchPageLeader.mockResolvedValue({ kind: 'one', person: { id: 'p1', name: 'Rosa Lima', firstName: 'Rosa' } });
    answerWith(PAGE_ANSWER);
    mount();
    fireEvent.click(screen.getByTestId('invite-person-open'));
    fireEvent.change(screen.getByTestId('invite-person-page'), { target: { value: 'o1' } });
    await screen.findByTestId('invite-person-chosen');
    fireEvent.change(screen.getByTestId('invite-person-email'), { target: { value: 'rosa@example.com' } });
    fireEvent.click(screen.getByTestId('invite-person-submit'));
    expect(((await screen.findByTestId('invite-person-message')) as HTMLTextAreaElement).value).toBe(SERVER_PAGE_MESSAGE);
  });
});

// ---- finding 9: no copy that points at a control that is not on screen -------------------

describe('Invite person "no hits" line (finding 9)', () => {
  it('says what to do without naming a control the screen does not have', async () => {
    api.searchPeople.mockResolvedValue([]);
    mount();
    fireEvent.click(screen.getByTestId('invite-person-open'));
    fireEvent.change(screen.getByTestId('invite-person-search'), { target: { value: 'Zz' } });
    const line = (await screen.findByTestId('invite-person-no-hits')).textContent ?? '';
    expect(line).toMatch(/No one matches/);
    expect(line).not.toMatch(/\b(add|create|new profile|tap|click|button|menu)\b/i);
  });
});

// ---- finding 13: one redeem error-copy map ------------------------------------------------

describe('redeem copy lives in ONE map (finding 13)', () => {
  it('email_unproven and email_mismatch (no hint) are REDEEM_COPY entries, and the wrapper shows exactly them', () => {
    const unproven = interpretRedeemWithMismatch({ ok: false, reason: 'email_unproven' }, null);
    expect(unproven).toEqual({ kind: 'refused', reason: 'email_unproven', copy: REDEEM_COPY.email_unproven });
    const mismatch = interpretRedeemWithMismatch({ ok: false, reason: 'email_mismatch' }, null);
    expect(mismatch).toEqual({ kind: 'refused', reason: 'email_mismatch', copy: REDEEM_COPY.email_mismatch });
  });
  it('a masked hint only changes the body of the same entry', () => {
    const out = interpretRedeemWithMismatch({ ok: false, reason: 'email_mismatch', invite_email_hint: 'r...@example.com' }, null);
    expect(out.kind === 'refused' && out.copy.title).toBe(REDEEM_COPY.email_mismatch.title);
    expect(out.kind === 'refused' && out.copy.body).toContain('r...@example.com');
    expect(out.kind === 'refused' && out.copy.terminal).toBe(false);
  });
  it('redeemMismatch.ts holds no copy of its own', () => {
    const src = readFileSync(join(__dirname, '..', 'redeemMismatch.ts'), 'utf8');
    expect(src).not.toMatch(/\b(title|body)\s*:/);
  });
});
