// @vitest-environment jsdom
/**
 * S1a fix round 1 (docs/review/ticket-night-aware-website.md FIX-1..3): every night control
 * reaches a RENDERED night row or a navigation, never a Dates tile that only courses have.
 * Shapes from prod (read-only, 2026-11-10): the series that sell tickets are weekly parties
 * (53 future nights, the snapshot window capped at 52, next night today) and a festival with
 * ONE night. No cancelled nights exist in prod; covered here by fixture only.
 * The festival shape is a FIXTURE-ONLY shape for these components: the festival page
 * (FestivalDetail) mounts none of them and has no in-site ticketing surface (review r2 N6).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) }, rpc } }));

const api = vi.hoisted(() => ({ fetchPublicTicketTypes: vi.fn(), postTicketCheckout: vi.fn() }));
vi.mock('../ticketCheckoutApi', async (orig) => {
  const real = await orig<typeof import('../ticketCheckoutApi')>();
  return { ...real, fetchPublicTicketTypes: api.fetchPublicTicketTypes, postTicketCheckout: api.postTicketCheckout };
});

import { TicketsBlock } from '../TicketsBlock';
import { EventTicketsPage } from '../EventTicketsPage';
import { MAX_NIGHTS, nightOptions, type NightSource } from '../NightPicker';
import { REASON_COPY, WAY_LABEL, parsePublicTypes } from '../ticketCheckoutModel';
import { quietBar } from '../ticketBars';
import { promoKey } from '../promo';
import { asWallClock } from '@/lib/time/wallClock';
import { quietBarButton } from '../ticketCheckoutApi';
import InSiteTicketProbe from '@/modules/event-page/bento/InSiteTicketProbe';
import { EventStickyActionBar } from '@/modules/event-page/bento/EventStickyActionBar';

// Tuesday 10 November 2026, midday London.
const NOW = new Date('2026-11-10T12:00:00Z');
const PROD = 'https://www.bachatacalendar.co.uk';

const row = (p: Record<string, unknown> = {}) => ({
  id: 'a', occurrence_id: null, name: 'Entry', price_pence: 1000, currency: 'GBP', status: 'on_sale',
  remaining: 50, sold_out: false, sales_open_at: null, sales_close_at: null,
  effective_close_at: '2026-11-11T19:15:00+00:00', kind: 'night', valid_from: null, valid_to: null, ...p,
});
const NO_NIGHT = parsePublicTypes([row({ remaining: null })]);
const NIGHT = parsePublicTypes([row({ remaining: 5 })]);

/** A snapshot occurrence, wall clock stamped +00 as event_view_p5 sends it. */
const wc = (s: string) => asWallClock(s);
const occ = (id: string, ymd: string, p: Partial<NightSource> = {}): NightSource => ({
  occurrenceId: id, localDate: wc(`${ymd}T00:00:00+00:00`), startsAt: wc(`${ymd}T20:00:00+00:00`), isCancelled: false, isPast: false, ...p,
});
const addDays = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** Weekly party: 17 past nights (window), today, then weekly; one cancelled. */
const WEEKLY: NightSource[] = [
  ...Array.from({ length: 3 }, (_, i) => occ(`p${i}`, addDays('2026-11-10', -7 * (3 - i)), { isPast: true })),
  occ('w0', '2026-11-10'),
  occ('w1', '2026-11-17', { isCancelled: true }),
  ...Array.from({ length: 48 }, (_, i) => occ(`w${i + 2}`, addDays('2026-11-24', 7 * i))),
];
const FESTIVAL: NightSource[] = [occ('f0', '2027-02-05')];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('nightOptions x shape (one mapping for every control)', () => {
  it('weekly: future, not cancelled, soonest first, capped, full weekday names', () => {
    const n = nightOptions(WEEKLY, null, NOW);
    expect(n).toHaveLength(MAX_NIGHTS);
    expect(n[0]).toEqual({ id: 'w0', label: 'Tuesday 10 November 2026', time: '20:00' });
    expect(n[1].id).toBe('w2');
    expect(n.map((x) => x.id)).not.toContain('w1');
    expect(n.every((x) => /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) /.test(x.label))).toBe(true);
  });
  it('the refused night is left out', () => {
    expect(nightOptions(WEEKLY, 'w0', NOW)[0].id).toBe('w2');
  });
  it('festival: one night; once refused, none left', () => {
    expect(nightOptions(FESTIVAL, null, NOW).map((x) => x.id)).toEqual(['f0']);
    expect(nightOptions(FESTIVAL, 'f0', NOW)).toEqual([]);
  });
  it.each([
    ['null', null],
    ['empty', []],
    ['a past date not flagged past', [occ('x', '2026-11-09')]],
    ['no dates at all', [occ('x', '2026-11-20', { localDate: null, startsAt: null })]],
  ] as const)('%s -> no nights', (_n, src) => {
    expect(nightOptions(src as NightSource[] | null, null, NOW)).toEqual([]);
  });
  it('falls back to startsAt when localDate is missing; no time when untimed or a bare date', () => {
    expect(nightOptions([occ('x', '2026-11-20', { localDate: null })], null, NOW)[0].label).toBe('Friday 20 November 2026');
    expect(nightOptions([occ('x', '2026-11-20', { startsAt: wc('2026-11-20') })], null, NOW)[0].time).toBeNull();
    expect(nightOptions([occ('x', '2026-11-20', { hasTimedSession: false })], null, NOW)[0].time).toBeNull();
  });
});

