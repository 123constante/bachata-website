// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { parseRaffleBoard } from '@/lib/raffleBoard';
import { rafflePoolJoinedKey } from '@/lib/raffleSession';
import { BOARD_SHAPES, EVENT_ID } from '@/lib/__tests__/raffleBoardFixtures';

const h = vi.hoisted(() => ({
  flag: { raffleV2: true },
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

beforeEach(() => {
  cleanup();
  window.sessionStorage.clear();
  window.localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  h.flag.raffleV2 = true;
});

afterEach(() => { vi.useRealTimers(); });

describe('RaffleBlock board tile: shape x screen', () => {
  for (const s of BOARD_SHAPES) {
    it(`${s.name}`, () => {
      h.board = { ...h.board, data: s.json === null ? undefined : parseRaffleBoard(s.json), isError: s.json === null, isLoading: false };
      vi.setSystemTime(new Date('2026-11-05T12:00:00Z'));
      mount();
      expect(screen.getByText('Win a free night')).toBeTruthy(); // marquee, tile never hides
      expect(screen.queryByTestId('raffle-elsewhere-heading') !== null).toBe(!s.tileInRaffle && !s.tileNote);
      const strip = screen.queryByTestId('raffle-winner-strip');
      if (s.tileWinner) expect(strip?.textContent).toContain(s.tileWinner);
      else expect(strip).toBeNull();
      if (s.seeWho) expect(screen.getByTestId('raffle-see-who-won').getAttribute('href')).toBe('/raffles');
      else expect(screen.queryByTestId('raffle-see-who-won')).toBeNull();
      expect(screen.queryByTestId('raffle-board-empty') !== null).toBe(s.tileNote === 'empty');
      expect(screen.queryByTestId('raffle-board-error') !== null).toBe(s.tileNote === 'error');
    });
  }
  it('loading: no elsewhere heading, a status line', () => {
    h.board = { ...h.board, data: undefined, isError: false, isLoading: true };
    mount();
    expect(screen.queryByTestId('raffle-elsewhere-heading')).toBeNull();
    expect(screen.getByTestId('raffle-board-loading')).toBeTruthy();
  });
  it('error: retry button, no elsewhere heading, 44px target', () => {
    const refetch = vi.fn();
    h.board = { ...h.board, data: undefined, isError: true, isLoading: false, refetch };
    mount();
    expect(screen.queryByTestId('raffle-elsewhere-heading')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(refetch).toHaveBeenCalled();
    const css = readFileSync('src/modules/event-page/bento/blocks/RaffleBlock.css', 'utf8');
    expect(css).toMatch(/\.rsb-board-note button \{[^}]*min-height: 44px/);
    expect(css).toMatch(/\.rsb-see-who-won \{[^}]*min-height: 44px/);
  });
  it('You are in from localStorage (a later visit, sessionStorage empty)', () => {
    window.localStorage.setItem(rafflePoolJoinedKey, '1');
    h.board = { ...h.board, data: parseRaffleBoard(BOARD_SHAPES[1].json), isError: false, isLoading: false };
    mount();
    expect(screen.getByTestId('raffle-youre-in')).toBeTruthy();
  });
});

describe("You're in x key", () => {
  it('key set -> persistent You are in, no lever', () => {
    window.sessionStorage.setItem(rafflePoolJoinedKey, '1');
    h.board = { ...h.board, data: parseRaffleBoard(BOARD_SHAPES[1].json), isError: false, isLoading: false };
    mount();
    expect(screen.getByTestId('raffle-youre-in')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /lever/i })).toBeNull();
  });
  it('key absent -> no You are in, lever present', () => {
    h.board = { ...h.board, data: parseRaffleBoard(BOARD_SHAPES[1].json), isError: false, isLoading: false };
    mount();
    expect(screen.queryByTestId('raffle-youre-in')).toBeNull();
    expect(screen.getByRole('button', { name: /lever/i })).toBeTruthy();
  });
});

describe('flag OFF renders as main', () => {
  it('no v2 copy (legacy block renders nothing without a config)', () => {
    h.flag.raffleV2 = false;
    h.board = { ...h.board, data: parseRaffleBoard(BOARD_SHAPES[1].json), isError: false, isLoading: false };
    const { container } = mount();
    expect(container.textContent).toBe('');
    expect(screen.queryByTestId('raffle-see-who-won')).toBeNull();
  });
});
