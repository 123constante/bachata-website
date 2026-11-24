// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
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
  RaffleEntryDialog: ({ open, onSubmitted }: { open: boolean; onSubmitted: () => void }) => (
    open ? <div data-testid="entry-dialog"><button type="button" data-testid="fake-submit" onClick={onSubmitted} /></div> : null
  ),
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

  it('hero totals: entries_ever / winners_ever win; label Winners ever; +1 after own entry; fallback when absent', () => {
    const withTotals = (extra: Record<string, unknown>) => parseRaffleBoard({
      pool_count: 521, winners_this_month: 1, total_winners: 766,
      nights: [night(), night({ occurrence_id: 'o2', public_event_id: 'e2', winner_first_name: 'Maya', start_local: '2026-11-22T20:00:00' })],
      winners: [], ...extra,
    });
    h.board = { ...h.board, data: withTotals({ entries_ever: 1400, winners_ever: 786 }) };
    mount();
    expect(screen.getByTestId('raffles-count-pool').textContent).toBe('1,400');
    expect(screen.getByTestId('raffles-count-winners').textContent).toBe('786');
    expect(screen.getByTestId('raffles-count-winners').parentElement?.textContent).toContain('Winners ever');
    expect(screen.getByTestId('raffles-count-winners').parentElement?.textContent).not.toContain('Prizes won');
    fireEvent.click(screen.getByTestId('raffles-enter'));
    fireEvent.click(screen.getByTestId('fake-submit'));
    expect(screen.getByTestId('raffles-count-pool').textContent).toBe('1,401');
    cleanup();
    window.sessionStorage.clear();
    window.localStorage.clear();
    h.board = { ...h.board, data: withTotals({}) };
    mount();
    expect(screen.getByTestId('raffles-count-pool').textContent).toBe('521');
    expect(screen.getByTestId('raffles-count-winners').textContent).toBe('1');
  });

  it('one card per event (its next night), no 13 cap', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-05T12:00:00Z')); // fixture nights are dated Nov/Dec 2026
    const nights: unknown[] = [];
    for (let e = 0; e < 20; e++) {
      const d = String(10 + (e % 18)).padStart(2, '0');
      nights.push(night({ occurrence_id: `late${e}`, public_event_id: `ev${e}`, title: `Event ${e}`, start_local: `2026-12-${d}T20:00:00` }));
      nights.push(night({ occurrence_id: `soon${e}`, public_event_id: `ev${e}`, title: `Event ${e}`, start_local: `2026-11-${d}T20:00:00` }));
    }
    h.board = { ...h.board, data: parseRaffleBoard({ pool_count: 5, winners_this_month: 0, total_winners: 0, nights, winners: [] }) };
    mount();
    expect(document.querySelectorAll('.rd-car > li')).toHaveLength(20);
    expect(screen.getByTestId('raffles-carousel-count').textContent).toBe('1 of 20');
    expect(screen.getByTestId('raffles-count-open').textContent).toBe('20');
    vi.useRealTimers();
  });

  it('broken flyer falls back to the initials tile', () => {
    h.board = { ...h.board, data: parseRaffleBoard({ pool_count: 5, winners_this_month: 0, total_winners: 0, nights: [night({ title: 'El Grande', poster_url: 'https://x.test/missing.webp' })], winners: [] }) };
    mount();
    const img = document.querySelector('.rd-car img.rd-flyer') as HTMLImageElement;
    expect(img).toBeTruthy();
    fireEvent.error(img);
    expect(document.querySelector('.rd-car img.rd-flyer')).toBeNull();
    expect(document.querySelector('.rd-car .rd-flyer-tile')?.textContent).toBe('EG');
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

describe('RaffleRedesignA gap-close B: entered cards, orb, party', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('not-entered card: Enter, no seal; tapping opens the dialog', () => {
    h.board = { ...h.board, data: board([]) };
    mount();
    const btn = screen.getByRole('button', { name: 'Enter Friday Social' });
    expect(btn.textContent).toBe('Enter');
    expect(screen.queryByTestId('raffles-card-seal')).toBeNull();
    expect(screen.queryByText(/You.re in$/)).toBeNull();
    fireEvent.click(btn);
    expect(screen.getByTestId('entry-dialog')).toBeTruthy();
  });

  it('entered card: You\u2019re in + seal; tapping does not open the dialog', () => {
    window.sessionStorage.setItem(rafflePoolJoinedKey, '1');
    window.localStorage.setItem(rafflePoolJoinedKey, '1');
    h.board = { ...h.board, data: board([]) };
    mount();
    const btn = screen.getByTestId('raffles-card-in');
    expect(btn.textContent).toBe('You\u2019re in');
    expect(btn.querySelector('svg')).toBeTruthy();
    expect(screen.getByTestId('raffles-card-seal')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Enter / })).toBeNull();
    fireEvent.click(btn);
    expect(screen.queryByTestId('entry-dialog')).toBeNull();
  });

  it('successful entry: orb n -> n+1, party class set then cleared after 4500ms, card flips to entered', () => {
    vi.useFakeTimers();
    h.board = { ...h.board, data: board([]) };
    mount();
    expect(screen.getByTestId('raffles-count-pool').textContent).toBe('1,234');
    const root = screen.getByTestId('raffles-redesign');
    expect(root.className).not.toContain('rd-party');
    fireEvent.click(screen.getByTestId('raffles-enter'));
    fireEvent.click(screen.getByTestId('fake-submit'));
    expect(screen.getByTestId('raffles-count-pool').textContent).toBe('1,235');
    expect(root.className).toContain('rd-party');
    expect(screen.getByTestId('raffles-card-seal')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(4400); });
    expect(root.className).toContain('rd-party');
    act(() => { vi.advanceTimersByTime(200); });
    expect(root.className).not.toContain('rd-party');
  });
});
