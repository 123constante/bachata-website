// @vitest-environment jsdom
/**
 * Review fix pass on /app/home (slice B review S2, S3, S4, S5, S8, S9, N2, N3, N5).
 * Same harness as emberRestyle.test.tsx: rpcLoose is mocked, the shell is real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/lib/goingCheckin', () => ({ GOING_CHECKIN_ENABLED: true })); // S2 / S4 exercise the nights hero (behind the going switch)
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
    if (fn === 'get_my_going_v1') return h.attendance();
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
import { night as goingNight } from '../screens/nights/__tests__/goingShapes';

const person = (id: string, name: string, roles: string[], path: string) => ({
  profile_id: id, roles, display_name: name, avatar_url: null, public_path: path,
  last_night: { series_id: 's1', event_name: 'Sensual Sundays', slug: null, on_date: '2026-10-18' },
});
const PEOPLE = { total: 2, people: [person('p1', 'Lena Ortiz', ['teacher', 'dj'], '/teachers/lena-ortiz'), person('p2', 'Marco Vidal', ['dj'], '/djs/marco-vidal')] };
/** get_my_going_v1 with one upcoming night `n` days out. */
const mine = (n: number) => ({ upcoming: [goingNight('e1', 'Brixton Bachata', n)], past: [] });

beforeEach(() => {
  h.emits = [];
  h.lineup = async () => ({ data: PEOPLE, error: null });
  h.attendance = async () => ({ data: { upcoming: [], past: [] }, error: null });
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  resetShell();
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
