// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SHAPES as BASE, statsOf, homeOf } from './fixtures';

const SHAPES = { weekly: { ...BASE.weekly, slug: 'sensual-fridays' }, ended: { ...BASE.ended, slug: 'old-mondays' } };

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
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u-share' } }) }));
vi.mock('../GraceBanner', () => ({ GraceBanner: () => null }));

import { StatsScreen } from '../StatsScreen';
import { sumAnalytics, parseAnalyticsV2 } from '../../data/analyticsV2';

const ok = (data: unknown) => ({ isPending: false, isError: false, data, refetch: vi.fn() });
const LIVE = { code: 'abc', disabled: false };
const OFF = 'Your link is switched off. Ask the team.';
const NO_EVENT = 'Put an event live to get a link';

type Shape = { name: string; rows: unknown[]; views: number; code: unknown; disabled: boolean; reason: string | null; empty: RegExp | null };
const WITH = /Copy your link above/;
const NO_CODE = 'Your link isn\u2019t ready yet. Try again shortly.';
const OFFTEXT = /switched off, so ask the team/;
const SOON = /Your link will appear above shortly/;
const WITHOUT = /Put an event live first\. Views start once an event is on the calendar\./;

const SHAPES_MATRIX: Shape[] = [
  { name: 'empty views + no event', rows: [], views: 0, code: LIVE, disabled: true, reason: NO_EVENT, empty: WITHOUT },
  { name: 'empty views + with event', rows: [SHAPES.weekly], views: 0, code: LIVE, disabled: false, reason: null, empty: WITH },
  { name: 'views + no live event (only a finished one)', rows: [SHAPES.ended], views: 5, code: LIVE, disabled: true, reason: NO_EVENT, empty: null },
  { name: 'views + with event', rows: [SHAPES.weekly], views: 5, code: LIVE, disabled: false, reason: null, empty: null },
  { name: 'link switched off, empty views', rows: [SHAPES.weekly], views: 0, code: { code: 'abc', disabled: true }, disabled: true, reason: OFF, empty: OFFTEXT },
  { name: 'ended-only + 0 views', rows: [SHAPES.ended], views: 0, code: LIVE, disabled: true, reason: NO_EVENT, empty: WITHOUT },
  { name: 'no code yet, with event', rows: [SHAPES.weekly], views: 0, code: { code: null, disabled: false }, disabled: true, reason: NO_CODE, empty: SOON },
  { name: 'link loading', rows: [SHAPES.weekly], views: 0, code: { isLoading: true }, disabled: true, reason: 'Getting your link\u2026', empty: SOON },
];

beforeEach(() => {
  analyticsQ.value = ok({ hidden: false, data: sumAnalytics([parseAnalyticsV2({ has_own_code: true, totals: {}, by_day: [] })]) });
});
afterEach(cleanup);

