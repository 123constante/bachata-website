// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { parseRaffleBoard } from '@/lib/raffleBoard';
import { rafflePoolJoinedKey } from '@/lib/raffleSession';
import { BOARD_SHAPES } from '@/lib/__tests__/raffleBoardFixtures';

const h = vi.hoisted(() => ({
  flag: { raffleV2: true },
  board: { data: undefined as unknown, isError: false, isLoading: false, refetch: vi.fn() },
}));

vi.mock('@/lib/featureFlags', () => ({ flags: h.flag }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('@/hooks/useRaffleBoard', () => ({ useRaffleBoard: () => h.board }));
vi.mock('@/hooks/useOpenRaffles', () => ({
  useOpenRaffles: () => ({ data: [], isLoading: false, isError: false }),
  useRaffleStats: () => ({ data: null }),
}));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/lib/breadcrumbs', () => ({ buildBreadcrumbs: () => [] }));
vi.mock('@/lib/seo', () => ({ buildSeoForRoute: () => ({}), useSeo: () => {} }));
vi.mock('@/components/raffles/RaffleHero', () => ({ default: () => <div data-testid="legacy-hero" /> }));
vi.mock('@/components/raffles/OpenRafflesGrid', () => ({ default: () => null }));
vi.mock('@/components/raffles/RaffleInfoBands', () => ({ HowItWorks: () => null, JackpotCounter: () => null, OrganiserCTA: () => null }));
vi.mock('@/modules/event-page/bento/modals/RaffleEntryDialog', () => ({
  RaffleEntryDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="entry-dialog" /> : null),
}));

import Raffles from '../Raffles';

const mount = () => render(<MemoryRouter><Raffles /></MemoryRouter>);

beforeEach(() => {
  cleanup();
  window.sessionStorage.clear();
  window.localStorage.clear();
  h.flag.raffleV2 = true;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-05T12:00:00Z')); // Thursday; same week as the fixture nights
});
afterEach(() => { vi.useRealTimers(); });

describe('/raffles board: shape x screen', () => {
  for (const s of BOARD_SHAPES) {
    it(s.name, () => {
      h.board = { ...h.board, data: s.json === null ? undefined : parseRaffleBoard(s.json), isError: s.json === null };
      mount();
      if (s.json === null) {
        expect(screen.getByTestId('raffles-board-error')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: /try again/i }));
        expect(h.board.refetch).toHaveBeenCalled();
        return;
      }
      expect(screen.getByTestId('raffles-count-pool').textContent).toBe(String(s.pagePool));
      // never the RPC's total_winners (766 on prod); only winners listed on nights
      expect(screen.getByTestId('raffles-count-winners').textContent).toBe(String(s.pageWeekWinners.length));
      const list = screen.queryByTestId('raffles-week-list');
      if (s.pageWeekWinners.length === 0) {
        expect(screen.getByTestId('raffles-week-empty').textContent).toMatch(
          s.name === 'empty' ? /No raffle nights are open right now/ : /^No winners yet this week\. Enter now/);
      } else {
        for (const w of s.pageWeekWinners) expect(list?.textContent).toContain(w);
        expect(list?.textContent).toContain('The Cellar');
        expect(list?.textContent).toContain('Friday Social');
      }
    });
  }
  it('loading is its own state with copy, not the empty copy', () => {
    h.board = { ...h.board, data: undefined, isError: false, isLoading: true };
    mount();
    expect(screen.getByTestId('raffles-board-loading').textContent).toMatch(/Loading the raffle board/);
    expect(screen.queryByTestId('raffles-week-empty')).toBeNull();
    expect(screen.getByTestId('raffles-enter')).toBeTruthy();
  });
  it('error copy says what to do and Try again works', () => {
    h.board = { ...h.board, data: undefined, isError: true, isLoading: false };
    mount();
    expect(screen.getByTestId('raffles-board-error').textContent).toMatch(/try again/i);
  });
  it('night time shows the London day (22:30Z in BST is 23:30 same day; 23:30Z is next day)', () => {
    vi.setSystemTime(new Date('2026-07-14T12:00:00Z'));
    const mk = (t: string) => parseRaffleBoard({ pool_count: 1, winners_this_month: 0, total_winners: 766, nights: [{
      occurrence_id: 'o', public_event_id: 'e', title: 'T', start_local: t, venue_name: 'V', winner_first_name: 'Ana' }] });
    h.board = { ...h.board, data: mk('2026-07-12T23:30:00'), isError: false, isLoading: false };
    mount();
    expect(screen.getByTestId('raffles-week-list').textContent).toContain('Mon 13 Jul');
  });
  it('Enter button opens the dialog; key set shows You are in instead', () => {
    h.board = { ...h.board, data: parseRaffleBoard(BOARD_SHAPES[2].json), isError: false };
    mount();
    fireEvent.click(screen.getByTestId('raffles-enter'));
    expect(screen.getByTestId('entry-dialog')).toBeTruthy();
    cleanup();
    window.sessionStorage.setItem(rafflePoolJoinedKey, '1');
    mount();
    expect(screen.getByTestId('raffles-youre-in')).toBeTruthy();
    expect(screen.queryByTestId('raffles-enter')).toBeNull();
  });
  it('flag OFF renders the legacy page', () => {
    h.flag.raffleV2 = false;
    mount();
    expect(screen.getByTestId('legacy-hero')).toBeTruthy();
    expect(screen.queryByTestId('raffles-board-counters')).toBeNull();
  });
});
