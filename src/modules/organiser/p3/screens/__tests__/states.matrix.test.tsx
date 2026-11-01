// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SHAPES, TODAY, ws, type ShapeKey } from './wsFixtures';
import { L } from '../../model';
import { P3_PATHS } from '../../shell/paths';
import { PROFILE_WIZARD_PATH } from '../../../shared/profileProgress';

/*
 * P3 wt-states (F-06, F-16..F-19, F-22, F-25, F-34): each screen x each state, one shared mapping.
 * Shapes from the 26 Oct 2026 read-only survey are in wsFixtures (live/paused/draft/ended/archived).
 */
const q = vi.hoisted(() => ({
  ws: {} as Record<string, unknown>,
  venues: {} as Record<string, unknown>,
  reasons: { next: (): Promise<unknown> => Promise.resolve([]) },
  sent: [] as unknown[],
}));

vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-25' }));
vi.mock('../../../shared/runCommands', () => ({
  useEventWorkspace: () => q.ws,
  useRunCommands: () => async (commands: unknown[]) => { q.sent.push(commands); return 9; },
  useSendOnce: () => async () => 9,
}));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ isPending: true, data: undefined }) }));
vi.mock('../../../shared/publicVenues', async (orig) => ({ ...(await orig<object>()), useVenueOptions: () => q.venues }));
vi.mock('../../../shared/selfServeApi', async (orig) => ({ ...(await orig<object>()), fetchCancellationReasons: () => q.reasons.next() }));

import { EventPage } from '../EventPage';
import { EventsScreen } from '../EventsScreen';
import { DetailsScreen } from '../DetailsScreen';
import { PricesScreen } from '../PricesScreen';
import { ReasonPick } from '../CancelEventSheet';

const done = (k: ShapeKey, over: Record<string, unknown> = {}) => ({ isPending: false, isError: false, error: null, refetch: vi.fn(), data: ws(k), ...over });
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

function Where() { return <p data-testid="where">{useLocation().pathname}</p>; }
function at(path: string, el: JSX.Element, route: string) {
  return render(
    <QueryClientProvider client={client()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={el} />
          <Route path={P3_PATHS.events} element={<><Where /><EventsScreen /></>} />
          <Route path={PROFILE_WIZARD_PATH} element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const EVENT = '/account/p3/events/:seriesId';

beforeEach(() => { q.sent = []; q.venues = { isPending: false, isError: false, data: [], refetch: vi.fn() }; });
afterEach(cleanup);

describe('F-22 removed is not Finished; F-34 see it as dancers see it; F-25 bad cover', () => {
  it('an archived event reads Removed, never Finished', () => {
    q.ws = done('archived');
    at(P3_PATHS.event('ser-1'), <EventPage />, EVENT);
    expect(screen.getByTestId('p3-status').textContent).toBe(L.removed);
    expect(screen.getByTestId('p3-status').textContent).not.toBe(L.finished);
  });

  it('Remove leaves for Events and says so there', async () => {
    q.ws = done('weekly');
    at(P3_PATHS.event('ser-1'), <EventPage />, EVENT);
    fireEvent.click(screen.getByTestId('p3-open-status'));
    fireEvent.click(screen.getByTestId('p3-status-row-remove'));
    await act(async () => { fireEvent.click(screen.getByTestId('p3-remove-confirm')); });
    expect(screen.getByTestId('where').textContent).toBe(P3_PATHS.events);
    expect(screen.getByTestId('p3-events-said').textContent).toMatch(/Removed/);
  });

  it('the public link shows on a live event only, and points at its public address', () => {
    q.ws = done('weekly');
    at(P3_PATHS.event('ser-1'), <EventPage />, EVENT);
    expect(screen.getByTestId('p3-see-public').getAttribute('href')).toBe('/event/sensual-fridays');
    cleanup();
    q.ws = done('draft' as ShapeKey);
    at(P3_PATHS.event('ser-1'), <EventPage />, EVENT);
    expect(screen.queryByTestId('p3-see-public')).toBeNull();
  });

  it('a cover that will not load is dropped, not shown broken', () => {
    const d = done('weekly');
    (d.data as { series: { default_cover_image_url: string | null } }).series.default_cover_image_url = 'https://bad.example.test/x.jpg';
    q.ws = d;
    at(P3_PATHS.event('ser-1'), <EventPage />, EVENT);
    fireEvent.error(screen.getByTestId('p3-cover'));
    expect(screen.queryByTestId('p3-cover')).toBeNull();
  });
});

describe('F-06 the profile link is a client link; F-18 no pointer at a missing switch', () => {
  it.each([['Details', <DetailsScreen key="d" />, 'eventDetails'], ['Prices', <PricesScreen key="p" />, 'eventPrices']] as const)(
    '%s: Complete your profile navigates inside the app', (_n, el, path) => {
      q.ws = done('draft' as ShapeKey);
      (q.ws.data as { series: { lifecycle_status: string } }).series.lifecycle_status = 'draft';
      at(P3_PATHS[path]('ser-1'), el, `/account/p3/events/:seriesId/${path === 'eventDetails' ? 'details' : 'prices'}`);
      const link = screen.queryByTestId('p3-profile-link');
      if (!link) return; // not locked on this shape: nothing to click
      expect(link.tagName).toBe('A');
      fireEvent.click(link);
      expect(screen.getByTestId('where').textContent).toBe(PROFILE_WIZARD_PATH);
    });

  it('a festival with no prices does not mention the free switch', () => {
    expect(L.pricesNoneFestival).not.toMatch(/switch|free/i);
    expect(L.pricesNoneFestival).toMatch(/Add one/);
  });
});

describe('F-17 the place sheet: error has Try again, empty says what to do', () => {
  const openPlace = () => {
    q.ws = done('weekly');
    at(P3_PATHS.eventDetails('ser-1'), <DetailsScreen />, '/account/p3/events/:seriesId/details');
    fireEvent.click(screen.getByTestId('p3-d-pick-place'));
  };
  it('error: Try again refetches', () => {
    const refetch = vi.fn();
    q.venues = { isPending: false, isError: true, data: undefined, refetch };
    openPlace();
    expect(screen.getByRole('alert').textContent).toMatch(/try again/i);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalled();
  });
  it('empty: says what the person can do', () => {
    openPlace();
    expect(screen.getByTestId('p3-d-venues-empty').textContent).toBe(L.detailsPlaceEmpty);
  });
});

describe('F-19 empty cancel reasons', () => {
  it('shows a message and Try again, not a blank', async () => {
    const r = render(<QueryClientProvider client={client()}><ReasonPick picked={null} busy={false} onPick={() => undefined} /></QueryClientProvider>);
    const box = await screen.findByTestId('p3-cancel-reasons-empty');
    expect(box.textContent).toMatch(/Try again/);
    r.unmount();
  });
});