let at = '';
const setAt = (v: string) => {
  at = v;
};
function Where() {
  const l = useLocation();
  useEffect(() => setAt(`${l.pathname}${l.search}`), [l]);
  return null;
}
const hooks = {
  useOccurrenceProgram: () => ({ isSuccess: true, data: [] }),
  useProgramItems: () => ({ isSuccess: true, data: [] }),
};
const chipInput = { startIso: null, endIso: null, programmeStartIso: null, programmeEndIso: null, idRequired: null, bar: null, cloakroom: null, facilities: [], floorType: null, musicStyles: [], parking: null, timeZone: 'Europe/London' };

/** The event page in miniature: the real sticky bar, and the real Tickets page it opens. */
function Page({ occurrenceId, nights }: { occurrenceId: string | null; nights: NightSource[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <EventStickyActionBar
        eventId="e1"
        occurrenceId={occurrenceId}
        directionsUrl={null}
        ticketUrl={null}
        inSiteTicketing
        onOpenTickets={() => setOpen(true)}
        shareTitle="Party"
        shareSubtitle={null}
        canAddToCalendar={false}
        onAddToCalendar={() => {}}
      />
      {open && (
        <EventTicketsPage
          {...({ programHooks: hooks } as object)}
          seriesId="e1"
          occurrenceId={occurrenceId}
          organiserId="org1"
          title="Party"
          dateLine={null}
          chipInput={chipInput as never}
          nights={nights}
          onClose={() => setOpen(false)}
        />
      )}
      <Where />
    </>
  );
}

function renderWith(el: React.ReactElement, path = '/event/e1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/event/:id" element={el} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('FIX-1: sticky bar "Choose a night" reaches a night row, then a navigation', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('weekly, no night on screen: bar -> Tickets page night list -> ?occurrenceId', async () => {
    api.fetchPublicTicketTypes.mockResolvedValue(NO_NIGHT);
    renderWith(<Page occurrenceId={null} nights={WEEKLY} />);
    const choose = await screen.findByTestId('buy-choose-night');
    expect((choose as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(choose);
    const list = await screen.findByTestId('tickets-nights');
    const rows = within(list).getAllByRole('button');
    expect(rows).toHaveLength(MAX_NIGHTS);
    expect(rows[0].textContent).toContain('Tuesday 10 November 2026');
    fireEvent.click(rows[0]);
    expect(at).toBe('/event/e1?occurrenceId=w0');
    // No control anywhere points at the Dates tile any more.
    expect(document.querySelector('[data-block-id="dates"]')).toBeNull();
  });
});

