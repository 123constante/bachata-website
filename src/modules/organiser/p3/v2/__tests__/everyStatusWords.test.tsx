// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EventWorkspace } from '../../../events/eventModel';

vi.mock('../../../shared/publicVenues', () => ({ useVenueOptions: () => ({ data: [], isPending: false }) }));
vi.mock('../../../events/programmeSeriesApi', () => ({ fetchOrganiserPages: async () => [], useSeriesRole: () => ({ role: 'owner', loading: false, myPages: [] }) }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...((await orig()) as object), londonTodayKey: () => '2026-11-22' }));
vi.mock('../../screens/CancelEventSheet', () => ({ useCancelReasons: () => ({ data: [] }) }));
vi.mock('../../tickets/data', () => ({
  useSeriesTypes: () => ({ data: [], isSuccess: true, isError: false, refetch: () => {} }),
  useSummary: () => ({ data: { ok: true, types: [] }, isSuccess: true, isError: false, refetch: () => {} }),
}));
import { EveryBody } from '../EveryBody';

const RULE = { mode: 'weekly', interval: 1, weekdays: [4], end: { kind: 'none' } };
const ws = (life: string, rule: unknown = RULE) => ({
  series: { id: 's1', version: 7, format: 'recurring', name: 'Thursdays', lifecycle_status: life, recurrence_rule: rule, default_venue_id: null, default_description: null, default_cover_image_url: null, default_ticket_url: null, default_local_start_time: null, default_duration: null, passes: null, default_start_date: '2026-01-01', created_at: null },
  gallery: [], musicStyles: [], organiserIds: ['org1'], endedOn: null, dates: [],
}) as unknown as EventWorkspace;
const mount = (w: EventWorkspace) => render(<QueryClientProvider client={new QueryClient()}><EveryBody ws={w} day="Thursday" saveNow={vi.fn()} /></QueryClientProvider>);
afterEach(cleanup);

describe('status words and recurrence wording', () => {
  it.each([['archived', 'Archived'], ['rejected', 'Not approved']])('%s shows the grey word and no actions', (life, word) => {
    mount(ws(life));
    expect(screen.getByTestId('status-pill').textContent).toBe(word);
    expect(screen.queryByTestId('every-end')).toBeNull();
  });
  it('keep-list: live and ended unchanged, Pause only on live', () => {
    mount(ws('live'));
    expect(screen.getByText('Live')).toBeTruthy();
    expect(screen.queryByTestId('status-pill')).toBeNull();
    expect(screen.getByTestId('end-pause')).toBeTruthy();
    cleanup();
    mount(ws('ended'));
    expect(screen.getByText('Ended')).toBeTruthy();
    expect(screen.queryByTestId('end-pause')).toBeNull();
  });
  it('a stored rule still reads Every <day>; a null rule does not', () => {
    mount(ws('live'));
    expect(screen.getAllByText('Every Thursday').length).toBeGreaterThan(0);
    cleanup();
    mount(ws('live', null));
    expect(screen.queryByText('Every Thursday')).toBeNull();
    expect(screen.getAllByText('Repeats on custom dates').length).toBeGreaterThan(0);
  });
});
