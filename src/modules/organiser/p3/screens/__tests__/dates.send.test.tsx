// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { REASONS } from './cancelFixtures';
import { SHAPES } from './wsFixtures';

/*
 * W2b through the REAL send path (data/dates useSendPlan -> selfServeApi
 * runOccurrenceCommand / runSeriesCommand -> envelope()); only supabase.rpc, the reasons
 * read and the venue list are stood in for. A date command targets the DATE at its own
 * version; a skip targets the SERIES at its version; a retry after a dropped connection
 * reuses the key; an untouched form sends nothing; a refusal shows plain copy.
 */

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, auth: {}, from: vi.fn() } }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-25' }));
vi.mock('../../../shared/selfServeApi', async (orig) => ({
  ...(await orig<typeof import('../../../shared/selfServeApi')>()),
  fetchCancellationReasons: async () => REASONS,
}));
vi.mock('../../../shared/publicVenues', async (orig) => ({
  ...(await orig<typeof import('../../../shared/publicVenues')>()),
  useVenueOptions: () => ({ isPending: false, isError: false, data: [{ id: 'v1', name: 'The Usual Hall', neighbourhood: null, city_name: 'London', address: null, postcode: null }] }),
}));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ isPending: true, data: undefined }) }));

import { EventPage } from '../EventPage';
import { AllDatesScreen } from '../AllDatesScreen';

afterEach(cleanup);

type Env = Record<string, unknown>;
let shape: Record<string, unknown>;
let detail: Record<string, unknown>;
let series: Env[];
let dates: Env[];
let failNext: unknown;

beforeEach(() => {
  shape = SHAPES.weekly;
  detail = {};
  series = [];
  dates = [];
  failNext = null;
  rpc.mockReset();
  rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === 'admin_event_workspace_p5') return { data: shape, error: null };
    if (name === 'event_view_p5') {
      const id = (args.p_target as { occurrence_id: string }).occurrence_id;
      return { data: { event: detail, occurrence: { id, date: id.slice(2), version: 3, lifecycle_status: 'scheduled', materialised_start_utc: `${id.slice(2)}T20:00:00Z` }, schedule: {} }, error: null };
    }
    if (name === 'series_command_p5' || name === 'occurrence_command_p5') {
      (name === 'series_command_p5' ? series : dates).push(args.p_envelope as Env);
      if (failNext) { const f = failNext; failNext = null; if (f instanceof Error) throw f; return { data: null, error: f }; }
      return { data: { ok: true, new_version: 4 }, error: null };
    }
    return { data: null, error: null };
  });
});

