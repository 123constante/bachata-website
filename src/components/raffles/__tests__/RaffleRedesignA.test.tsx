// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { parseRaffleBoard } from '@/lib/raffleBoard';
import { rafflePoolJoinedKey } from '@/lib/raffleSession';

const h = vi.hoisted(() => ({ board: { data: undefined as unknown, isError: false, isLoading: false, refetch: vi.fn() } }));

vi.mock('@/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('@/hooks/useRaffleBoard', () => ({ useRaffleBoard: () => h.board }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/lib/breadcrumbs', () => ({ buildBreadcrumbs: () => [] }));
vi.mock('@/lib/seo', () => ({ buildSeoForRoute: () => ({}), useSeo: () => {} }));
vi.mock('@/modules/event-page/bento/modals/RaffleEntryDialog', () => ({
  RaffleEntryDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="entry-dialog" /> : null),
}));

import { RaffleRedesignA } from '../RaffleRedesignA';

const night = (o: Record<string, unknown> = {}) => ({
  occurrence_id: 'o1', public_event_id: 'e1', title: 'Friday Social', start_local: '2026-11-27T20:00:00',
  venue_name: 'The Cellar', winner_first_name: null, ...o,
});
const board = (winners: unknown[]) => parseRaffleBoard({
  pool_count: 1234, winners_this_month: 1, total_winners: 766,
  nights: [night(), night({ occurrence_id: 'o2', public_event_id: 'e2', winner_first_name: 'Maya', start_local: '2026-11-22T20:00:00' })],
  winners,
});
const mount = () => render(<MemoryRouter><RaffleRedesignA /></MemoryRouter>);

beforeEach(() => {
  cleanup();
  window.sessionStorage.clear();
  window.localStorage.clear();
  // reduced motion: counts final at once, reveal immediate
  window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
});

describe('RaffleRedesignA keep-list', () => {
  it('hero, orbs, steps, carousel, winners, footer, bar', () => {
    h.board = { ...h.board, data: board([{ first_name: 'Maya', last_initial: 'R', night_title: 'Bachata Sensual Fridays' }]) };
    mount();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Win a free night');
    expect(screen.getByTestId('raffles-count-pool').textContent).toBe('1,234');
    expect(screen.getByTestId('raffles-count-open').textContent).toBe('1');
    expect(screen.getByTestId('raffles-count-winners').textContent).toBe('1');
    for (const s of ['Pick a night', 'Add your phone', 'Win a free entry']) expect(screen.getAllByText(s).length).toBeGreaterThan(0);
    expect(document.querySelector('.rd-car')).toBeTruthy();

    expect(screen.getByRole('heading', { level: 2, name: /This week.s winners/ })).toBeTruthy();
    const wins = screen.getByTestId('raffles-recent-winners');
    expect(wins.textContent).toContain('Maya R.');
    expect(wins.textContent).toContain('Bachata Sensual Fridays');
    expect(wins.textContent).toContain('won a free entry');
    expect(wins.querySelectorAll('a')).toHaveLength(0);
    expect(wins.textContent).not.toContain('View profile');

    const foot = document.querySelector('footer') as HTMLElement;
    expect(Array.from(foot.querySelectorAll('a')).map((a) => a.textContent)).toEqual(['Rules', 'Contact']);
    expect(foot.textContent).toContain('Free to enter · one phone number per night. We only use it to message winners.');
    expect(foot.textContent).not.toMatch(/Privacy|Reset/);

    expect(screen.queryByTestId('raffles-youre-in')).toBeNull();
    fireEvent.click(screen.getByTestId('raffles-enter'));
    expect(screen.getByTestId('entry-dialog')).toBeTruthy();
  });

  it('winner without last_initial or profile_slug shows the first name only; section hidden with none', () => {
    h.board = { ...h.board, data: board([{ first_name: 'Tom', night_title: 'Luna' }]) };
    mount();
    const b = screen.getByTestId('raffles-recent-winners').querySelector('b');
    expect(b?.textContent).toBe('Tom');
    cleanup();
    h.board = { ...h.board, data: board([]) };
    mount();
    expect(screen.queryByTestId('raffles-recent-winners')).toBeNull();
  });

  it('sticky bar entered state: tick, copy, no Reset, no enter button', () => {
    window.sessionStorage.setItem(rafflePoolJoinedKey, '1');
    window.localStorage.setItem(rafflePoolJoinedKey, '1');
    h.board = { ...h.board, data: board([]) };
    mount();
    const bar = screen.getByTestId('raffles-sticky-bar');
    expect(screen.getByTestId('raffles-youre-in').textContent).toContain('You’re in for every night');
    expect(bar.querySelector('svg')).toBeTruthy();
    expect(screen.queryByTestId('raffles-enter')).toBeNull();
    expect(bar.textContent).not.toMatch(/Reset/);
  });
});
