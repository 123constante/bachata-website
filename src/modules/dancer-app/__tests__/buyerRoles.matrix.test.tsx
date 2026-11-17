// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Buyer onboarding slice B (brief docs/briefs/onboard-b-website-worker.md): "What are you?" on
// My tickets, the organiser card, set_my_buyer_roles_v1 through the dancer-app rpc layer.
const flag = vi.hoisted(() => ({ on: true }));
vi.mock('@/lib/buyerOnboardingFlag', () => ({ get BUYER_ONBOARDING_ENABLED() { return flag.on; } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: vi.fn(() => Promise.resolve({ data: null, error: { message: 'should not be called' } })) } }));
const auth = vi.hoisted(() => ({ user: { id: 'u1' } as { id: string } | null }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: auth.user, authStatus: 'ready', retryAuth: () => {} }) }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: unknown }) => children }));
vi.mock('@/lib/seo', () => ({ useSeo: () => undefined }));
const tickets = vi.hoisted(() => ({ fetchMyTickets: vi.fn(), fetchOrderQr: vi.fn() }));
vi.mock('@/modules/tickets/myTicketsApi', () => tickets);

import { setFakeBackend, parseMyDancerEdit, saveMyBuyerRoles, parseBuyerRoles } from '../api/rpc';
import { createFakeBackend, type FakeDancerBackend } from '../api/fakeBackend';
import { makeProfile } from '../api/fixtures';
import { DancerApiError, codeFromMessage, copyFor } from '../api/errors';
import type { BuyerRole, DancerErrorCode, MyDancerEdit } from '../api/types';
import FinishProfileCard, { FINISH_COPY, rolesLine, showOrganiserCard } from '../screens/finish/FinishProfileCard';

afterEach(() => {
  cleanup();
  setFakeBackend(null);
  flag.on = true;
  auth.user = { id: 'u1' };
  vi.resetModules();
});

const fake = (profile: MyDancerEdit | null = makeProfile(), signedIn = true): FakeDancerBackend => {
  const b = createFakeBackend({ profile, signedIn });
  setFakeBackend(b);
  return b;
};
const buyerCalls = (b: FakeDancerBackend) => b.calls.filter((c) => c.fn === 'setMyBuyerRoles');
const renderCard = (p3Live = true) => render(<MemoryRouter><FinishProfileCard p3Live={p3Live} /></MemoryRouter>);

describe('errors: every set_my_buyer_roles_v1 refusal maps through api/errors (one list)', () => {
  const rows: [string, string, DancerErrorCode, string][] = [
    ['42501 signed out', 'not_signed_in', 'not_signed_in', 'You are signed out. Sign in again to carry on.'],
    ['22023 null', 'invalid_roles', 'invalid_roles', 'We could not read your choice. Reload the page and try again.'],
    ['22023 more than 4', 'too_many_roles', 'too_many_roles', 'You can pick up to four.'],
    ['22023 unknown value', 'unknown_role', 'unknown_role', 'Pick from Dancer, Organiser, Teacher or DJ.'],
    ['P0002 no row', 'no_profile', 'no_profile', 'We could not find your dancer profile. Message us and we will sort it out.'],
    ['anon reaches it', 'permission denied for function set_my_buyer_roles_v1', 'not_signed_in', 'You are signed out. Sign in again to carry on.'],
    ['wrapped by PostgREST', 'ERROR: unknown_role (SQLSTATE 22023)', 'unknown_role', 'Pick from Dancer, Organiser, Teacher or DJ.'],
  ];
  it.each(rows)('%s', (_n, message, code, copy) => {
    expect(codeFromMessage(message)).toBe(code);
    expect(copyFor(code)).toBe(copy);
  });
  it('invalid_roles is not the dance-role code, unknown_role is not unknown', () => {
    expect(codeFromMessage('invalid_roles')).not.toBe('invalid_role');
    expect(codeFromMessage('invalid_role')).toBe('invalid_role');
    expect(codeFromMessage('unknown_role')).not.toBe('unknown');
  });
});

describe('read: my_dancer_edit_v1 buyer_roles (resume)', () => {
  const base = { profile_id: 'p1' };
  const rows: [string, unknown, BuyerRole[]][] = [
    ['missing (older server)', undefined, []],
    ['null', null, []],
    ['empty (all 218 prod rows today)', [], []],
    ['one', ['organiser'], ['organiser']],
    ['all four, any order', ['dj', 'teacher', 'organiser', 'dancer'], ['dancer', 'organiser', 'teacher', 'dj']],
    ['duplicate', ['dj', 'dj'], ['dj']],
    ['unknown value dropped', ['dancer', 'singer'], ['dancer']],
    ['not an array', 'dancer', []],
  ];
  it.each(rows)('%s', (_n, raw, want) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseMyDancerEdit({ ...base, buyer_roles: raw }).buyer_roles).toEqual(want);
    expect(parseBuyerRoles(raw)).toEqual(want);
    warn.mockRestore();
  });
});

