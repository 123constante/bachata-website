// @vitest-environment jsdom
/**
 * S1a night-aware buying (docs/design/ticket-night-aware-website.md). Rows are built from the
 * prod ticket_types_public_v2 body read back on 2026-11-10: with a night, per-night types carry
 * that night's `remaining` and `sold_out`; with NO night they carry remaining NULL.
 */
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) }, rpc } }));

const api = vi.hoisted(() => ({ fetchPublicTicketTypes: vi.fn(), postTicketCheckout: vi.fn() }));
vi.mock('../ticketCheckoutApi', async (orig) => {
  const real = await orig<typeof import('../ticketCheckoutApi')>();
  return { ...real, fetchPublicTicketTypes: api.fetchPublicTicketTypes, postTicketCheckout: api.postTicketCheckout, realFetch: real.fetchPublicTicketTypes, realPreview: real.previewPromo };
});

import * as wire from '../ticketCheckoutApi';
import { TicketsBlock } from '../TicketsBlock';
import { REASON_COPY, WAY_LABEL, availability, buildCheckoutBody, courseLine, parsePublicTypes, reasonCopy } from '../ticketCheckoutModel';
import { quietBar } from '../ticketBars';

const NOW = new Date('2026-11-10T12:00:00Z');
const PROD = 'https://www.bachatacalendar.co.uk';

/** One raw v2 row, prod-shaped (series-wide night type, Coco Loco on its next night). */
const row = (p: Record<string, unknown> = {}) => ({
  id: 'a', occurrence_id: null, name: 'Entry', price_pence: 1000, currency: 'GBP', status: 'on_sale',
  remaining: 50, sold_out: false, sales_open_at: null, sales_close_at: '2026-11-11T19:15:00+00:00',
  effective_close_at: '2026-11-11T19:15:00+00:00', kind: 'night', valid_from: null, valid_to: null, ...p,
});

const SHAPES = {
  nightA: parsePublicTypes([row({ remaining: 5 })]),
  nightB: parsePublicTypes([row({ remaining: 0, sold_out: true, status: 'sold_out' })]),
  noNight: parsePublicTypes([row({ remaining: null })]),
  past: parsePublicTypes([]),
  cancelled: parsePublicTypes([]),
  course: parsePublicTypes([row({ id: 'c', kind: 'course', name: 'Course', valid_from: '2026-11-03', valid_to: '2026-12-15', remaining: 12 })]),
  endedByNight: parsePublicTypes([row({ sales_close_at: null, effective_close_at: '2026-11-09T23:00:00+00:00' })]),
};

const NIGHT_REASONS = ['wrong_night', 'night_required', 'night_cancelled', 'night_ended', 'not_course_night'] as const;

/** Two future nights, as NightPicker lists them. */
const NIGHTS = [
  { id: 'n1', label: 'Wednesday 11 November 2026', time: '20:00' },
  { id: 'n2', label: 'Wednesday 18 November 2026', time: '20:00' },
];
let at = '';
const setAt = (v: string) => {
  at = v;
};
function Where() {
  const l = useLocation();
  useEffect(() => setAt(`${l.pathname}${l.search}`), [l]);
  return null;
}

