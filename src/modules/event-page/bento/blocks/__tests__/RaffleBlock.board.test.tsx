// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { parseRaffleBoard } from '@/lib/raffleBoard';
import { rafflePoolJoinedKey } from '@/lib/raffleSession';
import { BOARD_SHAPES, EVENT_ID } from '@/lib/__tests__/raffleBoardFixtures';

const h = vi.hoisted(() => ({
  flag: { raffleV2: true },
  board: { data: undefined as unknown, isError: false },
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

beforeEach(() => {
  cleanup();
  window.sessionStorage.clear();
  h.flag.raffleV2 = true;
});

describe('RaffleBlock board tile: shape x screen', () => {
  for (const s of BOARD_SHAPES) {
    it(`${s.name}`, () => {
      h.board = { data: s.json === null ? undefined : parseRaffleBoard(s.json), isError: s.json === null };
      mount();
      expect(screen.getByText('Win a free night')).toBeTruthy(); // marquee, tile never hides
      expect(screen.queryByTestId('raffle-elsewhere-heading') !== null).toBe(!s.tileInRaffle);
      const strip = screen.queryByTestId('raffle-winner-strip');
      if (s.tileWinner) expect(strip?.textContent).toContain(s.tileWinner);
      else expect(strip).toBeNull();
      expect(screen.getByTestId('raffle-see-who-won').getAttribute('href')).toBe('/raffles');
    });
  }
});

describe("You're in x key", () => {
  it('key set -> persistent You are in, no lever', () => {
    window.sessionStorage.setItem(rafflePoolJoinedKey, '1');
    h.board = { data: parseRaffleBoard(BOARD_SHAPES[1].json), isError: false };
    mount();
    expect(screen.getByTestId('raffle-youre-in')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /lever/i })).toBeNull();
  });
  it('key absent -> no You are in, lever present', () => {
    h.board = { data: parseRaffleBoard(BOARD_SHAPES[1].json), isError: false };
    mount();
    expect(screen.queryByTestId('raffle-youre-in')).toBeNull();
    expect(screen.getByRole('button', { name: /lever/i })).toBeTruthy();
  });
});

describe('flag OFF renders as main', () => {
  it('no v2 copy (legacy block renders nothing without a config)', () => {
    h.flag.raffleV2 = false;
    h.board = { data: parseRaffleBoard(BOARD_SHAPES[1].json), isError: false };
    const { container } = mount();
    expect(container.textContent).toBe('');
    expect(screen.queryByTestId('raffle-see-who-won')).toBeNull();
  });
});