describe('FIX-2: block quiet bar and sticky bar agree on "Choose a night"', () => {
  it('both say Choose a night, both are tappable, the block one brings the list into view', async () => {
    expect(quietBar(NO_NIGHT, NOW)?.button).toBe(quietBarButton(NO_NIGHT, NOW));
    api.fetchPublicTicketTypes.mockResolvedValue(NO_NIGHT);
    renderWith(<TicketsBlock seriesId="e1" occurrenceId={null} organiserId="org1" now={NOW} origin={PROD} nights={nightOptions(WEEKLY, null, NOW)} />);
    const btn = (await screen.findByTestId('ticket-bar-quiet-choose')) as HTMLButtonElement;
    expect(btn.textContent).toBe('Choose a night');
    expect(btn.disabled).toBe(false);
    const list = screen.getByTestId('tickets-nights');
    const spy = vi.fn();
    list.scrollIntoView = spy;
    fireEvent.click(btn);
    expect(spy).toHaveBeenCalled();
  });
  it('other quiet states keep a disabled label (nothing to do)', async () => {
    api.fetchPublicTicketTypes.mockResolvedValue(parsePublicTypes([row({ remaining: 0, sold_out: true })]));
    renderWith(<TicketsBlock seriesId="e1" occurrenceId="w0" organiserId="org1" now={NOW} origin={PROD} nights={[]} />);
    const bar = await screen.findByTestId('ticket-bar-quiet');
    expect(screen.queryByTestId('ticket-bar-quiet-choose')).toBeNull();
    expect((within(bar).getByRole('button') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByTestId('tickets-nights')).toBeNull();
  });
});

describe('refusal x shape: "Choose another night" has a real target', () => {
  async function buyAndRefuse(reason: string) {
    api.postTicketCheckout.mockResolvedValue({ kind: 'error', reason, message: null });
    await screen.findByText('5 left');
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'a@b.co' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Buy tickets' }));
    return screen.findByRole('alert');
  }
  it.each(['wrong_night', 'night_required', 'night_cancelled', 'night_ended', 'not_course_night'])('weekly %s: list below, refused night left out, row navigates', async (reason) => {
    api.fetchPublicTicketTypes.mockResolvedValue(NIGHT);
    renderWith(<><TicketsBlock seriesId="e1" occurrenceId="w0" organiserId="org1" now={NOW} origin={PROD} nights={nightOptions(WEEKLY, 'w0', NOW)} /><Where /></>, '/event/e1?occurrenceId=w0&ref=ig');
    const alert = await buyAndRefuse(reason);
    expect(alert.textContent).toContain(REASON_COPY[reason].text);
    expect(REASON_COPY[reason].text).toMatch(/nights below\.$/);
    expect(REASON_COPY[reason].text).not.toMatch(/dates list/);
    const list = screen.getByTestId('tickets-nights');
    const spy = vi.fn();
    list.scrollIntoView = spy;
    fireEvent.click(within(alert).getByRole('button', { name: WAY_LABEL.pick_night }));
    expect(spy).toHaveBeenCalled();
    const ids = [...list.querySelectorAll('[data-night-id]')].map((r) => r.getAttribute('data-night-id'));
    expect(ids).not.toContain('w0');
    fireEvent.click(within(list).getAllByRole('button')[0]);
    expect(at).toBe('/event/e1?occurrenceId=w2&ref=ig');
  });
  it('festival refusal: no other night, so the empty state names the next step', async () => {
    api.fetchPublicTicketTypes.mockResolvedValue(NIGHT);
    renderWith(<TicketsBlock seriesId="e1" occurrenceId="f0" organiserId="org1" now={NOW} origin={PROD} nights={nightOptions(FESTIVAL, 'f0', NOW)} />);
    await buyAndRefuse('night_ended');
    const empty = screen.getByTestId('tickets-nights-empty');
    // The refusal says "See the other nights below"; below says there are none and what to do.
    expect(empty.textContent).toMatch(/No other nights are listed for this event/);
    expect(screen.queryByText('Choose a night to buy tickets')).toBeNull();
    expect(within(empty).getByRole('link', { name: 'Contact the organiser' }).getAttribute('href')).toBe('/organisers/org1');
  });
  it('a new night clears the old refusal', async () => {
    api.fetchPublicTicketTypes.mockResolvedValue(NIGHT);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const tree = (occurrenceId: string) => (
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/event/e1']}>
          <Routes><Route path="/event/:id" element={<TicketsBlock seriesId="e1" occurrenceId={occurrenceId} organiserId="org1" now={NOW} origin={PROD} nights={nightOptions(WEEKLY, occurrenceId, NOW)} />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    const { rerender } = render(tree('w0'));
    await buyAndRefuse('night_ended');
    await act(async () => rerender(tree('w2')));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});

describe('FIX-3: the sticky bar reads the night on screen', () => {
  // Pin the clock like FIX-1 does: the fixture night closes 2026-11-11T19:15Z, so on a real clock these go red after that.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  it('InSiteTicketProbe with occurrenceId n1 fetches (e1, n1)', async () => {
    api.fetchPublicTicketTypes.mockResolvedValue(NIGHT);
    const onResult = vi.fn();
    renderWith(<InSiteTicketProbe seriesId="e1" occurrenceId="n1" onResult={onResult} />);
    await waitFor(() => expect(onResult).toHaveBeenCalledWith('e1', 'n1', 'buy', ''));
    expect(api.fetchPublicTicketTypes).toHaveBeenCalledWith('e1', 'n1');
    expect(api.fetchPublicTicketTypes).not.toHaveBeenCalledWith('e1', null);
  });
  it('EventStickyActionBar forwards occurrenceId to the probe', async () => {
    api.fetchPublicTicketTypes.mockResolvedValue(NIGHT);
    renderWith(<Page occurrenceId="n7" nights={WEEKLY} />);
    expect(await screen.findByTestId('buy-in-site')).toBeTruthy();
    expect(api.fetchPublicTicketTypes).toHaveBeenCalledWith('e1', 'n7');
    expect(api.fetchPublicTicketTypes).not.toHaveBeenCalledWith('e1', null);
  });
});

describe('N2: the promo preview key carries the night', () => {
  it('a preview for night A is not the preview for night B', () => {
    expect(promoKey('a', 1, 'n1')).not.toBe(promoKey('a', 1, 'n2'));
    expect(promoKey('a', 1)).toBe('a:1');
  });
});

describe('N7: an applied promo preview does not follow a night change', () => {
  it('applied on night w0; the block moves to w2 by prop only; the old preview is not shown', async () => {
    api.fetchPublicTicketTypes.mockResolvedValue(NIGHT);
    rpc.mockResolvedValue({ data: { ok: true, unit_price: 1000, discount: 100, total: 900 }, error: null });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const tree = (occurrenceId: string) => (
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/event/e1']}>
          <Routes><Route path="/event/:id" element={<TicketsBlock seriesId="e1" occurrenceId={occurrenceId} organiserId="org1" now={NOW} origin={PROD} nights={nightOptions(WEEKLY, occurrenceId, NOW)} />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    const { rerender } = render(tree('w0'));
    await screen.findByText('5 left');
    fireEvent.change(screen.getByLabelText('Promo code (optional)'), { target: { value: 'SAVE10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(screen.getByTestId('promo-note').textContent).toMatch(/Code SAVE10 applied/));
    expect(screen.getByTestId('ticket-bar-total').textContent).toBe('\u00a39');
    await act(async () => rerender(tree('w2')));
    await screen.findByText('5 left');
    expect(screen.queryByTestId('promo-note')?.textContent ?? '').not.toMatch(/applied\. You save/);
    expect(screen.getByTestId('ticket-bar-total').textContent).toBe('\u00a310');
  });
});

describe('FIX-4: the quiet bar spacer is the last child of the block', () => {
  const last = () => screen.getByTestId('tickets-block').lastElementChild;
  it('weekly, no night on screen: list first, spacer last (the last row scrolls clear of the bar)', async () => {
    api.fetchPublicTicketTypes.mockResolvedValue(NO_NIGHT);
    renderWith(<TicketsBlock seriesId="e1" occurrenceId={null} organiserId="org1" now={NOW} origin={PROD} nights={nightOptions(WEEKLY, null, NOW)} />);
    await screen.findByTestId('ticket-bar-quiet');
    const spacer = screen.getByTestId('ticket-bar-quiet-spacer');
    expect(last()).toBe(spacer);
    // The list comes before the spacer in document order.
    expect(screen.getByTestId('tickets-nights').compareDocumentPosition(spacer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
  it('other quiet states: the spacer is still last', async () => {
    api.fetchPublicTicketTypes.mockResolvedValue(parsePublicTypes([row({ remaining: 0, sold_out: true })]));
    renderWith(<TicketsBlock seriesId="e1" occurrenceId="w0" organiserId="org1" now={NOW} origin={PROD} nights={[]} />);
    await screen.findByTestId('ticket-bar-quiet');
    expect(last()).toBe(screen.getByTestId('ticket-bar-quiet-spacer'));
  });
  it('a refusal, then the re-read list is sold out: refusal and night list both sit above the spacer', async () => {
    api.fetchPublicTicketTypes.mockResolvedValue(NIGHT);
    api.postTicketCheckout.mockResolvedValue({ kind: 'error', reason: 'night_ended', message: null });
    renderWith(<TicketsBlock seriesId="e1" occurrenceId="w0" organiserId="org1" now={NOW} origin={PROD} nights={nightOptions(WEEKLY, 'w0', NOW)} />);
    await screen.findByText('5 left');
    api.fetchPublicTicketTypes.mockResolvedValue(parsePublicTypes([row({ remaining: 0, sold_out: true })]));
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'a@b.co' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Buy tickets' }));
    await screen.findByRole('alert');
    await screen.findByTestId('ticket-bar-quiet');
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByTestId('tickets-nights')).toBeTruthy();
    expect(last()).toBe(screen.getByTestId('ticket-bar-quiet-spacer'));
  });
  it('no quiet bar: no quiet spacer', async () => {
    api.fetchPublicTicketTypes.mockResolvedValue(NIGHT);
    renderWith(<TicketsBlock seriesId="e1" occurrenceId="w0" organiserId="org1" now={NOW} origin={PROD} nights={[]} />);
    await screen.findByText('5 left');
    expect(screen.queryByTestId('ticket-bar-quiet-spacer')).toBeNull();
  });
});
