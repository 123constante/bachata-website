// @vitest-environment jsdom
/**
 * Buyer onboarding slice B (brief docs/briefs/onboard-b-slice-b.md): the "What are you?" save
 * (set_my_buyer_roles_v1), its errors through the ONE copy list, the sheet's role step, the
 * organiser link card, and the privacy rule. Prod shapes 2026-11-17: 218 dancer_profiles, all
 * buyer_roles = '{}' (none answered yet), so [] is the shape every person starts from.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const flag = vi.hoisted(() => ({ on: true }));
vi.mock('@/lib/buyerOnboardingFlag', () => ({
  get BUYER_ONBOARDING_ENABLED() {
    return flag.on;
  },
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

import { codeFromMessage, copyFor, toDancerError } from '../api/errors';
import { createFakeBackend, type FakeDancerBackend } from '../api/fakeBackend';
import { DANCER_SHAPES } from '../api/fixtures';
import { parseBuyerRoles, parseMyDancerEdit, parsePublicExtras, saveMyBuyerRoles, setFakeBackend } from '../api/rpc';
import type { BuyerRole, MyDancerEdit } from '../api/types';
import { ProfileSheetProvider, useProfileSheet } from '../shell/profileSheet';
import { ORGANISER_CARD, showOrganiserCard } from '../screens/tickets/TicketsScreen';

afterEach(() => {
  cleanup();
  setFakeBackend(null);
  flag.on = true;
});

const base = DANCER_SHAPES.fourFieldComplete.profile as MyDancerEdit;
const withRoles = (buyer_roles: BuyerRole[], extra: Partial<MyDancerEdit> = {}): MyDancerEdit => ({ ...base, buyer_roles, ...extra });

describe('errors: every set_my_buyer_roles_v1 refusal maps to the one copy list', () => {
  const ROWS: Array<[string, string, string]> = [
    ['invalid_roles', 'invalid_roles', 'Your answer could not be read. Reload the page and try again.'],
    ['too_many_roles', 'too_many_roles', 'Pick up to four: Dancer, Organiser, Teacher or DJ.'],
    ['unknown_role', 'unknown_role', 'Pick from Dancer, Organiser, Teacher or DJ.'],
    ['not_signed_in', 'not_signed_in', copyFor('not_signed_in')],
    ['no_profile', 'no_profile', copyFor('no_profile')],
    ['permission denied for function set_my_buyer_roles_v1', 'not_signed_in', copyFor('not_signed_in')],
    ['Failed to fetch', 'unknown', copyFor('unknown')],
  ];
  it.each(ROWS)('%s -> %s', (message, code, copy) => {
    expect(codeFromMessage(message)).toBe(code);
    expect(toDancerError(new Error(message)).message).toBe(copy);
  });
  it('invalid_role (dance role) is not swallowed by invalid_roles, and back', () => {
    expect(codeFromMessage('invalid_role')).toBe('invalid_role');
    expect(codeFromMessage('ERROR: invalid_roles')).toBe('invalid_roles');
  });
});

describe('parse: buyer_roles from my_dancer_edit_v1', () => {
  const raw = (buyer_roles: unknown) => ({ profile_id: 'p1', buyer_roles });
  it.each<[string, unknown, BuyerRole[]]>([
    ['prod default {}', [], []],
    ['missing key', undefined, []],
    ['null', null, []],
    ['server order kept', ['dj', 'dancer'], ['dancer', 'dj']],
    ['unknown value dropped', ['dancer', 'videographer'], ['dancer']],
    ['all four', ['dancer', 'organiser', 'teacher', 'dj'], ['dancer', 'organiser', 'teacher', 'dj']],
  ])('%s', (_n, v, out) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseMyDancerEdit(raw(v)).buyer_roles).toEqual(out);
    expect(parseBuyerRoles(v)).toEqual(out);
  });
});

describe('saveMyBuyerRoles matrix', () => {
  type Row = { name: string; had: BuyerRole[]; pick: BuyerRole[]; sent: string[] | null; stored: BuyerRole[] };
  const ROWS: Row[] = [
    { name: 'skip-shaped: nothing picked, nothing saved before -> no command', had: [], pick: [], sent: null, stored: [] },
    { name: 'first answer, one role', had: [], pick: ['organiser'], sent: ['organiser'], stored: ['organiser'] },
    { name: 'multi-pick, sent in server order', had: [], pick: ['dj', 'dancer', 'teacher'], sent: ['dancer', 'teacher', 'dj'], stored: ['dancer', 'teacher', 'dj'] },
    { name: 'resumed, same set in another order -> no command', had: ['dancer', 'dj'], pick: ['dj', 'dancer'], sent: null, stored: ['dancer', 'dj'] },
    { name: 'resumed, one added', had: ['dancer'], pick: ['dancer', 'organiser'], sent: ['dancer', 'organiser'], stored: ['dancer', 'organiser'] },
    { name: 'resumed, all cleared -> [] is sent (allowed)', had: ['teacher'], pick: [], sent: [], stored: [] },
  ];
  it.each(ROWS)('$name', async (r) => {
    const fake = createFakeBackend({ profile: withRoles(r.had) });
    setFakeBackend(fake);
    const next = await saveMyBuyerRoles(r.pick, withRoles(r.had));
    const calls = fake.calls.filter((c) => c.fn === 'setMyBuyerRoles');
    if (r.sent === null) expect(calls).toHaveLength(0);
    else expect(calls.map((c) => c.args)).toEqual([r.sent]);
    expect(next.buyer_roles).toEqual(r.stored);
  });
  it.each<[string, Parameters<typeof createFakeBackend>[0], string]>([
    ['signed out', { shape: 'unconfirmedAccount' }, 'not_signed_in'],
    ['no persona', { shape: 'authUserNoPersona' }, 'no_profile'],
  ])('%s -> %s', async (_n, opts, code) => {
    setFakeBackend(createFakeBackend(opts));
    await expect(saveMyBuyerRoles(['dancer'], withRoles([]))).rejects.toMatchObject({ code });
  });
  it('an unknown role from a stale client is refused by the server, never stored', async () => {
    const fake = createFakeBackend({ profile: withRoles([]) });
    setFakeBackend(fake);
    await expect(saveMyBuyerRoles(['venue' as BuyerRole], withRoles([]))).resolves.toMatchObject({ buyer_roles: [] });
    await expect(fake.setMyBuyerRoles(['venue'])).rejects.toMatchObject({ code: 'unknown_role' });
    expect(fake.current()?.buyer_roles).toEqual([]);
  });
});

function Opener() {
  const s = useProfileSheet();
  return (
    <button type="button" onClick={s.open} data-testid="open">
      open
    </button>
  );
}

const mountSheet = (person: MyDancerEdit | null, viewOnly = false) => {
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ProfileSheetProvider incomplete viewOnly={viewOnly} person={person}>
          <Opener />
        </ProfileSheetProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByTestId('open'));
  return qc;
};

const chipIds = () => screen.queryAllByTestId(/^profile-chip-/).map((e) => e.getAttribute('data-testid')!.replace('profile-chip-', ''));
const pressed = () => screen.queryAllByTestId(/^role-pick-/).filter((e) => e.getAttribute('aria-pressed') === 'true').map((e) => e.getAttribute('data-testid')!.replace('role-pick-', ''));

describe('the "What are you?" sheet', () => {
  type Row = { name: string; flagOn: boolean; person: MyDancerEdit | null; viewOnly?: boolean; roleStep: boolean; pressed?: string[] };
  const ROWS: Row[] = [
    { name: 'flag OFF: the old link sheet, unchanged', flagOn: false, person: withRoles([]), roleStep: false },
    { name: 'flag ON, no person read yet / no profile: old link sheet', flagOn: true, person: null, roleStep: false },
    { name: 'flag ON, view-only: old link sheet (nothing to save to)', flagOn: true, person: withRoles([]), viewOnly: true, roleStep: false },
    { name: 'flag ON, prod default []: role step, nothing pressed', flagOn: true, person: withRoles([]), roleStep: true, pressed: [] },
    { name: 'flag ON, resumed: saved roles pressed', flagOn: true, person: withRoles(['organiser', 'dj']), roleStep: true, pressed: ['organiser', 'dj'] },
  ];
  it.each(ROWS)('$name', (r) => {
    flag.on = r.flagOn;
    mountSheet(r.person, r.viewOnly);
    if (r.roleStep) {
      expect(screen.getAllByTestId(/^role-pick-/)).toHaveLength(4);
      expect(screen.getAllByTestId(/^role-pick-/).map((e) => e.textContent)).toEqual(['Dancer', 'Organiser', 'Teacher', 'DJ']);
      expect(pressed()).toEqual(r.pressed);
      expect(chipIds()).toEqual([]);
      expect(screen.getByTestId('role-step-save').textContent).toBe('Save');
      expect(screen.getByTestId('role-step-skip').textContent).toBe('Skip');
    } else {
      expect(screen.queryByTestId('role-step-save')).toBeNull();
      expect(chipIds()).toEqual(['dancer', 'dj', 'teacher', 'organiser', 'videographer', 'venue']);
    }
  });

  it('Skip sends nothing and shows every link', async () => {
    const fake = createFakeBackend({ profile: withRoles([]) });
    setFakeBackend(fake);
    mountSheet(withRoles([]));
    fireEvent.click(screen.getByTestId('role-pick-dj'));
    fireEvent.click(screen.getByTestId('role-step-skip'));
    expect(fake.calls.filter((c) => c.fn === 'setMyBuyerRoles')).toHaveLength(0);
    expect(chipIds()).toHaveLength(6);
  });

  it('Save sends the picks, writes the cache, and narrows the links to what was picked', async () => {
    const fake = createFakeBackend({ profile: withRoles([]) });
    setFakeBackend(fake);
    const qc = mountSheet(withRoles([]));
    fireEvent.click(screen.getByTestId('role-pick-organiser'));
    fireEvent.click(screen.getByTestId('role-pick-dancer'));
    fireEvent.click(screen.getByTestId('role-pick-dancer'));
    fireEvent.click(screen.getByTestId('role-pick-teacher'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('role-step-save'));
    });
    expect(fake.calls.filter((c) => c.fn === 'setMyBuyerRoles').map((c) => c.args)).toEqual([['organiser', 'teacher']]);
    expect(chipIds()).toEqual(['teacher', 'organiser']);
    expect(qc.getQueryData<MyDancerEdit>(['my-dancer-edit', 'u1'])?.buyer_roles).toEqual(['organiser', 'teacher']);
  });

  it('a failed save stays on the step with the copy-list message, picks kept', async () => {
    const fake = createFakeBackend({ profile: withRoles([]) });
    fake.failNextWith('rate_limited');
    setFakeBackend(fake);
    mountSheet(withRoles([]));
    fireEvent.click(screen.getByTestId('role-pick-dj'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('role-step-save'));
    });
    expect(screen.getByTestId('role-step-error').textContent).toBe(copyFor('rate_limited'));
    expect(pressed()).toEqual(['dj']);
    expect((screen.getByTestId('role-step-save') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('organiser card', () => {
  it.each<[string, { buyer_roles: string[]; other_roles: string[] } | null, boolean]>([
    ['flag OFF / view-only (no person)', null, false],
    ['prod default []', { buyer_roles: [], other_roles: [] }, false],
    ['picked Dancer only', { buyer_roles: ['dancer'], other_roles: [] }, false],
    ['picked Organiser, no organiser page', { buyer_roles: ['organiser'], other_roles: [] }, true],
    ['picked Organiser + DJ', { buyer_roles: ['organiser', 'dj'], other_roles: ['teaching'] }, true],
    ['picked Organiser, already organising', { buyer_roles: ['organiser'], other_roles: ['organising'] }, false],
  ])('%s -> %s', (_n, person, show) => {
    expect(showOrganiserCard(person)).toBe(show);
  });
  it('copy', () => expect(ORGANISER_CARD).toBe('Set up your organiser page'));
});

describe('private: roles never reach a public read', () => {
  it('public extras drop buyer_roles even if a server sent it', () => {
    expect(parsePublicExtras({ bio: null, languages: [], whatsapp: null, buyer_roles: ['dj'] })).not.toHaveProperty('buyer_roles');
  });
  it('no public-page source reads buyer_roles', () => {
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
    const root = join(process.cwd(), 'src/modules/dancer-app/public-page');
    const hits = walk(root).filter((f) => !f.includes('__tests__') && /buyer_roles|buyerRoles/.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });
});