function show(path = '/account/p3/events/ser-1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/account/p3/events/:seriesId" element={<EventPage />} />
          <Route path="/account/p3/events/:seriesId/dates" element={<AllDatesScreen />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function openFirstDate() {
  await waitFor(() => screen.getAllByTestId('p3-open-date'));
  fireEvent.click(screen.getAllByTestId('p3-open-date')[0]);
  await waitFor(() => screen.getByTestId('p3-date-actions'));
}

const act = (a: string) => screen.getByTestId(`p3-date-act-${a}`) as HTMLButtonElement;

describe('the date sheet writes through the real envelope', () => {
  it('Cancel this date: nothing until a reason; occurrence_command_p5 on the DATE at its version; the retry reuses the key; Bring it back in the toast', async () => {
    show();
    await openFirstDate();
    fireEvent.click(act('cancel'));
    const go = screen.getByTestId('p3-date-cancel-go') as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    await waitFor(() => screen.getByRole('button', { name: REASONS[0].label }));
    fireEvent.click(screen.getByRole('button', { name: REASONS[0].label }));
    failNext = new TypeError('Failed to fetch');
    fireEvent.click(go);
    await waitFor(() => screen.getByTestId('p3-sheet-error'));
    fireEvent.click(go);
    await waitFor(() => screen.getByTestId('p3-toast'));
    expect(dates).toHaveLength(2);
    expect(dates[0]).toEqual({ target_id: 'o-2026-10-30', expected_version: 3, idempotency_key: dates[0].idempotency_key, command: { kind: 'occurrence.cancel', payload: { cancelled: true, reason: REASONS[0].label } } });
    expect(dates[1].idempotency_key).toBe(dates[0].idempotency_key);
    expect(series).toHaveLength(0);
    expect(screen.getByTestId('p3-undo').textContent).toBe('Bring it back');
  });

  it('Skip this week: series_command_p5 on the SERIES at its version', async () => {
    show();
    await openFirstDate();
    fireEvent.click(act('skip'));
    fireEvent.click(screen.getByTestId('p3-skip-go'));
    await waitFor(() => screen.getByTestId('p3-toast'));
    expect(series).toEqual([{ target_id: 'ser-1', expected_version: 7, idempotency_key: series[0].idempotency_key, command: { kind: 'series.skip_date', payload: { occurrence_id: 'o-2026-10-30' } } }]);
  });

  it('untouched Move and Change the time send nothing; a taken day is refused before sending', async () => {
    show();
    await openFirstDate();
    fireEvent.click(act('move'));
    expect((screen.getByTestId('p3-move-go') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByTestId('p3-move-day'), { target: { value: '2026-11-06' } });
    expect((screen.getByTestId('p3-move-go') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toContain('already has a date on that day');
    fireEvent.click(screen.getByText(/Back/));
    fireEvent.click(act('time'));
    expect((screen.getByTestId('p3-time-start') as HTMLInputElement).value).toBe('20:00');
    expect((screen.getByTestId('p3-time-go') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByTestId('p3-time-start'), { target: { value: '21:00' } });
    fireEvent.click(screen.getByTestId('p3-time-go'));
    await waitFor(() => screen.getByTestId('p3-toast'));
    expect(dates.map((e) => e.command)).toEqual([{ kind: 'occurrence.set_time', payload: { new_local_start: '21:00', new_local_end: null } }]);
  });

  it('a refusal shows plain copy, never the server text', async () => {
    show();
    await openFirstDate();
    fireEvent.click(act('move'));
    fireEvent.change(screen.getByTestId('p3-move-day'), { target: { value: '2026-12-01' } });
    failNext = { message: 'invalid_transition: date_taken: this event already has a date on 2026-12-01', code: 'P0001' };
    fireEvent.click(screen.getByTestId('p3-move-go'));
    await waitFor(() => screen.getByTestId('p3-sheet-error'));
    expect(screen.getByTestId('p3-sheet-error').textContent).toBe('This event already has a date on that day (a cancelled one counts too). Pick another day.');
  });

  it('Different details: an untouched About saves nothing; a new one is occurrence.set_override {description}', async () => {
    show();
    await openFirstDate();
    fireEvent.click(act('details'));
    fireEvent.click(screen.getByTestId('p3-own-about-edit'));
    const save = screen.getByTestId('p3-own-save') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('p3-own-text'), { target: { value: 'Halloween special' } });
    fireEvent.click(save);
    await waitFor(() => screen.getByTestId('p3-toast'));
    expect(dates.map((e) => e.command)).toEqual([{ kind: 'occurrence.set_override', payload: { description: 'Halloween special' } }]);
  });

  it('Put this date back to normal sends the composite, the second command at the version the first returned', async () => {
    detail = { description_override: 'Special', ticket_url_override: 'https://t.example.test/x' };
    show();
    await openFirstDate();
    fireEvent.click(act('resetNormal'));
    fireEvent.click(screen.getByTestId('p3-resetNormal-go'));
    await waitFor(() => screen.getByTestId('p3-toast'));
    expect(dates.map((e) => [e.expected_version, e.command])).toEqual([
      [3, { kind: 'occurrence.set_override', payload: { ticket_url: null, description: null } }],
    ]);
  });
});

describe('kinds on the event page', () => {
  it('a one-off: its date row opens the date sheet whose Cancel the event opens THE W2c sheet (series.cancel_one_off)', async () => {
    shape = SHAPES.oneoff;
    show();
    await openFirstDate();
    expect(act('cancelEvent').textContent).toContain('Cancel the event');
    fireEvent.click(act('cancelEvent'));
    await waitFor(() => screen.getByTestId('p3-cancel-confirm'));
    await waitFor(() => screen.getByRole('button', { name: REASONS[0].label }));
    fireEvent.click(screen.getByRole('button', { name: REASONS[0].label }));
    fireEvent.click(screen.getByTestId('p3-cancel-confirm'));
    await waitFor(() => screen.getByTestId('p3-toast'));
    expect(series.map((e) => e.command)).toEqual([{ kind: 'series.cancel_one_off', payload: { reason: REASONS[0].label } }]);
    expect(dates).toHaveLength(0);
  });

  it('a festival: Move and Change the time are greyed with the reason', async () => {
    shape = SHAPES.festival;
    show();
    await openFirstDate();
    expect(act('move').disabled).toBe(true);
    expect(act('move').textContent).toContain('Festival days are set by the Bachata Calendar team');
    expect(act('time').disabled).toBe(true);
    expect(act('time').textContent).toContain('Festival times are set for the whole festival');
    expect(act('details').disabled).toBe(false);
  });
});

describe('All dates', () => {
  it('filters with counts; the newest 100 of 131 said honestly; Add a date at the cap is greyed with the reason', async () => {
    shape = SHAPES.over100;
    show('/account/p3/events/ser-1/dates');
    await waitFor(() => screen.getByTestId('p3-all-dates-screen'));
    expect(screen.getByTestId('p3-partial').textContent).toBe('This page lists the newest 100 of 131 dates.');
    expect(screen.getAllByTestId('p3-date-row')).toHaveLength(57);
    expect((screen.getByTestId('p3-add-date') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('p3-add-why').textContent).toContain('30 or more dates are coming up');
    fireEvent.click(screen.getByTestId('p3-filter-breaks'));
    expect(within(screen.getByTestId('p3-dates-empty')).getByText(/No break weeks/)).toBeTruthy();
  });

  it('Add a date: nothing until a free day is picked, then series.add_date', async () => {
    show('/account/p3/events/ser-1/dates');
    await waitFor(() => screen.getByTestId('p3-add-date'));
    fireEvent.click(screen.getByTestId('p3-add-date'));
    expect((screen.getByTestId('p3-add-go') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByTestId('p3-add-day'), { target: { value: '2026-12-02' } });
    fireEvent.click(screen.getByTestId('p3-add-go'));
    await waitFor(() => screen.getByTestId('p3-toast'));
    expect(series.map((e) => e.command)).toEqual([{ kind: 'series.add_date', payload: { date: '2026-12-02' } }]);
  });
});
