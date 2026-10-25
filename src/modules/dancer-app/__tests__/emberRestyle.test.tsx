// @vitest-environment jsdom
/**
 * D115 restyle behaviours (brief RESTYLE-DANCER-APP): D119 full weekdays, D120 home link on every
 * /app/* route, D123 no week list, D124/D126 "Teachers and DJs from your nights", D129 switcher only
 * with 2+ profiles + Your areas in Options, D130 no "Browse events", D131 no top-bar Events.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));

const h = vi.hoisted(() => ({
  sides: [{ kind: 'dancer', key: 'dancer', firstName: 'Ana', avatarUrl: null, to: '/app/home' }] as Array<Record<string, unknown>>,
  lineup: null as unknown as () => Promise<{ data: unknown; error: unknown }>,
  calls: [] as string[],
}));
vi.mock('@/integrations/supabase/rpcLoose', () => ({
  rpcLoose: async (fn: string, args?: Record<string, unknown>) => {
    h.calls.push(fn);
    if (fn === 'my_nights_lineup_people_v1') {
      expect(args).toBeUndefined();
      return h.lineup();
    }
    if (fn === 'get_my_going_v1') return { data: { upcoming: [], past: [] }, error: null };
    return { data: null, error: { message: `unexpected rpc ${fn}` } };
  },
}));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => ({ rpc: async () => ({ data: null, error: null }) }) }));

vi.mock('@/components/account/profiles/useProfileSides', () => ({
  useProfileSides: () => ({ facts: {}, state: { status: 'ready', sides: h.sides }, openRequestCount: 0 }),
}));

import { renderInShell, resetShell } from '../shell/renderInShell';
import { DANCER_ROUTES } from '../shell/routes';
import { fullDate, shortDate } from '../screens/nights/nightsModel';
import { optionsRows } from '../screens/options/optionsModel';

const PEOPLE = {
  total: 2,
  people: [
    { profile_id: 'p1', roles: ['teacher', 'dj'], display_name: 'Lena Ortiz', avatar_url: null, public_path: '/teachers/lena-ortiz', last_night: { series_id: 's1', event_name: 'Sensual Sundays', slug: 'sensual-sundays', on_date: '2026-10-18' } },
    { profile_id: 'p2', roles: ['dj'], display_name: 'Marco Vidal', avatar_url: 'https://x.test/m.jpg', public_path: '/djs/marco-vidal', last_night: { series_id: 's2', event_name: 'Brixton Bachata', slug: null, on_date: '2026-10-03' } },
  ],
};

beforeEach(() => {
  h.calls = [];
  h.sides = [{ kind: 'dancer', key: 'dancer', firstName: 'Ana', avatarUrl: null, to: '/app/home' }];
  h.lineup = async () => ({ data: PEOPLE, error: null });
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  resetShell();
});

describe('D119 full weekday names', () => {
  it('fullDate and shortDate spell the weekday out', () => {
    expect(fullDate('2026-10-24')).toBe('Saturday 24 Oct');
    expect(shortDate('2026-10-24')).toBe('Saturday 24 Oct');
    expect(shortDate(null)).toBe('Date to be confirmed');
  });
});

describe('D120 home link on every /app/* route', () => {
  it.each(DANCER_ROUTES.map((r) => [r.id, r.path] as const))('%s (%s) renders the home link to "/"', async (_id, path) => {
    renderInShell({ path, backend: { shape: path === '/app/welcome' ? 'nameCityOnly' : 'fourFieldComplete' } });
    const link = await screen.findByTestId('site-home-link');
    expect(link.getAttribute('href')).toBe('/');
    expect(link.textContent).toContain('Bachata Calendar');
  });
  it('is the only link to "/" in the header, and the top-bar Events button is gone (D131)', async () => {
    renderInShell({ path: '/app/home' });
    const header = await screen.findByTestId('dancer-app-header');
    expect([...header.querySelectorAll('a')].filter((a) => a.getAttribute('href') === '/').length).toBe(1);
    expect(screen.queryByTestId('dancer-app-events')).toBeNull();
    expect(within(header).queryByText('Events')).toBeNull();
  });
});

describe('D123/D124 Home', () => {
  it('has no "What\'s on this week"', async () => {
    renderInShell({ path: '/app/home' });
    await screen.findByTestId('dancer-screen-home');
    await screen.findByTestId('lineup-people');
    expect(screen.queryByTestId('whats-on')).toBeNull();
    expect(screen.queryByText(/What.s on this week/)).toBeNull();
  });
  it('filled: one row per person linking to public_path, with the full-weekday last night', async () => {
    renderInShell({ path: '/app/home' });
    const rows = await screen.findAllByTestId('lineup-person');
    expect(rows).toHaveLength(2);
    expect(h.calls.filter((c) => c === 'my_nights_lineup_people_v1')).toHaveLength(1);
    expect(rows[0].getAttribute('href')).toBe('/teachers/lena-ortiz');
    expect(rows[0].textContent).toContain('Lena Ortiz');
    expect(rows[0].textContent).toContain('Teacher');
    expect(rows[0].textContent).toContain('DJ');
    expect(rows[0].textContent).toContain('Last seen at Sensual Sundays, Sunday 18 Oct');
    expect(rows[0].textContent).toContain('L'); // initial, no avatar_url
    expect(rows[1].getAttribute('href')).toBe('/djs/marco-vidal');
    expect(rows[1].querySelector('img')).not.toBeNull();
  });
  it('empty: says what happens, no button', async () => {
    h.lineup = async () => ({ data: { total: 0, people: [] }, error: null });
    renderInShell({ path: '/app/home' });
    const empty = await screen.findByTestId('lineup-people-empty');
    expect(empty.textContent).toMatch(/after nights you went to/i);
    expect(within(empty).queryAllByRole('button')).toHaveLength(0);
    expect(within(empty).queryAllByRole('link')).toHaveLength(0);
  });
  it.each([
    ['rpc error', { data: null, error: { message: 'function public.my_nights_lineup_people_v1() does not exist' } }],
    ['malformed', { data: { total: 'x' }, error: null }],
  ])('load error (%s): error state with a retry, never a crash', async (_n, result) => {
    h.lineup = async () => result;
    renderInShell({ path: '/app/home' });
    const err = await screen.findByTestId('lineup-people-error');
    h.lineup = async () => ({ data: PEOPLE, error: null });
    fireEvent.click(within(err).getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(screen.getAllByTestId('lineup-person')).toHaveLength(2));
  });
});

describe('D129 switcher and Your areas', () => {
  it('1 profile: no switcher; Options lists Your areas', async () => {
    renderInShell({ path: '/app/options' });
    await screen.findByTestId('opt-areas');
    expect(screen.queryByTestId('profile-switcher-button')).toBeNull();
    expect(optionsRows({ other_roles: [], is_active: true }).map((r) => r.id)).toContain('areas');
  });
  it('2 profiles: the switcher shows', async () => {
    h.sides = [{ kind: 'dancer', key: 'dancer', firstName: 'Ana', avatarUrl: null, to: '/app/home' }, { kind: 'organiser', key: 'o1', organiserId: 'o1', name: 'Soho Nights', avatarUrl: null, to: '/account/o?o=o1' }];
    renderInShell({ path: '/app/home' });
    expect(await screen.findByTestId('profile-switcher-button')).toBeTruthy();
  });
});

describe('D130 no "Browse events" anywhere in /app/*', () => {
  const states: Array<[string, string, Parameters<typeof renderInShell>[0]]> = [
    ['home', '/app/home', {}],
    ['nights (empty)', '/app/nights', {}],
    ['me', '/app/me', {}],
    ['options', '/app/options', {}],
    ['page', '/app/page', {}],
    ['home (no profile)', '/app/home', { backend: { profile: null } }],
  ];
  it.each(states)('%s renders no Browse events control', async (_n, path, opts) => {
    renderInShell({ path, ...opts });
    await waitFor(() => expect(screen.getByTestId('dancer-app-content').textContent?.length ?? 0).toBeGreaterThan(5));
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText(/browse events/i)).toBeNull();
  });
});

describe('D119 Edit: back button and "Discard changes?"', () => {
  const edit = async () => {
    const r = renderInShell({ path: '/app/me/edit' });
    await screen.findByTestId('dancer-screen-edit');
    return r;
  };
  const type = (v: string) => fireEvent.change(screen.getByLabelText(/^Display name/), { target: { value: v } });

  it('a header back button goes straight back to Me when nothing changed', async () => {
    const r = await edit();
    fireEvent.click(screen.getByTestId('edit-header-back'));
    await screen.findByTestId('dancer-screen-me');
    expect(r.location()).toBe('/app/me');
    expect(screen.queryByText('Discard changes?')).toBeNull();
  });
  it('unsaved edits: back asks; Keep editing stays with the edits, Discard leaves', async () => {
    const r = await edit();
    type('Changed Name');
    fireEvent.click(screen.getByTestId('edit-header-back'));
    expect(await screen.findByText('Discard changes?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(screen.queryByText('Discard changes?')).toBeNull());
    expect(r.location()).toBe('/app/me/edit');
    expect((screen.getByLabelText(/^Display name/) as HTMLInputElement).value).toBe('Changed Name');
    fireEvent.click(screen.getByTestId('edit-header-back'));
    fireEvent.click(await screen.findByRole('button', { name: 'Discard' }));
    await screen.findByTestId('dancer-screen-me');
    expect(r.location()).toBe('/app/me');
  });
  it('the home link and a tab go through the same sheet', async () => {
    const r = await edit();
    type('Changed Name');
    fireEvent.click(screen.getByTestId('site-home-link'));
    expect(await screen.findByText('Discard changes?')).toBeTruthy();
    expect(r.location()).toBe('/app/me/edit');
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(r.location()).toBe('/'));
  });
  it('the Back to Me link goes through the sheet too', async () => {
    const r = await edit();
    type('Changed Name');
    fireEvent.click(screen.getByRole('link', { name: 'Back to Me' }));
    expect(await screen.findByText('Discard changes?')).toBeTruthy();
    expect(r.location()).toBe('/app/me/edit');
  });
  it('S1: Change photo goes through the sheet; Discard then opens the photo screen', async () => {
    const r = await edit();
    type('Changed Name');
    fireEvent.click(screen.getByTestId('edit-change-photo'));
    expect(await screen.findByText('Discard changes?')).toBeTruthy();
    expect(r.location()).toBe('/app/me/edit');
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(r.location()).toBe('/app/me/photo?return=/app/me/edit'));
  });
  it('S1: a profile-switcher row goes through the sheet; Discard then switches', async () => {
    h.sides = [{ kind: 'dancer', key: 'dancer', firstName: 'Ana', avatarUrl: null, to: '/app/home' }, { kind: 'organiser', key: 'o1', organiserId: 'o1', name: 'Soho Nights', avatarUrl: null, to: '/account/o?o=o1' }];
    const r = await edit();
    type('Changed Name');
    fireEvent.click(await screen.findByTestId('profile-switcher-button'));
    fireEvent.click(await screen.findByTestId('profile-switcher-side-o1'));
    expect(await screen.findByText('Discard changes?')).toBeTruthy();
    expect(r.location()).toBe('/app/me/edit');
    // The switcher closes so the discard sheet is the one on screen.
    expect(screen.queryByTestId('profile-switcher-sheet')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(r.location()).toBe('/account/o?o=o1'));
  });
  it('S1: a profile-switcher row switches straight away when nothing changed', async () => {
    h.sides = [{ kind: 'dancer', key: 'dancer', firstName: 'Ana', avatarUrl: null, to: '/app/home' }, { kind: 'organiser', key: 'o1', organiserId: 'o1', name: 'Soho Nights', avatarUrl: null, to: '/account/o?o=o1' }];
    const r = await edit();
    fireEvent.click(await screen.findByTestId('profile-switcher-button'));
    fireEvent.click(await screen.findByTestId('profile-switcher-side-o1'));
    await waitFor(() => expect(r.location()).toBe('/account/o?o=o1'));
    expect(screen.queryByText('Discard changes?')).toBeNull();
  });
  it('S1: closing the tab or reloading asks the browser to confirm only while there are unsaved edits', async () => {
    await edit();
    const unload = () => {
      const ev = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(ev);
      return ev.defaultPrevented;
    };
    expect(unload()).toBe(false);
    type('Changed Name');
    expect(unload()).toBe(true);
  });
  it('N7: Discard is quiet danger text, not a ghost button', async () => {
    await edit();
    type('Changed Name');
    fireEvent.click(screen.getByTestId('edit-header-back'));
    const discard = await screen.findByRole('button', { name: 'Discard' });
    expect(discard.getAttribute('data-testid')).toBe('edit-discard');
    expect(discard.className).toContain('text-[var(--danger)]');
  });
});
