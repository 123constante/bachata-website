// @vitest-environment jsdom
/**
 * A-WEB1b: the pure rules (levels, nudge, answers) and the three screens that
 * read my_profile_progress_v1 next to the wizard: Home's ONE button (percent and
 * level equal the RPC's; D50 auto-open and Not now), My page's required line,
 * and the Team toggle.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

const rpc = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc, from } }));

import { PROFILE_WIZARD_PATH } from '@/modules/organiser/shared/profileProgress';
import { ProfileButton } from '../../home/ProfileButton';
import { RequiredLine } from '../../page';
import { PublicToggle, PUBLIC_OFF_NOTE, PUBLIC_ON_NOTE, NO_PROFILE_NOTE } from '../../team/PublicToggle';
import { PUBLIC_TEAM_FULL } from '../../team/publicTeamApi';
import { markFinishLater, readNudge } from '../nudgeStore';
import {
  EMPTY_NUDGE, FINISH_LATER_MS, NOT_NOW_MS, canSayNotNow, levelName, levelOf, sameAnswer, shouldAutoOpen, showHomeButton, withPendingItem,
} from '../wizardModel';

const NOW = Date.parse('2026-10-20T10:00:00Z');

describe('levels (C16): one mapping from the RPC numbers', () => {
  it.each([
    [10, false, 'Starter'],
    [99, false, 'Starter'],
    [60, true, 'Ready to publish'],
    [100, true, 'Full profile'],
  ])('percent %i, publish_ready %s -> %s', (percent, publishReady, name) => {
    expect(levelName(levelOf({ percent, publishReady }))).toBe(name);
  });
});

describe('D50 nudge rules', () => {
  const p = (requiredLeft: number, percent: number) => ({ requiredLeft, percent });
  it.each([
    ['required left, never paused', p(2, 40), EMPTY_NUDGE, true],
    ['required left, Finish later 1 h ago', p(2, 40), { ...EMPTY_NUDGE, finishLaterAt: NOW - 3600_000 }, false],
    ['required left, Finish later 25 h ago', p(2, 40), { ...EMPTY_NUDGE, finishLaterAt: NOW - FINISH_LATER_MS - 3600_000 }, true],
    ['required done', p(0, 60), EMPTY_NUDGE, false],
  ])('auto-open: %s', (_l, prog, nudge, open) => {
    expect(shouldAutoOpen(prog, nudge, NOW)).toBe(open);
  });

  it.each([
    ['required left: always, even after Not now', p(1, 50), { ...EMPTY_NUDGE, notNowAt: NOW, notNowCount: 1 }, true],
    ['after required, no Not now', p(0, 60), EMPTY_NUDGE, true],
    ['Not now 10 days ago', p(0, 60), { ...EMPTY_NUDGE, notNowAt: NOW - 10 * 86400_000, notNowCount: 1 }, false],
    ['Not now 31 days ago', p(0, 60), { ...EMPTY_NUDGE, notNowAt: NOW - NOT_NOW_MS - 86400_000, notNowCount: 1 }, true],
    ['100%', p(0, 100), EMPTY_NUDGE, false],
  ])('button shows: %s', (_l, prog, nudge, shown) => {
    expect(showHomeButton(prog, nudge, NOW)).toBe(shown);
  });

  it('Not now is offered after the required part, twice at most', () => {
    expect(canSayNotNow({ requiredLeft: 1 }, EMPTY_NUDGE)).toBe(false);
    expect(canSayNotNow({ requiredLeft: 0 }, { ...EMPTY_NUDGE, notNowCount: 1 })).toBe(true);
    expect(canSayNotNow({ requiredLeft: 0 }, { ...EMPTY_NUDGE, notNowCount: 2 })).toBe(false);
  });

  it('a storage that throws never blocks: reads empty, writes nothing', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(readNudge('u1', broken)).toEqual(EMPTY_NUDGE);
    expect(() => markFinishLater('u1', NOW, broken)).not.toThrow();
  });
});

describe('answers', () => {
  it.each([
    [['A'], ' b ', ['A', 'b']],
    [['Sensual'], 'sensual', ['Sensual']],
    [[], '   ', []],
  ])('D27 %j + %j -> %j', (items, pending, out) => {
    expect(withPendingItem(items, pending)).toEqual(out);
  });
  it.each([
    ['', null, true], ['  x ', 'x', true], [[], null, true], [['a'], ['a'], true], [2019, 2019, true], ['a', 'b', false],
  ])('sameAnswer(%j, %j) = %s', (a, b, same) => {
    expect(sameAnswer(a, b)).toBe(same);
  });
});

// ---- screens -------------------------------------------------------------------------------

let progress: Record<string, unknown>;
function Where() {
  return <span data-testid="where">{useLocation().pathname}</span>;
}
function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route path="/home" element={node} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  try { window.localStorage.clear(); } catch { /* jsdom */ }
  progress = { percent: 64, required_left: 0, publish_ready: true, steps: [], declined: [] };
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) => (fn === 'my_profile_progress_v1' ? { data: progress, error: null } : { data: null, error: { message: 'nope' } }));
});
afterEach(cleanup);