describe('save: saveMyBuyerRoles through the fake server', () => {
  it('unchanged pick sends no command', async () => {
    const b = fake(makeProfile({ buyer_roles: ['dancer', 'dj'] }));
    await expect(saveMyBuyerRoles(['dj', 'dancer'], ['dancer', 'dj'])).resolves.toEqual(['dancer', 'dj']);
    expect(buyerCalls(b)).toHaveLength(0);
  });
  it('empty pick on an empty record sends no command', async () => {
    const b = fake();
    await expect(saveMyBuyerRoles([], [])).resolves.toEqual([]);
    expect(buyerCalls(b)).toHaveLength(0);
  });
  it('a change sends the stored order and returns what is stored', async () => {
    const b = fake();
    await expect(saveMyBuyerRoles(['dj', 'organiser'], [])).resolves.toEqual(['organiser', 'dj']);
    expect(buyerCalls(b)[0].args).toEqual(['organiser', 'dj']);
    expect(b.current()?.buyer_roles).toEqual(['organiser', 'dj']);
  });
  it('clearing to {} is allowed', async () => {
    const b = fake(makeProfile({ buyer_roles: ['teacher'] }));
    await expect(saveMyBuyerRoles([], ['teacher'])).resolves.toEqual([]);
    expect(buyerCalls(b)[0].args).toEqual([]);
  });
  const errs: [string, () => FakeDancerBackend, unknown, DancerErrorCode][] = [
    ['signed out', () => fake(makeProfile(), false), ['dancer'], 'not_signed_in'],
    ['no profile', () => fake(null), ['dancer'], 'no_profile'],
    ['null', () => fake(), null, 'invalid_roles'],
    ['five', () => fake(), ['dancer', 'organiser', 'teacher', 'dj', 'dj'], 'too_many_roles'],
    ['unknown', () => fake(), ['singer'], 'unknown_role'],
  ];
  it.each(errs)('fake server refuses: %s', async (_n, make, roles, code) => {
    const b = make();
    await expect(b.setMyBuyerRoles(roles as BuyerRole[])).rejects.toMatchObject({ code });
  });
});

