// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { parseRaffleBoard, recentWinnersForWall } from '@/lib/raffleBoard';
import { BOARD_SHAPES, EVENT_ID } from '@/lib/__tests__/raffleBoardFixtures';

const h = vi.hoisted(() => ({
  flag: { raffleV2: true, raffleTileSheet: false, rafflesPage: false, raffleWinnersWall: false } as Record<string, boolean>,
  board: { data: undefined as unknown, isError: false, isLoading: false, refetch: vi.fn() },
}));

vi.mock('@/lib/featureFlags', () => ({ flags: h.flag }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('@/hooks/useRaffleBoard', () => ({ useRaffleBoard: () => h.board }));
vi.mock('@/hooks/useEventRaffleConfig', () => ({
  useEventRaffleConfig: () => ({ config: null, loading: false, refresh: vi.fn() }),
}));
vi.mock('@/modules/event-page/bento/modals/RaffleEntryDialog', () => ({ RaffleEntryDialog: () => null }));
vi.mock('@/modules/event-page/bento/BentoGrid', () => ({
  BLOCK_COLORS: { raffle: 'x' }, BLOCK_TITLES: { raffle: 'Raffle' },
}));
vi.mock('@/modules/event-page/bento/BentoTile', () => ({
  BentoTile: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}));

import { RaffleBlock } from '../RaffleBlock';

const mount = () => render(<MemoryRouter><RaffleBlock eventId={EVENT_ID} /></MemoryRouter>);
const names = ['Ana', 'Ben', 'Cy', 'Di', 'Eli', 'Flo', 'Gus', 'Hal'];

beforeEach(() => {
  cleanup();
  window.sessionStorage.clear();
  window.localStorage.clear();
  h.flag.raffleWinnersWall = false;
  const s = BOARD_SHAPES.find((x) => x.json !== null)!;
  const json = { ...(s.json as Record<string, unknown>), winners: names.map((n) => ({ first_name: n, night_title: 'N' })) };
  h.board = { ...h.board, data: parseRaffleBoard(json), isError: false, isLoading: false };
});

const join = () => window.localStorage.setItem('bcal_raffle_pool_joined', '1');

describe('RaffleBlock winners wall flag', () => {
  for (const on of [false, true]) {
    it(`flag ${on ? 'on' : 'off'}, joined: keep-list still renders`, () => {
      h.flag.raffleWinnersWall = on;
      join();
      mount();
      expect(screen.getByText('Win a free night')).toBeTruthy();
      expect(screen.getByTestId('raffle-youre-in')).toBeTruthy();
      expect(screen.queryByTestId('raffle-more-chances') !== null).toBe(on);
      expect(screen.queryByTestId('raffle-winners-wall') !== null).toBe(on);
    });
  }
  it('flag on, joined: 6 winners, warm copy, no rejection words', () => {
    h.flag.raffleWinnersWall = true;
    join();
    const { container } = mount();
    expect(screen.getAllByTestId('raffle-wall-winner')).toHaveLength(6);
    expect(screen.getByText('Recent winners')).toBeTruthy();
    expect(screen.getByText('This could be you next.')).toBeTruthy();
    expect(container.textContent).not.toMatch(/\b(lost|lose|rejected|not picked)\b/i);
  });
  it('flag on, not joined: no wall', () => {
    h.flag.raffleWinnersWall = true;
    mount();
    expect(screen.queryByTestId('raffle-winners-wall')).toBeNull();
    expect(screen.getByText('Free to enter')).toBeTruthy();
  });
  it('recentWinnersForWall: empty board gives none', () => {
    expect(recentWinnersForWall(parseRaffleBoard(null))).toEqual([]);
  });
});
