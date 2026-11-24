// @vitest-environment jsdom
/**
 * W3 "an invite always names the person": the table over the person
 * {unclaimed with email, unclaimed without email, shadow login, already claimed, new}.
 * The network boundary is faked (invitePersonApi, duplicatesApi); nothing here touches a network.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const api = vi.hoisted(() => ({ fetchPageTeam: vi.fn(), searchPeople: vi.fn(), fetchUpcoming: vi.fn(), invitePerson: vi.fn() }));
const dup = vi.hoisted(() => ({ fetchDuplicates: vi.fn() }));
vi.mock('../invitePersonApi', async (orig) => ({ ...(await orig<typeof import('../invitePersonApi')>()), ...api }));
vi.mock('../duplicates/duplicatesApi', async (orig) => ({ ...(await orig<typeof import('../duplicates/duplicatesApi')>()), ...dup }));

import { InvitePersonWho } from '../InvitePersonWho';
import { parsePersonInvite, refusalScreen } from '../invitePersonModel';
import type { TeamPerson } from '../invitePersonApi';

const ORG = { id: 'o1', name: 'Sensual Vibes', lifecycle: 'live' } as never;
const TOKEN = 'a'.repeat(64);
const OK = parsePersonInvite({ invite_id: 'i1', token: TOKEN, email: 'x@example.com', link_path: `/invite/${TOKEN}`, message: null });
const inUse = () => Promise.reject(new Error('email_in_use'));

// The five person shapes (prod 2026-10-23, team-list profiles: 37 unclaimed no email, 1 with email,
// 5 never-signed-in own logins, the rest claimed). claimed_by is a private column, so a team-list row
// carries no login state; only the admin search RPC returns it (the claimed person is found by search).
const PEOPLE = {
  unclaimedEmail: { id: 'p-ue', name: 'Maria Lopez', firstName: 'Maria', hasLogin: false },
  unclaimedNoEmail: { id: 'p-un', name: 'Papacito', firstName: 'Papacito', hasLogin: false },
  shadow: { id: 'p-sh', name: 'Tom Reyes', firstName: 'Tom', hasLogin: false },
  claimed: { id: 'p-cl', name: 'Rosa Lima', firstName: 'Rosa', hasLogin: true },
} as const;

const ON_TEAM = [PEOPLE.unclaimedEmail, PEOPLE.unclaimedNoEmail, PEOPLE.shadow];
const team = (): TeamPerson[] => ON_TEAM.map(({ hasLogin: _unknown, ...p }) => ({ ...p }));

const cb = { onSomeoneNew: vi.fn(), onExistingAccount: vi.fn(), onCancel: vi.fn() };
const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <InvitePersonWho organiser={ORG} {...cb} />
    </QueryClientProvider>,
  );
const pressed = () => screen.queryAllByTestId('who-pick').filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.getAttribute('data-id'));

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  Object.values(cb).forEach((f) => f.mockReset());
  dup.fetchDuplicates.mockReset().mockResolvedValue({ kind: 'unavailable' });
  api.searchPeople.mockResolvedValue([]);
  api.fetchUpcoming.mockResolvedValue([]);
});
afterEach(cleanup);

describe('nothing is pre-picked and there is no Leader tag', () => {
  it('lists the team with nobody selected, Next off, no tag or hint', async () => {
    api.fetchPageTeam.mockResolvedValue(team());
    mount();
    await screen.findAllByTestId('who-pick');
    expect(pressed()).toEqual([]);
    expect((screen.getByTestId('who-next') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('who-blocked')).toBeTruthy();
    expect(screen.queryAllByTestId('who-leader-tag')).toHaveLength(0);
    expect(screen.queryByTestId('who-several-leaders')).toBeNull();
  });

  it('tapping a person selects only them', async () => {
    api.fetchPageTeam.mockResolvedValue(team());
    mount();
    fireEvent.click((await screen.findAllByTestId('who-pick'))[1]);
    expect(pressed()).toEqual(['p-un']);
    expect((screen.getByTestId('who-next') as HTMLButtonElement).disabled).toBe(false);
  });

  it('an empty team list says what to do; search finds anyone else', async () => {
    api.fetchPageTeam.mockResolvedValue([]);
    api.searchPeople.mockResolvedValue([{ id: 'p-far', name: 'Ana Perez', firstName: 'Ana', hasLogin: false }]);
    mount();
    expect((await screen.findByTestId('who-team-empty')).textContent).toMatch(/Search for them below, or pick Someone new/);
    fireEvent.change(screen.getByTestId('who-search'), { target: { value: 'Ana' } });
    fireEvent.click(await screen.findByText('Ana Perez'));
    expect(pressed()).toEqual(['p-far']);
  });
});

type Kind = keyof typeof PEOPLE | 'new';

const KINDS: Kind[] = ['unclaimedEmail', 'unclaimedNoEmail', 'shadow', 'claimed', 'new'];

describe('the person', () => {
  it.each(KINDS)('person %s', async (kind) => {
    api.fetchPageTeam.mockResolvedValue(team());
    mount();
    await screen.findAllByTestId('who-pick');
    if (kind === 'new') {
      fireEvent.click(screen.getByTestId('choice-link'));
      expect(cb.onSomeoneNew).toHaveBeenCalledTimes(1);
      expect(api.invitePerson).not.toHaveBeenCalled();
      return;
    }
    const p = PEOPLE[kind];
    api.invitePerson.mockImplementation(() => (kind === 'shadow' || kind === 'claimed' ? inUse() : Promise.resolve(OK)));
    if (kind === 'claimed') {
      api.searchPeople.mockResolvedValue([PEOPLE.claimed]);
      fireEvent.change(screen.getByTestId('who-search'), { target: { value: 'Rosa' } });
      await screen.findByText('Rosa Lima');
    }
    fireEvent.click(screen.getAllByTestId('who-pick').find((b) => b.getAttribute('data-id') === p.id)!);
    fireEvent.click(screen.getByTestId('who-next'));
    expect(screen.getByTestId('who-email-person').textContent).toBe(p.name);
    expect(screen.queryByTestId('who-has-login') !== null).toBe(p.hasLogin);
    const submit = screen.getByTestId('who-submit') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(screen.getByTestId('who-email-blocked').textContent).toMatch(/email address/);
    fireEvent.change(screen.getByTestId('who-email-input'), { target: { value: ' x@example.com ' } });
    fireEvent.click(submit);
    await waitFor(() => expect(api.invitePerson).toHaveBeenCalledWith(p.id, 'x@example.com', 'o1'));
    if (kind === 'shadow' || kind === 'claimed') {
      const refused = await screen.findByTestId('invite-refused');
      expect(refused.getAttribute('data-code')).toBe('email_in_use');
      expect(refused.textContent).toMatch(/nothing was sent and nothing changed/);
      // Never a dead end: both ways out are there.
      expect(screen.getByTestId('invite-refused-email')).toBeTruthy();
      expect(screen.getByTestId('invite-refused-who')).toBeTruthy();
      expect(/available soon/.test(refused.textContent ?? '')).toBe(kind === 'shadow');
      expect(refused.textContent).not.toMatch(/email_in_use/);
      fireEvent.click(screen.getByTestId('invite-refused-email'));
      expect(await screen.findByTestId('who-email')).toBeTruthy();
    } else {
      expect((await screen.findByTestId('invite-person-result')).textContent).toContain(`Invite link ready for ${p.name}.`);
      expect((screen.getByTestId('invite-person-message') as HTMLTextAreaElement).value).toContain(`/invite/${TOKEN}`);
    }
  });
});

describe('the refusal screens (one copy module)', () => {
  const ctx = { firstName: 'Tom', hasLogin: false, shadowSwitchLive: false };
  it('email_in_use before A2: names the old-login switch as available soon, with the reason', () => {
    const s = refusalScreen(new Error('email_in_use'), ctx)!;
    expect(s.reasons.join(' ')).toMatch(/available soon: it needs a server update that is not applied yet/);
  });
  it('email_in_use after A2: no "available soon"', () => {
    const s = refusalScreen(new Error('email_in_use'), { ...ctx, shadowSwitchLive: true })!;
    expect(s.reasons.join(' ')).not.toMatch(/available soon/);
  });
  it('login_has_signed_in: says the login is never switched and what to do', () => {
    const s = refusalScreen(new Error('login_has_signed_in'), ctx)!;
    expect(s.title).toMatch(/already has a login someone uses/);
    expect(s.next).toMatch(/Ask them which email/);
  });
  it('anything else stays a one-line message, never a raw code', () => {
    expect(refusalScreen(new Error('invalid_email'), ctx)).toBeNull();
  });
  it('the A2 probe decides the copy on screen', async () => {
    dup.fetchDuplicates.mockResolvedValue({ kind: 'ok', pairs: [] });
    api.fetchPageTeam.mockResolvedValue(team());
    api.invitePerson.mockImplementation(inUse);
    mount();
    fireEvent.click((await screen.findAllByTestId('who-pick'))[1]);
    // Asked only after a refusal, never on opening the sheet.
    expect(dup.fetchDuplicates).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('who-next'));
    fireEvent.change(screen.getByTestId('who-email-input'), { target: { value: 'x@example.com' } });
    fireEvent.click(screen.getByTestId('who-submit'));
    await screen.findByTestId('invite-refused');
    await waitFor(() => expect(screen.getByTestId('invite-refused').textContent).not.toMatch(/available soon/));
    expect(dup.fetchDuplicates).toHaveBeenCalledTimes(1);
  });
});
