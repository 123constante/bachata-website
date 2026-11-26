// @vitest-environment jsdom
/**
 * homeOneRow (site structure S2d-1): ONE filter row on home -- Today, Weekend, Near me, Party, Class,
 * Festival -- and no folder tabs. Keep-list: flag OFF keeps the old words exactly (All first).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const flagsMock = vi.hoisted(() => ({ value: {} as Record<string, boolean> }));
vi.mock('@/lib/featureFlags', async (orig) => {
  const real = await orig<typeof import('@/lib/featureFlags')>();
  return { ...real, flags: new Proxy({}, { get: (_t, k: string) => flagsMock.value[k] ?? false }) };
});

import { PosterRow, posterWords, whenKeys, nextPosterSel, type PosterSel } from '../PosterRow';

afterEach(cleanup);
const geo = { status: 'idle' as const, request: () => {}, clear: () => {} };

describe('posterWords', () => {
  it('one row: Today, Weekend, Near me, Party, Class, Festival (no All)', () => {
    expect(posterWords(true, 'Near me').map((w) => w.label)).toEqual(['Today', 'Weekend', 'Near me', 'Party', 'Class', 'Festival']);
  });
  it('flag off keeps the old words', () => {
    expect(posterWords(false, 'Near me').map((w) => w.label)).toEqual(['All', 'Near me', 'Party', 'Class', 'Festival']);
  });
});

describe('whenKeys', () => {
  // 2026-11-23 is a Monday.
  it('today = that day only', () => {
    expect([...whenKeys('today', '2026-11-23')]).toEqual(['2026-11-23']);
  });
  it.each([
    ['2026-11-23', ['2026-11-27', '2026-11-28', '2026-11-29']], // Mon -> coming Fri-Sun
    ['2026-11-26', ['2026-11-27', '2026-11-28', '2026-11-29']], // Thu
    ['2026-11-27', ['2026-11-27', '2026-11-28', '2026-11-29']], // Fri
    ['2026-11-28', ['2026-11-28', '2026-11-29']], // Sat -> rest of THIS weekend
    ['2026-11-29', ['2026-11-29']], // Sun
  ])('weekend from %s', (today, want) => {
    expect([...whenKeys('weekend', today)]).toEqual(want);
  });
});

describe('PosterRow with homeOneRow', () => {
  it('renders six words, Today pressed, tapping it again clears to everything', () => {
    flagsMock.value = { homePolish: true, homeFeedLook: true, homeOneRow: true };
    const onSelect = vi.fn<(s: PosterSel) => void>();
    render(<PosterRow geo={geo} sel="today" onSelect={onSelect} />);
    const btns = screen.getAllByRole('button');
    expect(btns.map((b) => b.textContent)).toEqual(['Today', 'Weekend', 'Near me', 'Party', 'Class', 'Festival']);
    expect(btns.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent)).toEqual(['Today']);
    fireEvent.click(btns[0]);
    expect(onSelect).toHaveBeenLastCalledWith('all');
    fireEvent.click(btns[1]);
    expect(onSelect).toHaveBeenLastCalledWith('weekend');
    expect(nextPosterSel('weekend', 'party')).toBe('party');
  });
});

describe('home shell source (flag wiring)', () => {
  const shell = readFileSync(resolve(__dirname, '../../home-map/HomeMapShell.tsx'), 'utf8');
  it('hides the folder tabs and pins the list under homeOneRow', () => {
    expect(shell).toMatch(/flags\.homeFeedLook && !oneRow &&/);
    expect(shell).toMatch(/const tab = oneRow \? 'all' : state\.tab;/);
  });
});