describe('Stats share + empty copy x shape', () => {
  it('page B: the card shows B\u2019s next event and code, never A\u2019s', () => {
    const org = (id: string, sid: string) => ({ id, name: id, slug: null, avatar_url: null, city_id: null, lifecycle_status: 'live', role: 'owner', latest_decision: null, series: [{ ...SHAPES.weekly, id: sid, slug: `slug-${sid}`, series_id: sid }] });
    homeQ.value = ok({ ...homeOf([]), organisers: [org('A', 'sa'), org('B', 'sb')] });
    viewsQ.value = ok(statsOf([]));
    codeQ.value = ok({ code: 'x', disabled: false });
    render(<MemoryRouter initialEntries={['/?o=B']}><StatsScreen /></MemoryRouter>);
    const t = (screen.queryByTestId('p3-share-link-text') as HTMLInputElement | null)?.value ?? '';
    expect(t).toContain('/event/slug-sb?');
    expect(t).not.toContain('/event/slug-sa?');
    expect(t).not.toContain('/event/sb?');
  });

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

  it('the link is the slug, never the series id', () => {
    homeQ.value = ok(homeOf([SHAPES.weekly as never]));
    viewsQ.value = ok(statsOf([]));
    codeQ.value = ok(LIVE);
    render(<MemoryRouter><StatsScreen /></MemoryRouter>);
    const t = (screen.getByTestId('p3-share-link-text') as HTMLInputElement).value;
    expect(t).toMatch(/\/event\/sensual-fridays\?ref=abc$/);
    expect(t).not.toContain('/event/weekly');
  });

  it('a live row with no public ref: Copy disabled with a reason, no broken link', () => {
    homeQ.value = ok(homeOf([{ ...SHAPES.weekly, slug: null } as never]));
    viewsQ.value = ok(statsOf([]));
    codeQ.value = ok(LIVE);
    render(<MemoryRouter><StatsScreen /></MemoryRouter>);
    expect(screen.queryByTestId('p3-share-link-text')).toBeNull();
    expect((screen.getByRole('button', { name: 'Copy link' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('p3-share-reason').textContent).toBe('Your event has no public address yet. Ask the team.');
    expect(screen.getByTestId('p3-stats-none').textContent).toMatch(/no public address yet/);
  });
});

/* Analytics refused for this role (organiser_analytics_v2 is owner / manager of the series):
   the views stay, the new tiles and the share card hide, and there is no Retry that can never work. */
const refused = { isPending: false, isError: false, data: { hidden: true, data: null }, refetch: vi.fn() };
const ANALYTICS_STATES: Array<{ name: string; q: Record<string, unknown>; code: Record<string, unknown>; tiles: boolean; card: boolean; views: number }> = [
  { name: 'refused, with views: the page share card stays', q: refused, code: ok(LIVE), tiles: false, card: true, views: 5 },
  { name: 'refused, no views', q: refused, code: ok(LIVE), tiles: false, card: true, views: 0 },
  { name: 'refused analytics and refused share code', q: refused, code: { isPending: false, isError: true, error: { code: '42501', message: 'not_allowed' }, data: undefined, refetch: vi.fn() }, tiles: false, card: false, views: 5 },
  { name: 'analytics still loading: views render first', q: { isPending: true, isError: false, data: undefined, refetch: vi.fn() }, code: ok(LIVE), tiles: false, card: true, views: 5 },
  { name: 'allowed', q: { isPending: false, isError: false, data: { hidden: false, data: sumAnalytics([parseAnalyticsV2({ totals: { visitors: 4 } })]) }, refetch: vi.fn() }, code: ok(LIVE), tiles: true, card: true, views: 5 },
];

describe('Stats x analytics state', () => {
  it.each(ANALYTICS_STATES)('$name', (s) => {
    homeQ.value = ok(homeOf([SHAPES.weekly as never]));
    viewsQ.value = ok(statsOf([['weekly', 'Event', s.views]]));
    analyticsQ.value = s.q;
    codeQ.value = s.code;
    render(<MemoryRouter><StatsScreen /></MemoryRouter>);
    expect(screen.queryByTestId('p3-stats-error')).toBeNull();
    expect(screen.queryByTestId('p3-stats-loading')).toBeNull();
    expect(screen.getByTestId('p3-stats-total').textContent).toContain(String(s.views));
    expect(!!screen.queryByTestId('p3-stats-visitors')).toBe(s.tiles);
    expect(!!screen.queryByTestId('p3-stats-from-link')).toBe(s.tiles);
    expect(!!screen.queryByTestId('p3-share-link-card')).toBe(s.card);
    if (!s.card) expect(screen.queryByRole('button', { name: /try again/i })).toBeNull();
    const none = screen.queryByTestId('p3-stats-none')?.textContent ?? '';
    if (!s.card) expect(none).not.toMatch(/link/i);
  });

  it('mixed: one series refused, another dropped: hidden, no analytics Try again', () => {
    homeQ.value = ok(homeOf([SHAPES.weekly as never]));
    viewsQ.value = ok(statsOf([['weekly', 'Event', 3]]));
    analyticsQ.value = refused;
    codeQ.value = ok(LIVE);
    render(<MemoryRouter><StatsScreen /></MemoryRouter>);
    expect(screen.queryByTestId('p3-stats-analytics-error')).toBeNull();
  });

  it('analytics network error: views stay; only the tiles offer Try again', () => {
    homeQ.value = ok(homeOf([SHAPES.weekly as never]));
    viewsQ.value = ok(statsOf([['weekly', 'Event', 3]]));
    analyticsQ.value = { isPending: false, isError: true, error: { message: 'Failed to fetch' }, data: undefined, refetch: vi.fn() };
    codeQ.value = ok(LIVE);
    render(<MemoryRouter><StatsScreen /></MemoryRouter>);
    expect(screen.queryByTestId('p3-stats-error')).toBeNull();
    expect(screen.getByTestId('p3-stats-total').textContent).toContain('3');
    expect(screen.getByTestId('p3-stats-analytics-error')).toBeTruthy();
  });

  it('views error still shows the error card with Try again', () => {
    homeQ.value = ok(homeOf([SHAPES.weekly as never]));
    viewsQ.value = { isPending: false, isError: true, data: undefined, refetch: vi.fn() };
    analyticsQ.value = refused;
    codeQ.value = ok(LIVE);
    render(<MemoryRouter><StatsScreen /></MemoryRouter>);
    expect(screen.getByTestId('p3-stats-error')).toBeTruthy();
  });
});
