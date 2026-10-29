// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { REASONS } from './cancelFixtures';
import { SHAPES } from './wsFixtures';
import { L } from '../../model';

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
      return { data: { event: detail, occurrence: { id, date: id.slice(2), version: 3, lifecycle_status: id === 'o-2026-11-06' ? 'cancelled' : 'scheduled', materialised_start_utc: `${id.slice(2)}T20:00:00Z` }, schedule: {} }, error: null };
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

  it('typing keeps the focus in the name box (the guarded Close is stable, so the sheet does not re-focus)', async () => {
    show();
    await openOwn('name');
    const input = screen.getByTestId('p3-own-name-text') as HTMLInputElement;
    input.focus();
    fireEvent.change(input, { target: { value: 'Halloween' } });
    fireEvent.change(input, { target: { value: 'Halloween Fridays' } });
    expect(document.activeElement).toBe(input);
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

describe('W3b-2 review round 1', () => {
  it('Close while a photo is still uploading asks first (it would be lost), Save waits for it', async () => {
    let finish: (u: string) => void = () => {};
    upload.mockImplementationOnce(() => new Promise<string>((r) => { finish = r; }));
    show();
    await openOwn('photos');
    fireEvent.change(screen.getByTestId('p3-photos-file'), { target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(upload).toHaveBeenCalled());
    expect(save().disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByTestId('p3-field-ask')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByTestId('p3-field-ask-stay'));
    fireEvent.click(screen.getByTestId('p3-field-ask-stay'));
    finish('https://img.example.test/new.jpg');
    await waitFor(() => expect(save().disabled).toBe(false));
  });

  it('at 30 photos Add is gone and the note says why', async () => {
    shape = withSeries({ gallery: Array.from({ length: 30 }, (_, i) => `https://img.example.test/${i}.jpg`) });
    show();
    await openOwn('photos');
    expect(screen.queryByTestId('p3-photos-add')).toBeNull();
    expect(screen.getByTestId('p3-photos-max').textContent).toMatch(/^30 photos is the most/);
  });

  it('the empty states point at a control on screen (Add), not at one a step back', async () => {
    shape = withSeries({ gallery: [] });
    show();
    await openOwn('photos');
    expect(screen.getByTestId('p3-photos-empty').textContent).not.toMatch(/usual/);
    expect(screen.getByTestId('p3-photos-add')).toBeTruthy();
  });

  it('the W3b-2 sources carry no raw non-ASCII (entities and escapes only)', async () => {
    const { readFileSync } = await import('node:fs');
    for (const f of ['../DateFieldSheets.tsx', '../PriceCard.tsx', '../../data/dateFields.ts', './w3b2.send.test.tsx', '../../data/__tests__/w3b2.matrix.test.ts']) {
      expect([...readFileSync(new URL(f, import.meta.url), 'utf8')].some((c) => c.charCodeAt(0) > 127), f).toBe(false);
    }
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

/*
 * Fix round 1 (review 1110-r1, findings 1, 2, 6). The class: a row that says why it cannot be
 * done must not carry a live control, and a held reason must name only controls on its sheet
 * (Definition of done: "no copy that points at a control that is not on screen", "a control
 * that cannot work is disabled with a reason").
 */
const OWN_ALL = { title_override: 'Halloween Fridays', gallery_override: G, passes_override: [PASS] };
const TEAM_PASS = { ...PASS, tier: 'vip' };

/** Every element marked data-enabled="false" is a disabled button or holds only disabled buttons. Returns how many. */
function noLiveControlWithReason(root: HTMLElement): number {
  const off = Array.from(root.querySelectorAll<HTMLElement>('[data-enabled="false"]'));
  for (const el of off) {
    const id = el.getAttribute('data-testid');
    if (el instanceof HTMLButtonElement) expect(el.disabled, `${id} is greyed but live`).toBe(true);
    for (const b of Array.from(el.querySelectorAll('button'))) expect(b.disabled, `${id}: "${b.textContent}" is live on a row with a reason`).toBe(true);
    expect(el.textContent?.trim(), `${id} says why`).toBeTruthy();
  }
  return off.length;
}

type LockCase = { name: string; ws: () => Record<string, unknown>; detail: Record<string, unknown>; open: 'event' | 'cancelled' | 'past'; dayown: boolean; greyRows: string[] };
const LOCKS: LockCase[] = [
  { name: 'plain', ws: () => SHAPES.weekly, detail: OWN_ALL, open: 'event', dayown: true, greyRows: [] },
  { name: 'festival', ws: () => SHAPES.festival, detail: OWN_ALL, open: 'event', dayown: true, greyRows: ['name', 'photos', 'price'] },
  { name: 'team list on the date', ws: () => SHAPES.weekly, detail: { passes_override: [TEAM_PASS] }, open: 'event', dayown: true, greyRows: ['price'] },
  { name: 'team list on the series', ws: () => withSeries({ passes: [TEAM_PASS] }), detail: OWN_ALL, open: 'event', dayown: true, greyRows: [] },
  { name: 'cancelled (own name, the prod shape)', ws: () => SHAPES.weekly, detail: { title_override: 'Halloween Fridays' }, open: 'cancelled', dayown: false, greyRows: [] },
  { name: 'past', ws: () => SHAPES.weekly, detail: OWN_ALL, open: 'past', dayown: false, greyRows: [] },
];

async function openCase(c: LockCase) {
  if (c.open === 'event') return openFirstDate();
  await waitFor(() => screen.getByTestId(`p3-filter-${c.open}`));
  fireEvent.click(screen.getByTestId(`p3-filter-${c.open}`));
  await waitFor(() => screen.getAllByTestId('p3-date-row'));
  fireEvent.click(within(screen.getAllByTestId('p3-date-row')[0]).getByRole('button'));
  await waitFor(() => screen.getByTestId('p3-date-actions'));
}

describe('W3b-2 fix round 1: a row with a reason never has a live write control', () => {
  for (const c of LOCKS) {
    it(c.name, async () => {
      shape = c.ws();
      detail = c.detail;
      show(c.open === 'event' ? undefined : '/account/p3/events/ser-1/dates');
      await openCase(c);
      noLiveControlWithReason(screen.getByTestId('p3-date-actions'));
      expect(act('details').disabled).toBe(!c.dayown);
      if (!c.dayown) return;
      fireEvent.click(act('details'));
      await waitFor(() => screen.getByTestId('p3-dayown'));
      const sheet = screen.getByTestId('p3-dayown');
      expect(noLiveControlWithReason(sheet)).toBe(c.greyRows.length);
      for (const r of ['where', 'about', 'ticket', 'photo', 'name', 'photos', 'price']) {
        const why = screen.queryByTestId(`p3-own-${r}-why`);
        expect(!!why, `${r} greyed`).toBe(c.greyRows.includes(r));
        if (why) expect(screen.queryByTestId(`p3-own-${r}-edit`)).toBeNull();
      }
      expect(dates).toHaveLength(0);
    });
  }

  it('a cancelled date owning only a name greys "Put this date back to normal" with the reason (nothing it could send)', async () => {
    detail = { title_override: 'Halloween Fridays' };
    show('/account/p3/events/ser-1/dates');
    await openCase(LOCKS[4]);
    expect(act('resetNormal').disabled).toBe(true);
    expect(act('resetNormal').textContent).toContain(L.dateFieldsCancelled);
  });

  it('a cancelled date with its own About as well keeps "Put this date back to normal" live (About still goes back)', async () => {
    detail = { title_override: 'Halloween Fridays', description_override: 'Our own night' };
    show('/account/p3/events/ser-1/dates');
    await openCase(LOCKS[4]);
    expect(act('resetNormal').disabled).toBe(false);
  });
});

/** Words a reason could use to point at a control; each one a reason names must be a button on the sheet. */
const CONTROL_WORDS = [L.useUsual, 'use the usual', 'usual name', L.changeForDate, L.datePhotosAdd, L.pricesAdd, L.dateUndo, L.saveOne, 'bring it back', 'back to usual'];

function reasonNamesOnlyControlsOnScreen() {
  const why = screen.getByTestId('p3-field-why').textContent ?? '';
  const buttons = screen.getAllByRole('button').map((b) => (b.textContent ?? '').toLowerCase());
  for (const w of CONTROL_WORDS) {
    if (why.toLowerCase().includes(w.toLowerCase())) expect(buttons.some((b) => b.includes(w.toLowerCase())), `"${why}" names "${w}"`).toBe(true);
  }
}

describe('W3b-2 fix round 1: every held reason names only controls on its sheet', () => {
  it('Name: blank and too long', async () => {
    show();
    await openOwn('name');
    for (const bad of ['', 'x'.repeat(81)]) {
      fireEvent.change(screen.getByTestId('p3-own-name-text'), { target: { value: bad } });
      reasonNamesOnlyControlsOnScreen();
    }
  });

  it('Price: a nameless price and a bad amount', async () => {
    show();
    await openOwn('price');
    fireEvent.click(screen.getByTestId('p3-price-add'));
    fireEvent.change(screen.getByTestId('p3-price-amount'), { target: { value: '5.555' } });
    reasonNamesOnlyControlsOnScreen();
    fireEvent.change(screen.getByTestId('p3-price-amount'), { target: { value: '5' } });
    reasonNamesOnlyControlsOnScreen();
  });

  it('Photos: holds nothing (no problem rule), so there is no reason to point anywhere', async () => {
    shape = withSeries({ gallery: G });
    show();
    await openOwn('photos');
    fireEvent.click(screen.getAllByTestId('p3-photo-remove')[0]);
    expect(screen.queryByTestId('p3-field-why')).toBeNull();
  });
});

describe('W3b-2 fix round 1: finding 9', () => {
  it('a trailing space on a price name is no change: "Nothing changed yet", no Undo, nothing to send', async () => {
    shape = withSeries({ passes: [PASS] });
    show();
    await openOwn('price');
    fireEvent.change(screen.getByTestId('p3-price-name'), { target: { value: 'Entry ' } });
    expect(save().disabled).toBe(true);
    expect(save().textContent).toBe(L.dateNothing);
    expect(screen.queryByTestId('p3-field-undo')).toBeNull();
  });
});
