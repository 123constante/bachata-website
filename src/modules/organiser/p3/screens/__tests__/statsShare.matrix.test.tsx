// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SHAPES, statsOf, homeOf } from './fixtures';

/* Stats empty card x share card: the copy never points at a control in the wrong place,
   and a Copy link that cannot work is disabled with its reason. */

const homeQ = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const viewsQ = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const analyticsQ = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
const codeQ = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));

vi.mock('../../data/useP3Data', () => ({
  useP3Home: () => homeQ.value,
  useP3Views: () => viewsQ.value,
  useP3Analytics: () => analyticsQ.value,
  useP3ShareCode: () => codeQ.value,
}));
vi.mock('@/modules/going/useMyOrganiserGoingTotal', () => ({ useMyOrganiserGoingTotal: () => ({ view: { state: 'off' }, total: null }) }));
vi.mock('../GraceBanner', () => ({ GraceBanner: () => null }));

import { StatsScreen } from '../StatsScreen';
import { sumAnalytics, parseAnalyticsV2 } from '../../data/analyticsV2';

const ok = (data: unknown) => ({ isPending: false, isError: false, data, refetch: vi.fn() });
const LIVE = { code: 'abc', disabled: false };
const OFF = 'Your link is switched off. Ask the team.';
const NO_EVENT = 'Add an event to get a link';

type Shape = { name: string; rows: unknown[]; views: number; code: unknown; disabled: boolean; reason: string | null; empty: RegExp | null };
const WITH = /Copy your link above/;
const WITHOUT = /Add an event first\. Views start once an event is on the calendar\./;

const SHAPES_MATRIX: Shape[] = [
  { name: 'empty views + no event', rows: [], views: 0, code: LIVE, disabled: true, reason: NO_EVENT, empty: WITHOUT },
  { name: 'empty views + with event', rows: [SHAPES.weekly], views: 0, code: LIVE, disabled: false, reason: null, empty: WITH },
  { name: 'views + no live event (only a finished one)', rows: [SHAPES.ended], views: 5, code: LIVE, disabled: true, reason: NO_EVENT, empty: null },
  { name: 'views + with event', rows: [SHAPES.weekly], views: 5, code: LIVE, disabled: false, reason: null, empty: null },
  { name: 'link switched off, empty views', rows: [SHAPES.weekly], views: 0, code: { code: 'abc', disabled: true }, disabled: true, reason: OFF, empty: WITH },
  { name: 'link loading', rows: [SHAPES.weekly], views: 0, code: { isLoading: true }, disabled: true, reason: 'Getting your link…', empty: WITH },
];

beforeEach(() => {
  analyticsQ.value = ok(sumAnalytics([parseAnalyticsV2({ has_own_code: true, totals: {}, by_day: [] })]));
});
afterEach(cleanup);

describe('Stats share + empty copy x shape', () => {
  it.each(SHAPES_MATRIX)('$name', (s) => {
    homeQ.value = ok(homeOf(s.rows as never));
    viewsQ.value = ok(statsOf(s.rows.length ? [[(s.rows[0] as { series_id?: string; id?: string }).series_id ?? (s.rows[0] as { id: string }).id, 'Event', s.views]] : []));
    codeQ.value = (s.code as { isLoading?: boolean }).isLoading
      ? { isPending: true, isError: false, data: undefined, refetch: vi.fn() }
      : ok(s.code);
    render(<MemoryRouter><StatsScreen /></MemoryRouter>);

    const btn = screen.getByRole('button', { name: 'Copy link' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(s.disabled);
    if (s.reason) expect(screen.getByTestId('p3-share-reason').textContent).toBe(s.reason);
    else expect(screen.queryByTestId('p3-share-reason')).toBeNull();

    const card = screen.queryByTestId('p3-stats-none');
    if (!s.empty) { expect(card).toBeNull(); return; }
    const text = card!.textContent ?? '';
    expect(text).toMatch(s.empty);
    expect(text).not.toMatch(/below/i);
    if (s.reason === NO_EVENT) expect(text).not.toMatch(/copy link/i);
  });
});