describe('Home: ONE "Complete your profile" button', () => {
  it.each([
    [37, 3, false, '3 left', 'Starter'],
    [64, 0, true, 'Ready to publish', 'Ready to publish'],
  ])('percent %i / required_left %i: ring and level are the RPC\'s', async (percent, left, ready, text, level) => {
    progress = { ...progress, percent, required_left: left, publish_ready: ready };
    markFinishLater('u1', Date.now()); // no auto-open in this row
    wrap(<ProfileButton organiserId="org-1" userId="u1" />);
    const btn = await screen.findByTestId('home-profile-button');
    expect(btn.getAttribute('data-percent')).toBe(String(percent));
    expect(screen.getByTestId('home-profile-ring').getAttribute('data-percent')).toBe(String(percent));
    expect(screen.getByTestId('home-profile-level').textContent).toContain(text);
    expect(screen.getByTestId('home-profile-level').textContent).toContain(level);
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(PROFILE_WIZARD_PATH));
  });

  it('opens the wizard by itself while required answers are missing (D50)', async () => {
    progress = { ...progress, percent: 20, required_left: 5, publish_ready: false };
    wrap(<ProfileButton organiserId="org-1" userId="u1" />);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(PROFILE_WIZARD_PATH));
  });

  it('Not now hides the button; at 100% there is no button; a failed read shows nothing', async () => {
    wrap(<ProfileButton organiserId="org-1" userId="u1" />);
    fireEvent.click(await screen.findByTestId('home-profile-not-now'));
    expect(screen.queryByTestId('home-profile-button')).toBeNull();
    cleanup();
    window.localStorage.clear();
    progress = { ...progress, percent: 100 };
    wrap(<ProfileButton organiserId="org-1" userId="u1" />);
    await waitFor(() => expect(rpc).toHaveBeenCalled());
    expect(screen.queryByTestId('home-profile-button')).toBeNull();
    cleanup();
    rpc.mockImplementation(async () => ({ data: null, error: { message: 'boom' } }));
    wrap(<ProfileButton organiserId="org-1" userId="u1" />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('home-profile')).toBeNull();
  });
});

describe('My page: "Required to publish: N left"', () => {
  it.each([[3, true], [0, false]])('required_left %i -> line shown %s, opening the wizard', async (left, shown) => {
    progress = { ...progress, required_left: left, publish_ready: left === 0 };
    wrap(<RequiredLine organiserId="org-1" />);
    await waitFor(() => expect(rpc).toHaveBeenCalled());
    if (!shown) {
      await new Promise((r) => setTimeout(r, 20));
      expect(screen.queryByTestId('page-required-line')).toBeNull();
      return;
    }
    const line = await screen.findByTestId('page-required-line');
    expect(line.textContent).toBe(`Required to publish: ${left} left`);
    expect(line.getAttribute('href')).toBe(PROFILE_WIZARD_PATH);
  });
});

describe('Team: "Show me on the public team" (own row)', () => {
  const publicRows = (rows: unknown[]) => {
    const q = { select: () => q, eq: () => q, limit: async () => ({ data: rows, error: null }) };
    from.mockReturnValue(q);
  };

  it.each([
    ['shown', [{ id: 'x' }], true, PUBLIC_ON_NOTE],
    ['hidden', [], false, PUBLIC_OFF_NOTE],
  ])('%s: the switch and what visitors see', async (_l, rows, on, note) => {
    publicRows(rows);
    wrap(<PublicToggle organiserId="org-1" profileId="p1" />);
    await waitFor(() => expect(screen.getByTestId('team-public-switch').getAttribute('aria-checked')).toBe(String(on)));
    expect(screen.getByTestId('team-public-note').textContent).toBe(note);
  });

  it('a tap sends the opposite and shows the new state', async () => {
    publicRows([]);
    rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => (fn === 'organiser_team_set_public_v1' ? { data: { status: args.p_public ? 'public' : 'hidden' }, error: null } : { data: null, error: null }));
    wrap(<PublicToggle organiserId="org-1" profileId="p1" />);
    const sw = screen.getByTestId('team-public-switch');
    await waitFor(() => expect((sw as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(sw);
    await waitFor(() => expect(sw.getAttribute('aria-checked')).toBe('true'));
    expect(rpc).toHaveBeenCalledWith('organiser_team_set_public_v1', { p_organiser_id: 'org-1', p_public: true });
  });

  it('team_full keeps the switch and says why in plain words', async () => {
    publicRows([]);
    rpc.mockImplementation(async () => ({ data: null, error: { message: 'team_full' } }));
    wrap(<PublicToggle organiserId="org-1" profileId="p1" />);
    const sw = screen.getByTestId('team-public-switch');
    await waitFor(() => expect((sw as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(sw);
    await waitFor(() => expect(screen.getByTestId('team-public-error').textContent).toBe(PUBLIC_TEAM_FULL));
    expect(sw.getAttribute('aria-checked')).toBe('false');
  });

  it('no dancer profile: disabled with the reason on screen', () => {
    wrap(<PublicToggle organiserId="org-1" profileId={null} />);
    expect((screen.getByTestId('team-public-switch') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('team-public-note').textContent).toBe(NO_PROFILE_NOTE);
  });
});
