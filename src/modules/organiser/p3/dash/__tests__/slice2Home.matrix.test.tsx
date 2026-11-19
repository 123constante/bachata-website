// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));

import { buildDash, compareOf, dayAfterOf, TIP_DRAFT, TIP_NO_TAPS, type DashInput, type DashNight, type HomeClock, type PastNight, type Seat } from '../dashModel';
import { DashView } from '../DashView';
import { homeClockOf, yesterdayOf } from '../homeClock';
import { pastOf, raffleWordsOf } from '../pastNights';
import { CompareView } from '../CompareNights';
import { tapsOfTotals } from '../DashHome';
import { EMPTY_TOTALS } from '../../data/analyticsV2';
import { isPushed } from '../../shell/pushed';
import { P3_PATHS } from '../../shell/paths';

afterEach(cleanup);
const TODAY = '2026-11-17';
type Amount = 'zero' | 'some' | 'many';
const AMT: Record<Amount, number> = { zero: 0, some: 3, many: 1234 };

const night = (i: number, more: Partial<DashNight> = {}): DashNight => ({
  key: `s1:2026-11-${String(17 + i).padStart(2, '0')}`, date: `2026-11-${String(17 + i).padStart(2, '0')}`, when: `Night ${i}`, name: 'Salsa Fridays',
  cancelled: false, going: null, opens: null, taps: {}, ticketsSold: 0, link: 'https://x/event/1', seriesId: 's1', draft: false, ...more,
});
const past = (more: Partial<PastNight> = {}): PastNight => ({
  key: 's1:2026-11-16', seriesId: 's1', date: '2026-11-16', name: 'Salsa Fridays', when: 'Yesterday', cancelled: false, cameIn: null, ticketsSold: null, raffle: null, ...more,
});
const input = (more: Partial<DashInput> = {}): DashInput => ({
  load: 'ready', seat: 'owner', nights: [night(0)], upcomingDates: 1, pageLink: 'https://x/o/1', profileSteps: [], cityOrganisers: null, cityAverage: null,
  sellingViaUs: false, teamCount: 1, ...more,
});
const taps = (n: number) => ({ ticket: n, share: n, whatsapp: n, directions: n });
const draw = (m: ReturnType<typeof buildDash>) =>
  render(<MemoryRouter><DashView model={m} pageName="Page" pageLink="https://x/o/1" doorTo="/door" compareTo={P3_PATHS.compare} /></MemoryRouter>);

const MOJIBAKE = /\u00c3|\u00c2|\u00e2\u20ac/;
const MONEY = /\u00a3|\bGBP\b|payout|revenue/i;
const PAGE_VIEWS = /\bopens?\b|\bviews?\b|visitors/i;

