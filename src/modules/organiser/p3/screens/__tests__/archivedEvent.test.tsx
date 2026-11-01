// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SHAPES, ws } from './wsFixtures';
import { L } from '../../model';
import { ARCHIVED_WHY, archivedStatus, statusOf } from '../../model/status';
import { REPEAT_WHY } from '../../model/repeat';
import { PUBLIC_PAGE_WHY, STATUS_COPY } from '../../data/eventPage';
import { P3_PATHS } from '../../shell/paths';

/* F-22, F-25: an archived event opens the Finished state; Remove leaves for Events with the words. */

const wsQ = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-25' }));
vi.mock('../../../shared/runCommands', () => ({
  useEventWorkspace: () => wsQ.value,
  useRunCommands: () => async () => 9,
  useSendOnce: () => async () => 9,
}));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ isPending: true, data: undefined }) }));

import { EventPage } from '../EventPage';
import { PricesScreen } from '../PricesScreen';
import { DetailsScreen } from '../DetailsScreen';
import { AllDatesScreen } from '../AllDatesScreen';
import { HistoryScreen } from '../HistoryScreen';
import { EventsScreen } from '../EventsScreen';

const ok = (k: keyof typeof SHAPES) => ({ isPending: false, isError: false, data: ws(k), error: null, refetch: vi.fn() });
const at = (k: keyof typeof SHAPES, el: JSX.Element, path: string, url: string) => {
  wsQ.value = ok(k);
  return render(<MemoryRouter initialEntries={[url]}><Routes>
    <Route path={path} element={el} />
    <Route path="/account/p3/events" element={<EventsScreen />} />
  </Routes></MemoryRouter>);
};
afterEach(cleanup);

/*
 * F-22, owner decision 2026-11-01: an archived event nobody removed reads "Finished", not
 * "Removed". The read never says who archived it (prod: 653 archived series, 39 with organisers
 * came from the legacy import), so every screen reads Finished; "Removed" is said only by the
 * Remove flow, to the person who just removed it.
 */
const LIFECYCLES = ['live', 'paused', 'draft', 'ended', 'archived', 'pending_review', 'changes_requested'] as const;
const FORMATS = ['recurring', 'one_off', 'course', 'festival', null] as const;
const KINDS = ['weekly', 'oneoff', 'course', 'festival', 'custom'] as const;
const UPCOMING = [0, 1, 150] as const;
const EVERY_SHAPE = LIFECYCLES.flatMap((lc) => FORMATS.flatMap((f) => KINDS.flatMap((k) => UPCOMING.map((u) => [lc, f, k, u] as const))));

describe('F-22 statusOf x every status shape (the one mapping)', () => {
  it.each(EVERY_SHAPE)('%s / %s / %s / %s upcoming', (lc, format, kind, up) => {
    const s = statusOf(lc, format, kind as never, up);
    expect(s.label).not.toBe(L.removedTag);
    expect(s.label).not.toMatch(/remov/i);
    if (lc === 'archived' || lc === 'ended') expect(s).toMatchObject({ key: 'finished', label: L.finished });
  });
  it('archived and ended read the same tag; archivedStatus is that tag', () => {
    expect(statusOf('archived', 'recurring', 'weekly', 0)).toEqual(statusOf('ended', 'recurring', 'weekly', 0));
    expect(archivedStatus()).toMatchObject({ key: 'finished', label: L.finished });
  });
  it('no archived copy claims someone removed it', () => {
    for (const why of [ARCHIVED_WHY, STATUS_COPY.archivedWhy, PUBLIC_PAGE_WHY.archived, REPEAT_WHY.archived]) {
      expect(why).not.toMatch(/remov/i);
      expect(why).toMatch(/finished/);
    }
    expect(STATUS_COPY.archivedWhy).toBe(ARCHIVED_WHY);
  });
});

describe('F-22 archived event on every screen', () => {
  it.each([
    ['event page', <EventPage key="e" />, '/account/p3/events/:seriesId', P3_PATHS.event('ser-1')],
    ['prices screen', <PricesScreen key="p" />, '/account/p3/events/:seriesId/prices', `${P3_PATHS.event('ser-1')}/prices`],
    ['details screen', <DetailsScreen key="d" />, '/account/p3/events/:seriesId/details', P3_PATHS.eventDetails('ser-1')],
    ['all dates screen', <AllDatesScreen key="a" />, '/account/p3/events/:seriesId/dates', P3_PATHS.eventDates('ser-1')],
    ['history screen', <HistoryScreen key="h" />, '/account/p3/events/:seriesId/history', P3_PATHS.eventHistory('ser-1')],
  ])('archived %s reads Finished with the way onward, never "removed"', (_n, el, path, url) => {
    at('archived', el, path, url);
    const card = screen.getByTestId('p3-event-archived');
    expect(screen.getByTestId('p3-status').textContent).toBe(L.finished);
    expect(card.textContent).toContain(ARCHIVED_WHY);
    expect(card.textContent).not.toMatch(/remov/i);
    expect(screen.queryByTestId('p3-open-status')).toBeNull();
    expect(screen.getByText('See your events').getAttribute('href')).toBe(P3_PATHS.events);
  });
  it('an ended event still opens the page tagged Finished', () => {
    at('ended', <EventPage />, '/account/p3/events/:seriesId', P3_PATHS.event('ser-1'));
    expect(screen.getByTestId('p3-status').textContent).toBe(L.finished);
  });
  it('Remove (someone actually removed it) goes to Events carrying "Removed from your events."', async () => {
    at('weekly', <EventPage />, '/account/p3/events/:seriesId', P3_PATHS.event('ser-1'));
    fireEvent.click(screen.getByTestId('p3-open-status'));
    fireEvent.click(screen.getByTestId('p3-status-row-remove'));
    fireEvent.click(screen.getByTestId('p3-remove-confirm'));
    expect((await screen.findByTestId('p3-toast')).textContent).toBe('Removed from your events.');
    expect(screen.queryByTestId('p3-event')).toBeNull();
  });
});

describe('F-25 a cover that does not load', () => {
  it('shows no broken image', () => {
    at('draftReady', <EventPage />, '/account/p3/events/:seriesId', P3_PATHS.event('ser-1'));
    const img = document.querySelector('img.p3-cover');
    expect(img).toBeTruthy();
    fireEvent.error(img);
    expect(document.querySelector('img.p3-cover')).toBeNull();
  });
});
