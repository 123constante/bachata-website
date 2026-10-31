// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { HomeSeriesRow } from '../../data/home';
import { rowsOf } from '../../data/home';
import { nextUpAdviceOf } from '../../model';
import { P3_PATHS } from '../../shell/paths';
import { SHAPES, homeOf } from './fixtures';

/**
 * FIXLIST F-16 (HOME-COPY): Home's "Nothing coming up" card, for every prod shape INVENTORY.md
 * names (ended, live-past one-off, live-past course, live weekly with and without future dates,
 * archived, draft, 0 events). The words come from ONE mapping (model/status.ts nextUpAdviceOf),
 * never offer dates to an event that cannot take them, and only name a control on the card.
 */
const homeQ = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => homeQ.value, useP3Views: () => ({ isPending: true }) }));
vi.mock('@/modules/going/useMyOrganiserGoingTotal', () => ({ useMyOrganiserGoingTotal: () => ({ view: { state: 'off' }, total: null }) }));
vi.mock('../GraceBanner', () => ({ GraceBanner: () => null }));
vi.mock('../../../home/ClaimNotice', () => ({ ClaimNotice: () => null }));
import { HomeScreen } from '../HomeScreen';

const archived: HomeSeriesRow = { ...SHAPES.ended, id: 'archived', name: 'Removed Event', lifecycle_status: 'archived' };

/** `card`: archived is not listed (isListedSeries), so archived-only is the 0-events state. */
type Want = { control: 'events' | 'new' | null; says: RegExp; card?: string };
const CASES: Array<[string, HomeSeriesRow[], Want]> = [
  ['ended', [SHAPES.ended], { control: 'new', says: /Add an event and its next date shows here/ }],
  ['archived only', [archived], { control: 'new', says: /You can add one now/, card: 'p3-home-empty' }],
  ['archived beside ended', [archived, SHAPES.ended], { control: 'new', says: /Add an event and its next date shows here/ }],
  ['live-past one-off', [SHAPES.oneoffPast], { control: 'events', says: /cannot take new dates/ }],
  ['live-past course', [SHAPES.courseDone], { control: 'events', says: /cannot take new dates/ }],
  ['live-past one-off beside ended', [SHAPES.oneoffPast, SHAPES.ended], { control: 'events', says: /cannot take new dates/ }],
  ['live weekly, no future dates', [SHAPES.allCancelled], { control: 'events', says: /Your repeating event has no dates coming up. Open it in Events and add dates/ }],
  ['live weekly no future, beside a finished one-off', [SHAPES.oneoffPast, SHAPES.allCancelled], { control: 'events', says: /add dates/ }],
  ['draft', [SHAPES.draft], { control: 'events', says: /A draft is not live yet. Open it in Events and put it live/ }],
  ['paused with nothing else', [{ ...SHAPES.paused, upcoming_count: 0, next_dates: [] }], { control: 'events', says: /One of your events is hidden. Open it in Events and show it again/ }],
  ['live weekly with future dates', [SHAPES.weekly], { control: null, says: /./ }],
];

function renderHome(rows: HomeSeriesRow[]) {
  homeQ.value = { isPending: false, isError: false, isFetching: false, data: homeOf(rows), refetch: vi.fn() };
  return render(<MemoryRouter><HomeScreen /></MemoryRouter>);
}

afterEach(cleanup);

describe('F-16 Home next-up copy x every prod shape', () => {
  it.each(CASES)('%s', (_name, rows, want) => {
    renderHome(rows);
    if (want.control === null) {
      expect(screen.getByTestId('p3-nextup')).toBeTruthy();
      expect(screen.queryByTestId('p3-nextup-none')).toBeNull();
      return;
    }
    const card = screen.getByTestId(want.card ?? 'p3-nextup-none');
    const text = card.textContent ?? '';
    expect(text).toMatch(want.says);
    const links = within(card).getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe(want.control === 'new' ? P3_PATHS.newWhat : P3_PATHS.events);
    // never "Add dates" beside an event tagged Finished
    const finished = rowsOf(homeOf(rows)).every((r) => r.status.key === 'finished');
    if (finished) expect(text).not.toMatch(/add dates/i);
    // the card never names a control it does not show
    if (/Add an event/.test(text)) expect(links[0].textContent).toBe('Add an event');
    if (/Events/.test(text)) expect(want.control).toBe('events');
  });

  it('0 events: the empty state offers Add an event, and that control is on screen', () => {
    renderHome([]);
    const card = screen.getByTestId('p3-home-empty');
    expect(card.textContent).toMatch(/You can add one now/);
    expect(within(card).getByTestId('p3-add-event').getAttribute('href')).toBe(P3_PATHS.newWhat);
  });

  it('one shared mapping: Home renders exactly what nextUpAdviceOf says for the rows Events lists', () => {
    for (const [, rows, want] of CASES) {
      if (want.control === null || want.card) continue;
      const advice = nextUpAdviceOf(rowsOf(homeOf(rows)));
      expect(advice.action).toBe(want.control);
    }
  });
});