describe('slice 2 Home: clock x amount x seat x night shape', () => {
  const clocks: HomeClock[] = ['before', 'night', 'after'];
  const amounts: Amount[] = ['zero', 'some', 'many'];
  const seats: Seat[] = ['contributor', 'owner'];
  const shapes = ['live', 'cancelled', 'draft', 'series13'] as const;
  const cases = clocks.flatMap((clock) => amounts.flatMap((amt) => seats.flatMap((seat) => shapes.map((shape) => ({ clock, amt, seat, shape })))));

  it.each(cases)('$clock / $amt / $seat / $shape', ({ clock, amt, seat, shape }) => {
    const n = AMT[amt];
    // a contributor gets no analytics read: taps are {} for them, whatever the amount
    const t = seat === 'contributor' ? {} : taps(n);
    const nights = shape === 'series13'
      ? Array.from({ length: 13 }, (_, i) => night(i, { taps: i === 0 ? t : {}, going: n }))
      : shape === 'cancelled' ? [night(0, { cancelled: true }), night(7, { taps: t })]
      : [night(0, { taps: t, draft: shape === 'draft', going: n })];
    const last = past({ cameIn: n, ticketsSold: n, raffle: amt === 'zero' ? null : 'Raffle winner: Ana' });
    const m = buildDash(input({ seat, clock, nights, upcomingDates: nights.length, lastNight: last, canDoor: true, hasPastNights: true }));
    const { container } = draw(m);
    const text = container.textContent ?? '';

    expect(text).not.toMatch(MOJIBAKE);
    expect(text).not.toMatch(MONEY);
    expect(text).not.toMatch(PAGE_VIEWS);
    // positive-only: no "0 ..." count is ever drawn
    expect(text).not.toMatch(/(^|\D)0 (going|ticket|share|WhatsApp|directions|people|person)/);
    expect(m.clock).toBe(clock);
    // Compare nights is a row at the bottom of Home
    expect(screen.getByTestId('dash-compare-row').getAttribute('href')).toBe(P3_PATHS.compare);

    const hero = m.hero!;
    if (shape === 'cancelled') expect(hero.night?.cancelled).toBe(false);
    if (shape === 'draft') {
      expect(hero.taps ?? null).toBeNull();
      expect(hero.tip).toBe(TIP_DRAFT);
      expect(hero.kind).not.toBe('night');
    } else if (clock === 'night') {
      expect(hero.kind).toBe('night');
      expect(screen.getByTestId('dash-hero-door').getAttribute('href')).toBe('/door');
    } else if (seat === 'owner' && n > 0) {
      expect(screen.getByTestId('dash-hero-taps').textContent).toMatch(/ticket tap/);
      expect(screen.queryByTestId('dash-hero-tip')).toBeNull();
    } else if (!(n > 0 && shape === 'series13')) {
      // zero row hidden; ONE tip in its place
      expect(screen.queryByTestId('dash-hero-taps')).toBeNull();
      if (!hero.headline) expect(screen.getByTestId('dash-hero-tip').textContent).toBe(TIP_NO_TAPS);
    }

    if (clock === 'after') {
      const da = screen.getByTestId('dash-day-after');
      if (n > 0) {
        expect(screen.getByTestId('dash-day-after-big').textContent).toContain(n.toLocaleString('en-GB'));
        expect(da.textContent).toMatch(/tickets? sold/);
        expect(da.textContent).toContain('Raffle winner: Ana');
      } else {
        expect(screen.queryByTestId('dash-day-after-big')).toBeNull();
        expect(screen.getByTestId('dash-day-after-tip')).toBeTruthy();
      }
    } else {
      expect(screen.queryByTestId('dash-day-after')).toBeNull();
    }
    if (shape === 'series13') expect(m.seeAll?.label).toBe('See all 13 dates');
  });
});

describe('slice 2: day after when the count is missing', () => {
  it('no check-in count: no big number, tickets-sold line only', () => {
    const d = dayAfterOf(past({ cameIn: null, ticketsSold: 12 }));
    expect(d.big).toBeNull();
    expect(d.lines).toEqual(['12 tickets sold']);
  });
  it('a cancelled last night gives no day-after block', () => {
    expect(buildDash(input({ clock: 'after', lastNight: past({ cancelled: true, cameIn: 9 }) })).dayAfter).toBeNull();
  });
  it('one person: singular words', () => {
    const d = dayAfterOf(past({ cameIn: 1, ticketsSold: 1 }));
    expect([d.bigWord, ...d.lines]).toEqual(['person came', '1 ticket sold']);
  });
});

