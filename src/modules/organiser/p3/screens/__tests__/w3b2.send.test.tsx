// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { REASONS } from './cancelFixtures';
import { SHAPES } from './wsFixtures';

/*
 * W3b-2 (a date's own Name, Photos, Price) through the REAL send path, the W2b harness: data/dates
 * useSendPlan -> runOccurrenceCommand -> envelope(). Untouched sends nothing, a change is ONE
 * occurrence.set_override on the DATE at its version with a fresh key, "use usual" sends the
 * handler's null, a refusal shows plain copy, a failed upload keeps the sheet.
 * (Below, the W2b header.) W2b through the REAL send path (data/dates useSendPlan -> selfServeApi
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
const upload = vi.hoisted(() => vi.fn());
vi.mock('../../../events/media', () => ({ uploadEventPicture: upload }));
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
  upload.mockReset();
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
const save = () => screen.getByTestId('p3-own-save') as HTMLButtonElement;
const withSeries = (extra: Env) => {
  const raw = SHAPES.weekly as { series: { series: Env } };
  return { ...raw, series: { ...raw.series, series: { ...raw.series.series, ...extra } } };
};
const PASS = { id: '0b5e3d1e-0000-4000-8000-000000000001', name: 'Entry', price: 12, currency: 'GBP' };
const G = ['https://img.example.test/a.jpg', 'https://img.example.test/b.jpg'];

async function openOwn(row: 'name' | 'photos' | 'price') {
  await openFirstDate();
  fireEvent.click(act('details'));
  await waitFor(() => screen.getByTestId('p3-dayown'));
  fireEvent.click(screen.getByTestId(`p3-own-${row}-edit`));
}

const sent = () => dates.map((e) => ({ target: e.target_id, v: e.expected_version, command: e.command }));

describe('W3b-2 Name', () => {
  it('untouched sends nothing; a new name is one set_override on the date at its version', async () => {
    show();
    await openOwn('name');
    const input = screen.getByTestId('p3-own-name-text') as HTMLInputElement;
    expect(input.value).toBe('Sensual Fridays');
    expect(save().disabled).toBe(true);
    expect(save().textContent).toBe('Nothing changed yet');
    fireEvent.change(input, { target: { value: '  Halloween Fridays ' } });
    fireEvent.click(save());
    await waitFor(() => screen.getByTestId('p3-toast'));
    expect(sent()).toEqual([{ target: 'o-2026-10-30', v: 3, command: { kind: 'occurrence.set_override', payload: { title: 'Halloween Fridays' } } }]);
  });

  it('blank, whitespace and too long are held with the reason; nothing sends', async () => {
    show();
    await openOwn('name');
    for (const bad of ['', '   ', 'x'.repeat(81)]) {
      fireEvent.change(screen.getByTestId('p3-own-name-text'), { target: { value: bad } });
      expect(save().disabled).toBe(true);
      expect(screen.getByTestId('p3-field-why').textContent).toMatch(/name/);
    }
    expect(dates).toHaveLength(0);
  });

  it('an own name: "use usual" sends title null (the handler\u2019s inherit)', async () => {
    detail = { title_override: 'Halloween Fridays' };
    show();
    await openFirstDate();
    fireEvent.click(act('details'));
    await waitFor(() => screen.getByTestId('p3-own-name-usual'));
    fireEvent.click(screen.getByTestId('p3-own-name-usual'));
    await waitFor(() => screen.getByTestId('p3-toast'));
    expect(sent()[0].command).toEqual({ kind: 'occurrence.set_override', payload: { title: null } });
  });

  it('a server refusal shows plain copy; the retry reuses the key', async () => {
    show();
    await openOwn('name');
    fireEvent.change(screen.getByTestId('p3-own-name-text'), { target: { value: 'Halloween Fridays' } });
    failNext = { message: 'permission_denied: occurrence_cancelled: occurrence.set_override title on a cancelled date', code: 'P0001' };
    fireEvent.click(save());
    await waitFor(() => screen.getByTestId('p3-sheet-error'));
    expect(screen.getByTestId('p3-sheet-error').textContent).toMatch(/^This date is cancelled/);
    fireEvent.click(save());
    await waitFor(() => screen.getByTestId('p3-toast'));
    expect(dates).toHaveLength(2);
    expect(dates[1].idempotency_key).toBe(dates[0].idempotency_key);
  });

  it('leave guard: Back with a change asks first; Undo my changes asks, then puts the draft back', async () => {
    show();
    await openOwn('name');
    fireEvent.change(screen.getByTestId('p3-own-name-text'), { target: { value: 'Other' } });
    fireEvent.click(screen.getByTestId('p3-field-undo'));
    fireEvent.click(screen.getByTestId('p3-field-ask-go'));
    expect((screen.getByTestId('p3-own-name-text') as HTMLInputElement).value).toBe('Sensual Fridays');
    fireEvent.change(screen.getByTestId('p3-own-name-text'), { target: { value: 'Other' } });
    fireEvent.click(screen.getByTestId('p3-field-back'));
    expect(screen.getByTestId('p3-field-ask')).toBeTruthy();
    fireEvent.click(screen.getByTestId('p3-field-ask-stay'));
    expect((screen.getByTestId('p3-own-name-text') as HTMLInputElement).value).toBe('Other');
    fireEvent.click(screen.getByTestId('p3-field-back'));
    fireEvent.click(screen.getByTestId('p3-field-ask-go'));
    expect(screen.getByTestId('p3-dayown')).toBeTruthy();
    expect(dates).toHaveLength(0);
  });
});

describe('W3b-2 Photos', () => {
  it('starts from the usual photos; remove one sends the list; an upload failure keeps the rest', async () => {
    shape = withSeries({ gallery: G });
    show();
    await openOwn('photos');
    expect(screen.getAllByTestId('p3-photo')).toHaveLength(2);
    // the classes tests/e2e/p3-w3b2-geometry.spec.ts mirrors (it owns the layout)
    expect(screen.getByTestId('p3-photos').className).toBe('p3-photos');
    expect(screen.getAllByTestId('p3-photo')[0].className).toBe('p3-photo');
    expect(screen.getAllByTestId('p3-photo-remove')[0].className).toBe('p3-photo-x');
    expect(save().disabled).toBe(true);
    upload.mockRejectedValueOnce(new Error('That file is too big.'));
    fireEvent.change(screen.getByTestId('p3-photos-file'), { target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => screen.getByTestId('p3-photos-error'));
    expect(screen.getAllByTestId('p3-photo')).toHaveLength(2);
    upload.mockResolvedValueOnce('https://img.example.test/new.jpg');
    fireEvent.change(screen.getByTestId('p3-photos-file'), { target: { files: [new File(['x'], 'b.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(screen.getAllByTestId('p3-photo')).toHaveLength(3));
    expect(upload).toHaveBeenLastCalledWith('ser-1', expect.any(File));
    fireEvent.click(screen.getAllByTestId('p3-photo-remove')[0]);
    await waitFor(() => expect(save().disabled).toBe(false));
    fireEvent.click(save());
    await waitFor(() => screen.getByTestId('p3-toast'));
    expect(sent()).toEqual([{ target: 'o-2026-10-30', v: 3, command: { kind: 'occurrence.set_override', payload: { gallery: [G[1], 'https://img.example.test/new.jpg'] } } }]);
  });

  it('removing every photo sends [] (no photos this date), never a clear', async () => {
    shape = withSeries({ gallery: G.slice(0, 1) });
    show();
    await openOwn('photos');
    fireEvent.click(screen.getByTestId('p3-photo-remove'));
    expect(screen.getByTestId('p3-photos-empty')).toBeTruthy();
    fireEvent.click(save());
    await waitFor(() => screen.getByTestId('p3-toast'));
    expect(sent()[0].command).toEqual({ kind: 'occurrence.set_override', payload: { gallery: [] } });
  });
});

describe('W3b-2 Price', () => {
  it('starts from the usual prices; a changed price sends the owner pass shape', async () => {
    shape = withSeries({ passes: [PASS] });
    show();
    await openOwn('price');
    expect(save().disabled).toBe(true);
    fireEvent.change(screen.getByTestId('p3-price-amount'), { target: { value: '15.50' } });
    fireEvent.click(save());
    await waitFor(() => screen.getByTestId('p3-toast'));
    expect(sent()[0].command).toEqual({ kind: 'occurrence.set_override', payload: { passes: [{ ...PASS, price: 15.5 }] } });
  });

  it('an invalid price is held with the series rule\u2019s reason', async () => {
    show();
    await openOwn('price');
    fireEvent.click(screen.getByTestId('p3-price-add'));
    fireEvent.change(screen.getByTestId('p3-price-amount'), { target: { value: '5.555' } });
    expect(save().disabled).toBe(true);
    expect(screen.getByTestId('p3-field-why').textContent).toBeTruthy();
    expect(dates).toHaveLength(0);
  });
});

describe('W3b-2 rows on the dayown sheet', () => {
  it('a festival: name, photos and price are grey with the reason, no edit link', async () => {
    shape = SHAPES.festival;
    show();
    await waitFor(() => screen.getAllByTestId('p3-open-date'));
    fireEvent.click(screen.getAllByTestId('p3-open-date')[0]);
    await waitFor(() => screen.getByTestId('p3-date-actions'));
    fireEvent.click(act('details'));
    await waitFor(() => screen.getByTestId('p3-dayown'));
    for (const r of ['name', 'photos', 'price']) {
      expect(screen.getByTestId(`p3-own-${r}`).getAttribute('data-enabled')).toBe('false');
      expect(screen.getByTestId(`p3-own-${r}-why`).textContent).toMatch(/festival/);
      expect(screen.queryByTestId(`p3-own-${r}-edit`)).toBeNull();
    }
  });

  it('Put this date back to normal sends title, gallery and passes null in the ONE composite command', async () => {
    detail = { title_override: 'Halloween Fridays', gallery_override: [], passes_override: [PASS] };
    show();
    await openFirstDate();
    fireEvent.click(act('resetNormal'));
    fireEvent.click(screen.getByTestId('p3-resetNormal-go'));
    await waitFor(() => screen.getByTestId('p3-toast'));
    expect(sent()).toEqual([{ target: 'o-2026-10-30', v: 3, command: { kind: 'occurrence.set_override', payload: { title: null, gallery: null, passes: null } } }]);
  });
});