function renderBlock(types: unknown, occurrenceId: string | null) {
  api.fetchPublicTicketTypes.mockResolvedValue(types);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/event/e1']}>
        <Routes>
          <Route path="/event/:id" element={<><TicketsBlock seriesId="e1" occurrenceId={occurrenceId} organiserId="org1" now={NOW} origin={PROD} nights={NIGHTS.filter((n) => n.id !== occurrenceId)} /><Where /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('parse: v2 columns', () => {
  it('reads sold_out, effective_close_at, kind, valid_from/to; NULL remaining = needs a night', () => {
    const [a] = parsePublicTypes([row({ kind: 'course', valid_from: '2026-11-03', valid_to: '2026-12-15' })]);
    expect(a).toMatchObject({ soldOut: false, effectiveCloseAt: '2026-11-11T19:15:00+00:00', kind: 'course', validFrom: '2026-11-03', validTo: '2026-12-15', needsNight: false });
    expect(SHAPES.noNight[0].needsNight).toBe(true);
    expect(parsePublicTypes([row({ currency: 'EUR' })])).toEqual([]);
  });
});

describe('availability x shape (block and bar read the same rule)', () => {
  it.each([
    ['nightA', 'buyable', '5 left'],
    ['nightB', 'sold_out', 'Sold out'],
    ['noNight', 'needs_night', 'Choose a night'],
    ['course', 'buyable', '12 left'],
    ['endedByNight', 'closed', 'Sales closed'],
  ] as const)('%s -> %s', (shape, kind, label) => {
    expect(availability(SHAPES[shape][0], NOW)).toEqual({ kind, label });
  });
  it('server sold_out wins even when remaining is left', () => {
    expect(availability(parsePublicTypes([row({ sold_out: true, remaining: 3 })])[0], NOW).kind).toBe('sold_out');
  });
  it.each([
    ['nightA', 'buy', ''],
    ['nightB', 'quiet', 'Sold out'],
    ['noNight', 'quiet', 'Choose a night'],
    ['past', 'none', ''],
    ['cancelled', 'none', ''],
  ] as const)('sticky bar on %s: %s %s', (shape, state, label) => {
    expect(wire.siteBarState(SHAPES[shape], NOW)).toBe(state);
    if (label) expect(wire.quietBarButton(SHAPES[shape], NOW)).toBe(label);
    expect(wire.sellsInSite(SHAPES[shape], NOW)).toBe(state === 'buy');
  });
  it('quiet block bar on a no-night page names the next step', () => {
    expect(quietBar(SHAPES.noNight, NOW)).toMatchObject({ title: 'Choose a night', button: 'Choose a night' });
  });
});

describe('wire: v2 only, with the night', () => {
  it('types read calls ticket_types_public_v2 with the night, never v1', async () => {
    rpc.mockResolvedValue({ data: [row()], error: null });
    const realFetch = (wire as unknown as { realFetch: typeof wire.fetchPublicTicketTypes }).realFetch;
    await realFetch('e1', 'n1');
    await realFetch('e1', null);
    expect(rpc).toHaveBeenNthCalledWith(1, 'ticket_types_public_v2', { p_event_series_id: 'e1', p_occurrence_id: 'n1' });
    expect(rpc).toHaveBeenNthCalledWith(2, 'ticket_types_public_v2', { p_event_series_id: 'e1', p_occurrence_id: null });
    expect(rpc.mock.calls.map((c) => c[0])).not.toContain('ticket_types_public_v1');
  });
  it('promo preview calls ticket_promo_preview_v2 with the night', async () => {
    rpc.mockResolvedValue({ data: { ok: true, discount_pence: 100, total_pence: 900 }, error: null });
    const realPreview = (wire as unknown as { realPreview: typeof wire.previewPromo }).realPreview;
    await realPreview('e1', 'a', 1, 'SAVE', 'n1');
    expect(rpc).toHaveBeenCalledWith('ticket_promo_preview_v2', { p_series: 'e1', p_ticket_type: 'a', p_quantity: 1, p_code: 'SAVE', p_occurrence_id: 'n1' });
  });
  it('the query key changes with the night', () => {
    expect(wire.publicTicketKeys.types('e1', 'n1')).toEqual(['public-ticket-types', 'e1', 'n1']);
    expect(wire.publicTicketKeys.types('e1', 'n1')).not.toEqual(wire.publicTicketKeys.types('e1', 'n2'));
  });
  it('checkout body carries occurrence_id when the page has a night, and only then', () => {
    const f = { typeId: 'a', quantity: 1, email: 'a@b.co', name: '' };
    expect(buildCheckoutBody({ ...f, occurrenceId: 'n1' }, PROD, '/event/e1')).toMatchObject({ occurrence_id: 'n1' });
    expect(buildCheckoutBody({ ...f, occurrenceId: null }, PROD, '/event/e1')).not.toHaveProperty('occurrence_id');
  });
});

describe('refusals: each night reason has its own copy and a way to another night', () => {
  it.each(NIGHT_REASONS)('%s', (reason) => {
    const c = reasonCopy(reason);
    expect(Object.prototype.hasOwnProperty.call(REASON_COPY, reason)).toBe(true);
    expect(c.way).toBe('pick_night');
    expect(c.text).toMatch(/night/i);
    // The next step is the night list rendered under the refusal.
    expect(c.text).toMatch(/nights below\.$/);
  });
});

describe('course line', () => {
  it('is built from the data with full weekday names', () => {
    expect(courseLine(SHAPES.course[0])).toBe('Valid every Tuesday from Tuesday 3 November 2026 to Tuesday 15 December 2026, once each night.');
    expect(courseLine(SHAPES.nightA[0])).toBeNull();
    expect(courseLine(parsePublicTypes([row({ kind: 'course', valid_from: null })])[0])).toBeNull();
  });
});

describe('screen x shape: the Tickets block', () => {
  it('night A (5 left): Buy is offered and the checkout body sends the night', async () => {
    api.postTicketCheckout.mockResolvedValue({ kind: 'error', reason: 'wrong_night', message: null });
    renderBlock(SHAPES.nightA, 'n1');
    expect(await screen.findByText('5 left')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'a@b.co' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Buy tickets' }));
    await waitFor(() => expect(api.postTicketCheckout).toHaveBeenCalled());
    expect(api.postTicketCheckout.mock.calls[0][0]).toMatchObject({ occurrence_id: 'n1', ticket_type_id: 'a' });
    expect(api.fetchPublicTicketTypes).toHaveBeenCalledWith('e1', 'n1');
    // wrong_night refusal: its own copy, and the night list under it (the refused night left out).
    expect(await screen.findByText(REASON_COPY.wrong_night.text)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: WAY_LABEL.pick_night }));
    const rows = screen.getByTestId('tickets-nights').querySelectorAll('[data-night-id]');
    expect([...rows].map((r) => r.getAttribute('data-night-id'))).toEqual(['n2']);
    fireEvent.click(rows[0]);
    expect(at).toBe('/event/e1?occurrenceId=n2');
  });
  it('night B (sold out): this night says Sold out, no Buy', async () => {
    renderBlock(SHAPES.nightB, 'n2');
    expect(await screen.findAllByText('Sold out')).not.toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Buy tickets' })).toBeNull();
  });
  it('no night on screen: no Buy, the night list, and a row opens that night', async () => {
    renderBlock(SHAPES.noNight, null);
    expect(await screen.findByText('Choose a night to buy tickets')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Buy tickets' })).toBeNull();
    expect(screen.queryByLabelText(/Email/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Wednesday 11 November 2026/ }));
    expect(at).toBe('/event/e1?occurrenceId=n1');
    expect(api.postTicketCheckout).not.toHaveBeenCalled();
  });
  it('mixed (one buyable, one needs a night): Buy here, no "choose a night" list over it', async () => {
    renderBlock([...parsePublicTypes([row({ id: 'p', occurrence_id: 'n0', name: 'Own night' })]), ...SHAPES.noNight], 'n0');
    expect(await screen.findByRole('button', { name: 'Buy tickets' })).toBeTruthy();
    expect(screen.queryByTestId('tickets-nights')).toBeNull();
  });
  it.each(['past', 'cancelled'] as const)('%s night (no rows): no block', async (shape) => {
    renderBlock(SHAPES[shape], 'nx');
    await waitFor(() => expect(api.fetchPublicTicketTypes).toHaveBeenCalledWith('e1', 'nx'));
    expect(screen.queryByTestId('tickets-block')).toBeNull();
  });
  it('course type shows its validity line and sends the night on screen', async () => {
    api.postTicketCheckout.mockResolvedValue({ kind: 'error', reason: 'not_course_night', message: null });
    renderBlock(SHAPES.course, 'n1');
    expect(await screen.findByText(/Valid every Tuesday from Tuesday 3 November 2026/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'a@b.co' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Buy tickets' }));
    await waitFor(() => expect(api.postTicketCheckout.mock.calls[0][0]).toMatchObject({ occurrence_id: 'n1' }));
    expect(await screen.findByText(REASON_COPY.not_course_night.text)).toBeTruthy();
  });
  it.each(NIGHT_REASONS)('refusal %s renders its copy and the way forward', async (reason) => {
    api.postTicketCheckout.mockResolvedValue({ kind: 'error', reason, message: 'edge words' });
    renderBlock(SHAPES.nightA, 'n1');
    await screen.findByText('5 left');
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'a@b.co' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Buy tickets' }));
    expect(await screen.findByText(REASON_COPY[reason].text)).toBeTruthy();
    expect(screen.getByRole('button', { name: WAY_LABEL.pick_night })).toBeTruthy();
  });
});