describe('slice 2: Home clock reuses tickets/a/clockState', () => {
  const at = (iso: string) => Date.parse(iso);
  it.each([
    ['5h before start', '2026-11-17T20:00:00Z', '2026-11-17', null, at('2026-11-17T15:00:00Z'), 'before'],
    ['2h before start (door)', '2026-11-17T20:00:00Z', '2026-11-17', null, at('2026-11-17T18:00:00Z'), 'night'],
    ['during', '2026-11-17T20:00:00Z', '2026-11-17', null, at('2026-11-17T23:00:00Z'), 'night'],
    ['tonight over, door shut', '2026-11-17T08:00:00Z', '2026-11-17', null, at('2026-11-17T20:00:00Z'), 'after'],
    ['last night was yesterday', '2026-11-20T20:00:00Z', '2026-11-20', '2026-11-16', at('2026-11-17T10:00:00Z'), 'after'],
    ['last night was a week ago', '2026-11-20T20:00:00Z', '2026-11-20', '2026-11-10', at('2026-11-17T10:00:00Z'), 'before'],
    ['no nights at all', null, null, null, at('2026-11-17T10:00:00Z'), 'before'],
  ] as const)('%s', (_l, iso, nextDate, lastDate, now, want) => {
    expect(homeClockOf(iso, nextDate, lastDate, TODAY, now)).toBe(want);
  });
  it('yesterday crosses a month', () => expect(yesterdayOf('2026-12-01')).toBe('2026-11-30'));
});

describe('slice 2: Compare nights', () => {
  it('ranks by Who came, falls back to Going, drops cancelled / unknown / zero', () => {
    const m = compareOf([
      past({ key: 'a', cameIn: 4 }), past({ key: 'b', cameIn: 40 }), past({ key: 'c', cameIn: null, going: 9 }),
      past({ key: 'd', cameIn: 99, cancelled: true }), past({ key: 'e', cameIn: 0 }), past({ key: 'f', cameIn: null }),
    ]);
    expect(m.rows.map((r) => `${r.key}:${r.value} ${r.word}`)).toEqual(['b:40 came', 'c:9 going', 'a:4 came']);
    expect(m.empty).toBeNull();
  });
  it('nothing countable: an empty state that says what to do', () => {
    render(<CompareView model={compareOf([past()])} />);
    expect(screen.getByTestId('dash-compare-empty').textContent).toMatch(/Scan tickets at the door/);
  });
  it('is a pushed screen (no bottom tabs)', () => expect(isPushed(P3_PATHS.compare)).toBe(true));
});

describe('slice 2: reads', () => {
  const rn = (date: string, more: Record<string, unknown> = {}) => ({ occurrenceId: `o-${date}`, date, startLocal: null, chip: 'past', raffleOn: false, entries: 0, locked: false, winner: null, canSet: false, refuseReason: null, ...more }) as never;
  it('past nights: before today, most recent first, capped, across series; refused reads skipped', () => {
    const got = pastOf([
      { seriesId: 's1', name: 'A', read: { kind: 'ok', read: { seriesId: 's1', canEdit: true, viewOnlyReason: null, nights: [rn('2026-11-01'), rn('2026-11-10'), rn('2026-11-17'), rn('2026-11-24')] } } },
      { seriesId: 's2', name: 'B', read: { kind: 'ok', read: { seriesId: 's2', canEdit: false, viewOnlyReason: 'ask an owner', nights: [rn('2026-11-15')] } } },
      { seriesId: 's3', name: 'C', read: { kind: 'refused' } },
    ], TODAY, 2);
    expect(got.map((g) => `${g.seriesId}:${g.night.date}`)).toEqual(['s1:2026-11-10', 's2:2026-11-15'].reverse());
  });
  it('raffle words', () => {
    expect(raffleWordsOf(rn('d', { winner: { firstName: 'Ana', drawnAt: null, entriesAtDraw: 3 } }))).toBe('Raffle winner: Ana');
    expect(raffleWordsOf(rn('d', { raffleOn: true, entries: 1 }))).toBe('Raffle: 1 entry');
    expect(raffleWordsOf(rn('d', { raffleOn: true, entries: 0 }))).toBeNull();
  });
  it('taps by type from analytics zones (group_chat = WhatsApp)', () => {
    expect(tapsOfTotals({ ...EMPTY_TOTALS, linkTaps: { ticket: 2, group_chat: 5, instagram: 9 } })).toEqual({ ticket: 2, share: 0, whatsapp: 5, directions: 0 });
  });
});