describe('card: FinishProfileCard on My tickets (flag ON)', () => {
  it('empty record: asks, nothing ticked, Save disabled with a reason', async () => {
    fake();
    renderCard();
    expect(await screen.findByText(FINISH_COPY.step)).toBeTruthy();
    for (const r of ['dancer', 'organiser', 'teacher', 'dj']) expect(screen.getByTestId(`finish-role-${r}`).getAttribute('aria-pressed')).toBe('false');
    expect((screen.getByTestId('finish-save') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('finish-need-pick').textContent).toBe(FINISH_COPY.needPick);
    expect(screen.queryByTestId('finish-organiser-card')).toBeNull();
  });

  it('skip sends nothing and hides the card for this visit', async () => {
    const b = fake();
    renderCard();
    fireEvent.click(await screen.findByTestId('finish-skip'));
    expect(screen.queryByTestId('finish-profile')).toBeNull();
    expect(buyerCalls(b)).toHaveLength(0);
  });

  it('pick + save: done line, organiser card links to the existing organiser start', async () => {
    const b = fake();
    renderCard(true);
    fireEvent.click(await screen.findByTestId('finish-role-organiser'));
    fireEvent.click(screen.getByTestId('finish-role-dancer'));
    expect(screen.getByTestId('finish-role-organiser').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByTestId('finish-save'));
    await waitFor(() => expect(screen.getByTestId('finish-roles-line').textContent).toContain('Dancer, Organiser'));
    expect(buyerCalls(b)[0].args).toEqual(['dancer', 'organiser']);
    expect(screen.getByTestId('finish-organiser-link').getAttribute('href')).toBe('/account/p3/start');
    expect(screen.getByText(FINISH_COPY.organiserTitle)).toBeTruthy();
  });

  it('organiser start follows the P3 switch (R1 organiser home when P3 is off)', async () => {
    fake(makeProfile({ buyer_roles: ['organiser'] }));
    renderCard(false);
    expect((await screen.findByTestId('finish-organiser-link')).getAttribute('href')).toBe('/account/o');
  });

  it('resume: saved roles show as done; Change pre-ticks them; unchanged Save sends nothing', async () => {
    const b = fake(makeProfile({ buyer_roles: ['teacher', 'dj'] }));
    renderCard();
    expect((await screen.findByTestId('finish-roles-line')).textContent).toContain('Teacher, DJ');
    expect(screen.queryByTestId('finish-organiser-card')).toBeNull();
    fireEvent.click(screen.getByTestId('finish-change'));
    expect(screen.getByTestId('finish-role-teacher').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('finish-role-dj').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('finish-role-dancer').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('finish-skip').textContent).toBe('Cancel');
    fireEvent.click(screen.getByTestId('finish-save'));
    await waitFor(() => expect(screen.getByTestId('finish-profile-card').getAttribute('data-view')).toBe('done'));
    expect(buyerCalls(b)).toHaveLength(0);
  });

  it('a person who already organises gets no organiser card', async () => {
    fake(makeProfile({ buyer_roles: ['organiser'], other_roles: ['organising'] }));
    renderCard();
    await screen.findByTestId('finish-roles-line');
    expect(screen.queryByTestId('finish-organiser-card')).toBeNull();
  });

  it('a failed profile read hides the card (My tickets still works)', async () => {
    const b = fake();
    b.failNextWith('unknown');
    renderCard();
    await waitFor(() => expect(b.calls.length).toBeGreaterThan(0));
    expect(screen.queryByTestId('finish-profile')).toBeNull();
  });

  const codes: DancerErrorCode[] = ['not_signed_in', 'invalid_roles', 'too_many_roles', 'unknown_role', 'no_profile', 'rate_limited', 'unknown'];
  it.each(codes)('save refused with %s: the api/errors copy, picks kept, no done view', async (code) => {
    const b = fake();
    renderCard();
    fireEvent.click(await screen.findByTestId('finish-role-dj'));
    b.failNextWith(code);
    fireEvent.click(screen.getByTestId('finish-save'));
    expect((await screen.findByTestId('finish-error')).textContent).toBe(new DancerApiError(code).message);
    expect(screen.getByTestId('finish-role-dj').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('finish-profile-card').getAttribute('data-view')).toBe('ask');
  });

  it('model: rolesLine order, showOrganiserCard rule', () => {
    expect(rolesLine(['dj', 'dancer'])).toBe('Dancer, DJ');
    expect(showOrganiserCard({ buyer_roles: [], other_roles: [] })).toBe(false);
    expect(showOrganiserCard({ buyer_roles: ['organiser'], other_roles: ['teaching'] })).toBe(true);
  });
});

describe('My tickets page: flag on / off', () => {
  const ok = { kind: 'ok', reply: { tickets: [], truncated: false } };
  const load = async (on: boolean) => {
    flag.on = on;
    tickets.fetchMyTickets.mockResolvedValue(ok);
    const { default: Page } = await import('@/modules/tickets/MyTicketsPage');
    const rpc = await import('../api/rpc');
    const { createFakeBackend: mk } = await import('../api/fakeBackend');
    const b = mk({ profile: makeProfile() });
    rpc.setFakeBackend(b);
    render(<MemoryRouter><Page /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('my-tickets').getAttribute('data-state')).toBe('empty'));
    return b;
  };
  it('flag OFF: no card, no profile read (render as today)', async () => {
    const b = await load(false);
    expect(screen.queryByTestId('finish-profile')).toBeNull();
    expect(b.calls).toHaveLength(0);
  });
  it('flag ON: the card shows on an empty My tickets', async () => {
    await load(true);
    expect(await screen.findByTestId('finish-profile-card')).toBeTruthy();
  });
  it('flag OFF: MyTicketsView markup is unchanged by the new prop', async () => {
    flag.on = false;
    const { MyTicketsView } = await import('@/modules/tickets/MyTicketsPage');
    const a = render(<MemoryRouter><MyTicketsView result={ok as never} authReady="signed_in" onRetry={() => {}} today="2026-11-17" /></MemoryRouter>).container.innerHTML;
    cleanup();
    const c = render(<MemoryRouter><MyTicketsView result={ok as never} authReady="signed_in" onRetry={() => {}} today="2026-11-17" profileCard={undefined} /></MemoryRouter>).container.innerHTML;
    expect(c).toBe(a);
    expect(a).not.toContain('finish-profile');
  });
});
