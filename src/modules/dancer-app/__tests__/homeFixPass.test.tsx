// @vitest-environment jsdom
/**
 * Review fix pass on /app/home (slice B review S2, S3, S4, S5, S8, S9, N2, N3, N5).
 * Same harness as emberRestyle.test.tsx: rpcLoose is mocked, the shell is real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));

const h = vi.hoisted(() => ({
  lineup: null as unknown as () => Promise<{ data: unknown; error: unknown }>,
  attendance: null as unknown as () => Promise<{ data: unknown; error: unknown }>,
  emits: [] as unknown[],
}));
vi.mock('@/integrations/supabase/rpcLoose', () => ({
  rpcLoose: async (fn: string) => {
    if (fn === 'my_nights_lineup_people_v1') return h.lineup();
    if (fn === 'get_my_event_attendance_v2') return h.attendance();
    return { data: null, error: { message: `unexpected rpc ${fn}` } };
  },
}));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => ({ rpc: async () => ({ data: null, error: null }) }) }));
vi.mock('@/lib/profileViewEmit', () => ({ emitProfileView: (a: unknown) => { h.emits.push(a); } }));

import { renderInShell, resetShell } from '../shell/renderInShell';
import { setTestUser } from '../shell/testAuth';
import { FIND_A_NIGHT } from '../copy/sharedCopy';
import { NO_NIGHTS_FIND } from '../screens/nights/NightsScreen';
import { LineupPeople } from '../screens/home/LineupPeople';
import { parseLineupPeople } from '../api/lineupPeople';
import { addDaysToKey, londonTodayKey } from '@/lib/londonDate';

const person = (id: string, name: string, roles: string[], path: string) => ({
  profile_id: id, roles, display_name: name, avatar_url: null, public_path: path,
  last_night: { series_id: 's1', event_name: 'Sensual Sundays', slug: null, on_date: '2026-10-18' },
});
const PEOPLE = { total: 2, people: [person('p1', 'Lena Ortiz', ['teacher', 'dj'], '/teachers/lena-ortiz'), person('p2', 'Marco Vidal', ['dj'], '/djs/marco-vidal')] };
const night = (n: number) => ({
  event_id: 'e1', status: 'going', updated_at: null, name: 'Brixton Bachata', occurrence_date: addDaysToKey(londonTodayKey(), n),
  city_name: 'London', start_time: '21:00:00', type: 'party', is_active: true,
});

beforeEach(() => {
  h.emits = [];
  h.lineup = async () => ({ data: PEOPLE, error: null });
  h.attendance = async () => ({ data: [], error: null });
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  resetShell();
});

describe('S2: the next-night card has an action when loading fails', () => {
  it('shows Try again, which refetches the nights', async () => {
    h.attendance = async () => ({ data: null, error: { message: 'boom' } });
    renderInShell({ path: '/app/home' });
    const hero = await screen.findByTestId('home-hero');
    await waitFor(() => expect(hero.textContent).toMatch(/couldn.t load your nights/));
    h.attendance = async () => ({ data: [night(2)], error: null });
    fireEvent.click(within(hero).getByRole('button', { name: /try again/i }));
    await waitFor(() => expect(screen.getByTestId('home-hero').textContent).toContain('Brixton Bachata'));
  });
});

describe('S4: hero "See event" is full width, 52px+, token colours', () => {
  it('is a full-width class link with no inline hex', async () => {
    h.attendance = async () => ({ data: [night(2)], error: null });
    renderInShell({ path: '/app/home' });
    const link = await screen.findByRole('link', { name: 'See event' });
    expect(link.className).toContain('da-hero-cta');
    expect(link.getAttribute('style') ?? '').not.toMatch(/#/);
  });
  it('strength tile spans the whole row and ends in a chevron', async () => {
    renderInShell({ path: '/app/home' });
    const tile = await screen.findByTestId('tile-strength');
    expect(tile.className).toContain('da-strength-row');
    expect(tile.querySelector('svg')).not.toBeNull();
    expect(tile.textContent).toContain('Profile strength');
  });
});

describe('S3 + S8: lineup rows', () => {
  it('a tap emits ONE profile view with the id and type, and navigates in the app (router link)', async () => {
    const r = renderInShell({ path: '/app/home' });
    const rows = await screen.findAllByTestId('lineup-person');
    expect(rows[0].querySelector('svg')).not.toBeNull(); // chevron
    fireEvent.click(rows[0]);
    await waitFor(() => expect(r.location()).toBe('/teachers/lena-ortiz'));
    // The emitter is loaded on the tap (kept off the /app/* first load), so the call lands a tick later.
    await waitFor(() => expect(h.emits).toHaveLength(1));
    await new Promise((res) => setTimeout(res, 20));
    expect(h.emits).toEqual([{ personId: 'p1', profileType: 'teacher', context: 'dancer-app:home-lineup' }]);
  });
  it('a DJ-only row emits type dj', async () => {
    renderInShell({ path: '/app/home' });
    const rows = await screen.findAllByTestId('lineup-person');
    fireEvent.click(rows[1]);
    await waitFor(() => expect(h.emits).toEqual([{ personId: 'p2', profileType: 'dj', context: 'dancer-app:home-lineup' }]));
  });
  it('the section label is sentence case 15px/700 in the text colour', async () => {
    renderInShell({ path: '/app/home' });
    const section = await screen.findByTestId('lineup-people');
    const label = within(section).getByRole('heading', { name: 'Teachers and DJs from your nights' });
    expect(label.hasAttribute('data-section-title')).toBe(true); // the shared SectionTitle from ../blocks
    expect(label.className).toContain('text-[15px]');
    expect(label.className).toContain('text-[var(--fg)]');
    expect(label.className).not.toMatch(/(^|\s)uppercase(\s|$)/);
  });
});

describe('S5: the partner button is a ghost, not a second primary', () => {
  it('uses the card2 surface', async () => {
    renderInShell({ path: '/app/home' });
    const btn = await screen.findByTestId('partner-notify');
    expect(btn.className).toContain('bg-[var(--card2)]');
    expect(btn.getAttribute('style') ?? '').not.toContain('--da-accent');
  });
});

describe('S4a: rate nudge layout', () => {
  it('icon tile, stacked title and body, chevron -- source pin (the nudge needs a rateable series, see dancerAppHomeNights)', async () => {
    const src = (await import('node:fs')).readFileSync('src/modules/dancer-app/screens/home/RateNudge.tsx', 'utf8');
    expect(src).toContain('<Check ');
    expect(src).toContain('<ChevronRight ');
    expect(src).toMatch(/<b className="block text-\[15px\]">/);
  });
});

describe('S9: one "find a night" sentence on all three surfaces', () => {
  it('Nights uses the shared constant', () => expect(NO_NIGHTS_FIND).toBe(FIND_A_NIGHT));
  it('the Home empty hero says it', async () => {
    renderInShell({ path: '/app/home' });
    const hero = await screen.findByTestId('home-hero');
    await waitFor(() => expect(hero.textContent).toContain(FIND_A_NIGHT));
  });
  it('the lineup empty state says it', async () => {
    h.lineup = async () => ({ data: { total: 0, people: [] }, error: null });
    renderInShell({ path: '/app/home' });
    const empty = await screen.findByTestId('lineup-people-empty');
    expect(empty.textContent).toContain(FIND_A_NIGHT);
  });
  it('the Nights empty state says it', async () => {
    renderInShell({ path: '/app/nights' });
    const empty = await screen.findByTestId('nights-empty');
    expect(empty.textContent).toContain(FIND_A_NIGHT);
  });
});

describe('N2: no user means no error state', () => {
  it('renders no error and calls nothing while signed out', async () => {
    setTestUser(null);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={qc}><MemoryRouter><LineupPeople /></MemoryRouter></QueryClientProvider>);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId('lineup-people-error')).toBeNull();
  });
});

describe('N3: de-duplication and "and N more"', () => {
  it('the parser keeps the first row per profile_id', () => {
    const p = parseLineupPeople({ total: 3, people: [PEOPLE.people[0], { ...PEOPLE.people[0], display_name: 'Dup' }, PEOPLE.people[1]] });
    expect(p.people.map((x) => x.display_name)).toEqual(['Lena Ortiz', 'Marco Vidal']);
    expect(p.total).toBe(2); // the dropped duplicate is not "1 more"
  });
  it('shows "and N more" only when total is above the rows shown', async () => {
    h.lineup = async () => ({ data: { ...PEOPLE, total: 5 }, error: null });
    renderInShell({ path: '/app/home' });
    expect((await screen.findByTestId('lineup-people-more')).textContent).toBe('and 3 more');
  });
  it('no "and N more" when every row is shown', async () => {
    renderInShell({ path: '/app/home' });
    await screen.findAllByTestId('lineup-person');
    expect(screen.queryByTestId('lineup-people-more')).toBeNull();
  });
});

describe('S3: the emitter stays off the /app/* first load', () => {
  it('LineupPeople has no static import of profileViewEmit (it imports the eager supabase client)', async () => {
    const src = (await import('node:fs')).readFileSync('src/modules/dancer-app/screens/home/LineupPeople.tsx', 'utf8');
    expect(src).not.toMatch(/^import .*profileViewEmit/m);
    expect(src).toContain("import('@/lib/profileViewEmit')");
  });
});

describe('N5: no raw hex in the Home screen files', () => {
  it.each(['HomeScreen.tsx', 'LineupPeople.tsx', 'RateNudge.tsx', 'PartnerTile.tsx', 'NumbersTiles.tsx', 'homeCopy.ts'])('%s', async (f) => {
    const src = (await import('node:fs')).readFileSync(`src/modules/dancer-app/screens/home/${f}`, 'utf8');
    expect(src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
  });
});
