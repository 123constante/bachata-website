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
      const list = screen.queryByTestId('raffles-week-list');
      if (s.pageWeekWinners.length === 0) {
        expect(screen.getByTestId('raffles-week-empty').textContent).toBe(
          'No winners yet this week. Enter now and you could be next.');
      } else {
        for (const w of s.pageWeekWinners) expect(list?.textContent).toContain(w);
        expect(list?.textContent).toContain('The Cellar');
        expect(list?.textContent).toContain('Friday Social');
      }
    });
  }
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
