// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { parseRaffleBoard } from '@/lib/raffleBoard';
import { BOARD_SHAPES, EVENT_ID } from '@/lib/__tests__/raffleBoardFixtures';

const h = vi.hoisted(() => ({
  flag: { raffleV2: true, raffleTileSheet: false, rafflesPage: false } as Record<string, boolean>,
  board: { data: undefined as unknown, isError: false, isLoading: false, refetch: vi.fn() },
  dialogProps: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/lib/featureFlags', () => ({ flags: h.flag }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('@/hooks/useRaffleBoard', () => ({ useRaffleBoard: () => h.board }));
vi.mock('@/hooks/useEventRaffleConfig', () => ({
  useEventRaffleConfig: () => ({ config: null, loading: false, refresh: vi.fn() }),
}));
vi.mock('@/modules/event-page/bento/modals/RaffleEntryDialog', () => ({
  RaffleEntryDialog: (p: Record<string, unknown>) => { h.dialogProps.push(p); return null; },
}));
vi.mock('@/modules/event-page/bento/BentoGrid', () => ({
  BLOCK_COLORS: { raffle: 'x' }, BLOCK_TITLES: { raffle: 'Raffle' },
}));
vi.mock('@/modules/event-page/bento/BentoTile', () => ({
  BentoTile: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}));

import { RaffleBlock } from '../RaffleBlock';

const mount = () => render(<MemoryRouter><RaffleBlock eventId={EVENT_ID} /></MemoryRouter>);

beforeEach(() => {
  cleanup();
  window.sessionStorage.clear();
  window.localStorage.clear();
  h.dialogProps.length = 0;
  h.flag.raffleV2 = true;
  h.flag.rafflesPage = false;
  const s = BOARD_SHAPES.find((x) => x.json !== null)!;
  h.board = { ...h.board, data: parseRaffleBoard(s.json), isError: false, isLoading: false };
});

describe('RaffleBlock tile sheet flag', () => {
  for (const on of [false, true]) {
    it(`flag ${on ? 'on' : 'off'}: keep-list still renders`, () => {
      h.flag.raffleTileSheet = on;
      mount();
      expect(screen.getByText('Win a free night')).toBeTruthy();
      expect(screen.getByText('Free to enter')).toBeTruthy();
      expect(screen.getByLabelText('Pull the lever to enter the raffle')).toBeTruthy();
      expect(screen.queryByTestId('raffle-tap-line') !== null).toBe(on);
      expect(h.dialogProps[h.dialogProps.length - 1]?.redesign).toBe(on);
    });
  }
  it('flag on + rafflesPage off: no See who won link', () => {
    h.flag.raffleTileSheet = true;
    mount();
    expect(screen.queryByTestId('raffle-see-who-won')).toBeNull();
  });
});
