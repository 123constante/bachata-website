// @vitest-environment jsdom
/**
 * The team picker (mockup "Team sheet", screens 3 and 4) end to end through the
 * owner layer: viewer role {owner, admin, manager, contributor, read refused} x
 * team shape, and the sheet's search (debounced, stale answers ignored), pick
 * (chip, keyboard closed), Done (one add per chip; the server's refusal in plain
 * words; an admin must give a reason), already-added rows marked and not
 * addable, and the invite fallback. The add RPC here is a mock: nothing reaches
 * any database.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ProfileEntity } from '@/modules/organiser/profile/profileForm';
import type { TeamMember, TeamRole } from '@/modules/organiser/shared/teamModel';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn() } }));

import EditInPlaceLayer from '../EditInPlaceLayer';
import type { EipBridge } from '../bridge';
import { PICKER_COPY } from '../teamPickerModel';

const ID = '22222222-2222-4222-8222-222222222222';
const ENTITY = {
  id: ID, name: 'Ritmo Latino', avatar_url: null, bio: 'Hi', socials: {}, city_id: '11111111-1111-4111-8111-111111111111',
  instagram: null, website: null, organisation_category: null, founded_year: null, cities: { name: 'London', slug: 'london-gb' },
} as ProfileEntity;

const member = (userId: string, role: TeamRole, isSelf = false): TeamMember => ({ userId, role, isPrimary: role === 'owner', joinedAt: null, isSelf, email: null, displayName: null });

const ROWS = [
  { profile_id: 'p-ana', display_name: 'Ana Ruiz', photo_url: 'https://cdn.example/ana.jpg', city_name: 'London' },
  { profile_id: 'p-jose', display_name: 'José Ñúñez', photo_url: null, city_name: 'Málaga' },
  { profile_id: 'p-mar', display_name: 'Marta Lopez', photo_url: null, city_name: null },
];

type Team = { myRole: TeamRole | 'admin' | null; members: TeamMember[] };

function setup(opts: {
  team: Team | Error;
  search?: (term: string) => Promise<unknown>;
  add?: (organiserId: string, profileId: string, role: string, reason: string | null) => Promise<unknown>;
}) {
  const search = vi.fn(opts.search ?? (async () => ROWS));
  const add = vi.fn(opts.add ?? (async (_o: string, pid: string, role: string) => ({ changed: true, member_role: role, profile_id: pid })));
  const fetchTeam = vi.fn(async () => { if (opts.team instanceof Error) throw opts.team; return opts.team; });
  function Harness() {
    const [eip, setEip] = useState<EipBridge | null>(null);
    return (
      <div>
        <div data-testid="team-slot">{eip?.slot('team')}</div>
        <EditInPlaceLayer
          organiserId={ID}
          entity={ENTITY}
          onBridge={setEip}
          client={{ rpc: vi.fn() } as never}
          fetchContact={async () => ({ contact_phone: null, contact_email: null, show_phone_publicly: false, show_email_publicly: false, claim_email: null }) as never}
          fetchTeam={fetchTeam}
          searchPeople={(_o, term) => search(term)}
          addPerson={add}
        />
      </div>
    );
  }
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '/o', element: <Harness /> }], { initialEntries: ['/o'] });
  render(<QueryClientProvider client={qc}><RouterProvider router={router} /></QueryClientProvider>);
  return { search, add, fetchTeam };
}

afterEach(() => { cleanup(); vi.useRealTimers(); });

const openSheet = async () => {
  fireEvent.click(await screen.findByRole('button', { name: PICKER_COPY.title }));
  return screen.findByRole('dialog', { name: PICKER_COPY.title });
};
const type = (dialog: HTMLElement, v: string) => fireEvent.change(within(dialog).getByRole('searchbox'), { target: { value: v } });
const text = (el: Element | null) => el?.textContent ?? '';
const has = (el: Element | null, want: string | RegExp) => (typeof want === 'string' ? expect(text(el)).toContain(want) : expect(text(el)).toMatch(want));
const results = (dialog: HTMLElement) => within(dialog).queryAllByTestId('eip-team-result');

describe('who sees the Team card and its picker: roles x team shapes', () => {
  const OWNER_ONLY = [member('u1', 'owner', true)];
  const TWO_OWNERS = [member('u1', 'owner', true), member('u2', 'owner')];
  const MIXED = [member('u1', 'owner'), member('u2', 'manager', true), member('u3', 'contributor')];
  const CASES: Array<[string, Team | Error, string | null]> = [
    ['owner, sole member (3 organisers on prod)', { myRole: 'owner', members: OWNER_ONLY }, 'On the team: 1 owner.'],
    ['owner, two owners (1 organiser on prod)', { myRole: 'owner', members: TWO_OWNERS }, 'On the team: 2 owners.'],
    ['admin, organiser with no member yet (41 on prod)', { myRole: 'admin', members: [] }, 'No one is on the team yet. Add a person to share the work.'],
    ['admin who is also a manager (the server answers admin)', { myRole: 'admin', members: MIXED }, 'On the team: 1 owner, 1 manager, 1 contributor.'],
    ['manager', { myRole: 'manager', members: MIXED }, null],
    ['contributor', { myRole: 'contributor', members: [member('u1', 'owner'), member('u3', 'contributor', true)] }, null],
    ['team read refused', new Error('not_authorised'), null],
  ];
  it.each(CASES)('%s', async (_n, team, line) => {
    const { fetchTeam, search } = setup({ team });
    await waitFor(() => expect(fetchTeam).toHaveBeenCalled());
    if (line) {
      has(await screen.findByTestId('eip-team-count'), line);
      expect(screen.getByRole('button', { name: PICKER_COPY.title })).toBeTruthy();
    } else {
      await new Promise((r) => setTimeout(r, 30));
      expect(screen.queryByTestId('eip-team')).toBeNull();
      expect(screen.queryByRole('button', { name: PICKER_COPY.title })).toBeNull();
    }
    expect(search).not.toHaveBeenCalled();
  });
});

describe('the sheet: search at the top, debounced, stale answers ignored', () => {
  it('opens with focus in the search box (the first thing in the sheet after its title) and says what to type', async () => {
    setup({ team: { myRole: 'owner', members: [member('u1', 'owner', true)] } });
    const dialog = await openSheet();
    const box = within(dialog).getByRole('searchbox', { name: PICKER_COPY.searchLabel });
    expect(document.activeElement).toBe(box);
    const order = Array.from(dialog.querySelectorAll('input, [data-testid="eip-team-results"], [data-testid="eip-team-invite"], button'));
    expect(order.indexOf(box)).toBeLessThan(order.indexOf(within(dialog).getByTestId('eip-team-results')));
    has(within(dialog).getByTestId('eip-team-message'), PICKER_COPY.idle);
    expect(within(dialog).getByRole('button', { name: PICKER_COPY.inviteLink })).toBeTruthy();
  });

  it('one letter asks nothing; two letters ask once, about 250ms after the last key', async () => {
    const { search } = setup({ team: { myRole: 'owner', members: [] } });
    const dialog = await openSheet();
    vi.useFakeTimers();
    type(dialog, 'm');
    await act(async () => { vi.advanceTimersByTime(400); });
    expect(search).not.toHaveBeenCalled();
    type(dialog, 'ma');
    await act(async () => { vi.advanceTimersByTime(100); });
    type(dialog, 'mar');
    await act(async () => { vi.advanceTimersByTime(200); });
    expect(search).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(60); });
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('mar');
  });

  it('a slow answer for an older query never replaces the newer one', async () => {
    let releaseOld: (v: unknown) => void = () => {};
    const search = async (term: string) => (term === 'ma'
      ? new Promise((r) => { releaseOld = r; })
      : [ROWS[2]]);
    setup({ team: { myRole: 'owner', members: [] }, search });
    const dialog = await openSheet();
    type(dialog, 'ma');
    await new Promise((r) => setTimeout(r, 300));
    type(dialog, 'mar');
    await waitFor(() => expect(results(dialog)).toHaveLength(1));
    await act(async () => { releaseOld([ROWS[0], ROWS[1]]); });
    await new Promise((r) => setTimeout(r, 20));
    expect(results(dialog)).toHaveLength(1);
    expect((results(dialog)[0]).getAttribute('aria-label')).toBe('Pick Marta Lopez');
  });

  it('each row: photo or initials, name, city (or "City not added"), and it is a >= 44px-target button', async () => {
    setup({ team: { myRole: 'owner', members: [] } });
    const dialog = await openSheet();
    type(dialog, 'an');
    await waitFor(() => expect(results(dialog)).toHaveLength(3));
    const [ana, jose, marta] = results(dialog);
    expect(ana.querySelector('img')?.getAttribute('src')).toBe('https://cdn.example/ana.jpg');
    expect(jose.querySelector('img')).toBeNull();
    has(jose, 'JÑ');
    has(jose, 'Málaga');
    has(marta, 'City not added');
    for (const r of results(dialog)) expect(parseInt(r.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
    const list = within(dialog).getByTestId('eip-team-results');
    expect(list.style.overflowY).toBe('auto');
    expect(parseInt(list.style.maxHeight, 10)).toBeLessThanOrEqual(48 * 3 + 24);
  });

  it.each([
    ['no match', async () => [], /No one called “zz” can be added yet/],
    ['search fails', async () => { throw new Error('Failed to fetch'); }, /The search did not work/],
  ])('%s: the list says what to do next', async (_n, search, want) => {
    setup({ team: { myRole: 'owner', members: [] }, search });
    const dialog = await openSheet();
    type(dialog, 'zz');
    await waitFor(() => has(within(dialog).getByTestId('eip-team-message'), want));
  });
});

describe('pick, then Done', () => {
  it('a tap picks a chip, closes the keyboard (the box loses focus), and Done adds them once', async () => {
    const { add } = setup({ team: { myRole: 'owner', members: [member('u1', 'owner', true)] } });
    const dialog = await openSheet();
    type(dialog, 'an');
    await waitFor(() => expect(results(dialog)).toHaveLength(3));
    fireEvent.click(results(dialog)[1]);
    expect(document.activeElement).not.toBe(within(dialog).getByRole('searchbox'));
    expect(within(dialog).getAllByTestId('eip-team-chip').map((c) => c.textContent)).toEqual(['José Ñúñez']);
    expect((results(dialog)[1]).getAttribute('data-state')).toBe('picked');
    has(within(dialog).getByTestId('eip-team-will-add'), 'Done adds José Ñúñez as a manager.');
    // A second tap on the same row adds no second chip.
    fireEvent.click(results(dialog)[1]);
    expect(within(dialog).getAllByTestId('eip-team-chip')).toHaveLength(1);
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Contributor' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: PICKER_COPY.title })).toBeNull());
    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith(ID, 'p-jose', 'contributor', null);
    has(await screen.findByTestId('eip-notice'), 'José Ñúñez is now a contributor.');
  });

  it('Done with nothing picked sends no command and closes', async () => {
    const { add } = setup({ team: { myRole: 'owner', members: [] } });
    const dialog = await openSheet();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: PICKER_COPY.title })).toBeNull());
    expect(add).not.toHaveBeenCalled();
  });

  it('a refusal keeps the chip with the server reason in plain words; the others are added and then marked, not addable', async () => {
    const add = async (_o: string, pid: string, role: string) => {
      if (pid === 'p-mar') throw { message: 'unconfirmed_email', code: 'P0001' };
      return { changed: true, member_role: role, profile_id: pid };
    };
    const spy = vi.fn(add);
    setup({ team: { myRole: 'owner', members: [] }, add: spy });
    const dialog = await openSheet();
    type(dialog, 'an');
    await waitFor(() => expect(results(dialog)).toHaveLength(3));
    fireEvent.click(results(dialog)[0]);
    fireEvent.click(results(dialog)[2]);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() => has(within(dialog).getByTestId('eip-team-refusal'), 'Marta Lopez: This person has not confirmed their email address yet'));
    expect(text(within(dialog).getByTestId('eip-team-refusal'))).not.toContain('unconfirmed_email');
    expect(within(dialog).getAllByTestId('eip-team-chip').map((c) => c.textContent)).toEqual(['Marta Lopez']);
    const ana = results(dialog)[0];
    expect((ana).getAttribute('data-state')).toBe('member');
    expect((ana).getAttribute('aria-disabled')).toBe('true');
    expect((ana).getAttribute('aria-label')).toBe('Ana Ruiz, London: already on the team');
    fireEvent.click(ana);
    expect(within(dialog).getAllByTestId('eip-team-chip')).toHaveLength(1);
    expect(spy).toHaveBeenCalledTimes(2);
    has(screen.getByTestId('eip-notice'), 'Ana Ruiz is now a manager.');
  });

  it('a dropped connection says so; the chip stays for another try', async () => {
    setup({ team: { myRole: 'owner', members: [] }, add: async () => { throw new TypeError('Failed to fetch'); } });
    const dialog = await openSheet();
    type(dialog, 'an');
    await waitFor(() => expect(results(dialog)).toHaveLength(3));
    fireEvent.click(results(dialog)[0]);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() => has(within(dialog).getByTestId('eip-team-refusal'), PICKER_COPY.network));
    expect(within(dialog).getAllByTestId('eip-team-chip')).toHaveLength(1);
  });

  it('an admin: Done is disabled WITH its reason until a reason is written, which is then sent', async () => {
    const { add } = setup({ team: { myRole: 'admin', members: [] } });
    const dialog = await openSheet();
    type(dialog, 'an');
    await waitFor(() => expect(results(dialog)).toHaveLength(3));
    fireEvent.click(results(dialog)[0]);
    const done = within(dialog).getByRole('button', { name: 'Done' });
    expect(((done) as HTMLButtonElement).disabled).toBe(true);
    has(within(dialog).getByTestId('eip-team-blocked'), 'Write a reason first.');
    expect((done).getAttribute('aria-describedby')).toBe(within(dialog).getByTestId('eip-team-blocked').id);
    fireEvent.change(within(dialog).getByLabelText(PICKER_COPY.reasonLabel), { target: { value: '  Owner asked by phone  ' } });
    expect(((done) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(done);
    await waitFor(() => expect(add).toHaveBeenCalledWith(ID, 'p-ana', 'manager', 'Owner asked by phone'));
  });

  it('an owner gets no reason box', async () => {
    setup({ team: { myRole: 'owner', members: [] } });
    const dialog = await openSheet();
    expect(within(dialog).queryByLabelText(PICKER_COPY.reasonLabel)).toBeNull();
  });

  it('unpicking a chip removes it; Escape closes the sheet', async () => {
    const { add } = setup({ team: { myRole: 'owner', members: [] } });
    const dialog = await openSheet();
    type(dialog, 'an');
    await waitFor(() => expect(results(dialog)).toHaveLength(3));
    fireEvent.click(results(dialog)[0]);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Unpick Ana Ruiz' }));
    expect(within(dialog).queryAllByTestId('eip-team-chip')).toHaveLength(0);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: PICKER_COPY.title })).toBeNull());
    expect(add).not.toHaveBeenCalled();
  });
});

describe('the invite fallback', () => {
  it('copies a sign-up link when the phone cannot share, and says what happens next', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    setup({ team: { myRole: 'owner', members: [] } });
    const dialog = await openSheet();
    fireEvent.click(within(dialog).getByRole('button', { name: PICKER_COPY.inviteLink }));
    await waitFor(() => has(within(dialog).getByTestId('eip-team-invite-note'), PICKER_COPY.inviteCopied));
    expect(writeText.mock.calls[0][0]).toMatch(/Ritmo Latino team\. http.*\/auth\?mode=signup$/);
  });
});
