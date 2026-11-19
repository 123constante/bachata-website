// @vitest-environment jsdom
/**
 * Dashboard switch, Round-4 (flag dashboardSwitchR4, docs/briefs/dashboard-switch-build.md):
 *  - Teacher / DJ "Coming soon" rows show ONLY for a role picked at onboarding (my_role_intent_v1),
 *    never for a role merely held, never for a declined one (owner 2026-11-19).
 *  - The top-right button reads "Switch" even with ONE profile; the sheet then holds that profile
 *    and "+ Add a profile" (both areas). Sign out is not in the sheet.
 *  - Flag off: the classic sheet ("Account" with one profile), unchanged.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { profileSides, type SidesFacts } from '@/lib/accountRouting';
import type { RoleIntent } from '@/modules/areas/home/rolesApi';
import { comingSoonRoles, pickedAtOnboarding } from '../switchR4Model';

const sides = vi.hoisted(() => ({ facts: null as unknown as SidesFacts }));
const world = vi.hoisted(() => ({ flag: true, intent: { roles: [], declined: [] } as RoleIntent }));

vi.mock('@/lib/featureFlags', async (orig) => {
  const m = await orig<typeof import('@/lib/featureFlags')>();
  return { ...m, flags: new Proxy(m.flags, { get: (t, k) => (k === 'dashboardSwitchR4' ? world.flag : t[k as keyof typeof t]) }) };
});
vi.mock('../useProfileSides', () => ({
  useProfileSides: () => ({ facts: sides.facts, state: profileSides(sides.facts), openRequestCount: 0 }),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me' }, signOut: async () => 'signed-out' }) }));
vi.mock('@/modules/areas/home/rolesApi', async (orig) => {
  const m = await orig<typeof import('@/modules/areas/home/rolesApi')>();
  return { ...m, fetchMyRoleIntent: async () => world.intent, fetchMyRoles: async () => [] };
});

import { ProfileSwitcher } from '../ProfileSwitcher';

const ORG = { id: 'o1', name: 'Ritmo London', role: 'owner', avatar_url: null, lifecycle_status: 'live' } as never;

const mount = (area: 'dancer' | 'organiser', withClient = true) => {
  const where = area === 'dancer' ? ({ area: 'dancer' } as const) : ({ area: 'organiser', organiserId: null } as const);
  const ui = <MemoryRouter><ProfileSwitcher where={where} /></MemoryRouter>;
  return render(withClient ? <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider> : ui);
};

beforeEach(() => {
  world.flag = true;
  world.intent = { roles: [], declined: [] };
  sides.facts = { organisers: [], dancer: 'complete', areaAllowed: true, dancerFace: { firstName: 'Ana', avatarUrl: null } };
});
afterEach(cleanup);

describe('Teacher / DJ rule: picked at onboarding only', () => {
  const cases: Array<[string, RoleIntent | undefined, string[]]> = [
    ['no intent read yet', undefined, []],
    ['nothing picked (held roles are not in the intent)', { roles: ['dancer'], declined: [] }, []],
    ['teacher picked', { roles: ['dancer', 'teacher'], declined: [] }, ['teacher']],
    ['dj picked', { roles: ['dj'], declined: [] }, ['dj']],
    ['both picked, fixed order', { roles: ['dj', 'teacher'], declined: [] }, ['teacher', 'dj']],
    ['dj picked then declined', { roles: ['dj', 'teacher'], declined: ['dj'] }, ['teacher']],
    ['organiser picked only', { roles: ['organiser'], declined: [] }, []],
  ];
  it.each(cases)('%s', (_name, intent, want) => {
    expect(comingSoonRoles(intent)).toEqual(want);
    expect(pickedAtOnboarding('teacher', intent)).toBe(want.includes('teacher'));
  });

  it('the sheet shows a grey, non-link Coming soon row for a picked role', async () => {
    world.intent = { roles: ['teacher'], declined: [] };
    mount('dancer');
    fireEvent.click(screen.getByTestId('profile-switcher-button'));
    const row = await screen.findByTestId('profile-switcher-soon-teacher');
    expect(row.getAttribute('aria-disabled')).toBe('true');
    expect(row.closest('a')).toBeNull();
    expect(row.textContent).toMatch(/Coming soon/);
    expect(screen.queryByTestId('profile-switcher-soon-dj')).toBeNull();
  });

  it('no Coming soon card when nothing was picked', async () => {
    mount('dancer');
    fireEvent.click(screen.getByTestId('profile-switcher-button'));
    await screen.findByTestId('profile-switcher-your-areas');
    expect(screen.queryByTestId('profile-switcher-soon')).toBeNull();
  });
});

describe('Switch button with ONE profile', () => {
  it.each(['dancer', 'organiser'] as const)('%s area: Switch, sheet = the one profile + Add a profile, no Sign out', async (area) => {
    if (area === 'organiser') sides.facts = { organisers: [ORG], dancer: 'none', areaAllowed: false, dancerFace: null } as SidesFacts;
    mount(area);
    const btn = screen.getByTestId('profile-switcher-button');
    expect(btn.getAttribute('aria-label')).toBe('Switch profile');
    if (area === 'dancer') expect(screen.getByTestId('profile-switcher-label').textContent).toBe('Switch');
    fireEvent.click(btn);
    const sheet = screen.getByTestId('profile-switcher-sheet');
    expect(sheet.getAttribute('data-look')).toBe('r4');
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Switch profile');
    expect(sheet.querySelectorAll('[data-testid^="profile-switcher-side-"]')).toHaveLength(1);
    expect(screen.getByTestId('profile-switcher-showing').textContent).toBe('Showing');
    expect(screen.getByTestId('profile-switcher-add')).toBeTruthy();
    expect(screen.getByTestId('profile-switcher-settings')).toBeTruthy();
    expect(screen.queryByTestId('profile-switcher-sign-out')).toBeNull();
    expect(sheet.textContent).not.toMatch(/Sign out/);
    // + Add a profile opens the same add step in both areas
    fireEvent.click(screen.getByTestId('profile-switcher-add'));
    expect(screen.getByTestId('profile-switcher-add-organiser')).toBeTruthy();
    fireEvent.click(screen.getByTestId('profile-switcher-add-back'));
    // Esc closes
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('profile-switcher-sheet')).toBeNull());
  });

  it('without a query client the link card still has Add a profile and Account settings', () => {
    mount('dancer', false);
    fireEvent.click(screen.getByTestId('profile-switcher-button'));
    expect(screen.getByTestId('profile-switcher-add')).toBeTruthy();
    expect(screen.getByTestId('profile-switcher-settings')).toBeTruthy();
  });

  it('flag off: the classic sheet, "Account" with one profile and Sign out in it', () => {
    world.flag = false;
    mount('dancer');
    expect(screen.getByTestId('profile-switcher-label').textContent).toBe('Account');
    fireEvent.click(screen.getByTestId('profile-account-button'));
    expect(screen.getByTestId('profile-switcher-sheet').getAttribute('data-look')).toBeNull();
    expect(screen.getByTestId('profile-switcher-sign-out')).toBeTruthy();
  });
});
