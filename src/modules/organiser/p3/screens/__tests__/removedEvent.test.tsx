// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SHAPES, ws } from './wsFixtures';
import { L } from '../../model';
import { statusOf } from '../../model/status';
import { P3_PATHS } from '../../shell/paths';

/* F-22, F-25: a removed event opens the Removed state; Remove leaves for Events with the words. */

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

describe('F-22 removed event', () => {
  it('statusOf: archived is Removed, ended is Finished (one mapping)', () => {
    expect(statusOf('archived', 'recurring', 'weekly', 0).label).toBe(L.removedTag);
    expect(statusOf('ended', 'recurring', 'weekly', 0).label).toBe(L.finished);
  });
  it.each([
    ['event page', <EventPage key="e" />, '/account/p3/events/:seriesId', P3_PATHS.event('ser-1')],
    ['prices screen', <PricesScreen key="p" />, '/account/p3/events/:seriesId/prices', `${P3_PATHS.event('ser-1')}/prices`],
  ])('archived %s opens the Removed state with the way onward', (_n, el, path, url) => {
    at('archived', el, path, url);
    expect(screen.getByTestId('p3-event-removed')).toBeTruthy();
    expect(screen.getByTestId('p3-status').textContent).toBe(L.removedTag);
    expect(screen.queryByTestId('p3-open-status')).toBeNull();
    expect(screen.getByText('See your events').getAttribute('href')).toBe(P3_PATHS.events);
  });
  it('an ended event still opens the page tagged Finished', () => {
    at('ended', <EventPage />, '/account/p3/events/:seriesId', P3_PATHS.event('ser-1'));
    expect(screen.getByTestId('p3-status').textContent).toBe(L.finished);
  });
  it('Remove goes to Events carrying the toast', async () => {
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
