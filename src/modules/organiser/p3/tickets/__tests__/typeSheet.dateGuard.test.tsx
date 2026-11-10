// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { EVERY_DATE_NOTE, defaultCloseFor, formOf, isoToLondonInput } from '../../../tickets/ticketModel';
import { SHAPES, home, org, series, type } from './fixtures';
import { dataMock, load, ok, q, show } from './harness';

/*
 * Date guard: a ticket covers every date of a series. Series shapes x {new, edit with a close,
 * edit with none} x {manager, contributor}. ONE mapping per fact (EXPECT below).
 */

vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-27' }));
vi.mock('../data', (orig) => dataMock(orig as never));
const api = vi.hoisted(() => ({ setTicketStatus: vi.fn(), upsertTicketType: vi.fn(), refundOrder: vi.fn() }));
vi.mock('../../../tickets/ticketsApi', async (orig) => ({ ...(await orig<typeof import('../../../tickets/ticketsApi')>()), ...api }));

import { TicketsEntry } from '../TicketsEntry';

beforeEach(() => Object.values(api).forEach((f) => f.mockReset()));
afterEach(cleanup);

const date = (start: string | null, id = 'o1') => ({ occurrence_id: id, occurrence_date: (start ?? '2026-11-07').slice(0, 10), lifecycle_status: 'scheduled', materialised_start_utc: start, has_own_changes: false });
const weekly = Array.from({ length: 13 }, (_, i) => date(new Date(Date.UTC(2026, 10, 7 + i * 7, 19)).toISOString().replace('.000Z', '+00:00'), `w${i}`));

interface SeriesShape { count: number; dates: ReturnType<typeof date>[] }
const SERIES_SHAPES: Record<string, SeriesShape> = {
  none: { count: 0, dates: [] },
  one: { count: 1, dates: [date('2026-11-14T19:00:00+00:00')] },
  two: { count: 2, dates: [date('2026-11-14T19:00:00+00:00'), date('2026-11-21T19:00:00+00:00', 'o2')] },
  weekly13: { count: 13, dates: weekly },
  missingStart: { count: 3, dates: [date(null)] },
  pastStart: { count: 3, dates: [date('2026-10-01T19:00:00+00:00')] },
};
/** The ONE mapping: the note shows for 2+ upcoming dates; the prefill is the next start (London) when it is there. */
const EXPECT = (s: SeriesShape) => ({
  note: s.count >= 2,
  prefill: s.count >= 2 && s.dates[0]?.materialised_start_utc ? isoToLondonInput(s.dates[0].materialised_start_utc) : '',
});

const setup = (shape: SeriesShape, role: 'owner' | 'contributor', types = [] as ReturnType<typeof type>[]) => {
  load(SHAPES.bare);
  const s = series({ upcoming_count: shape.count, next_dates: shape.dates as never });
  q.home = ok(home(org({ role: role as never }, s)));
  q.types = ok(types);
};
const input = (id: string, value: string) => fireEvent.change(screen.getByTestId(id), { target: { value } });

describe.each(Object.keys(SERIES_SHAPES))('series %s', (k) => {
  const shape = SERIES_SHAPES[k];
  const want = EXPECT(shape);

  it('defaultCloseFor is the pure mapping', () => {
    const s = { upcoming_count: shape.count, next_dates: shape.dates };
    expect(defaultCloseFor(s)).toBe(want.prefill || null);
    expect(formOf(null, s).closesAt).toBe(want.prefill);
    expect(formOf(null).closesAt).toBe('');
  });

  it('new ticket (manager): note under the sales window only for 2+ dates; Sales close prefilled, editable, clearable', () => {
    setup(shape, 'owner');
    show(<TicketsEntry seriesId="ser-1" />);
    fireEvent.click(screen.getByTestId('tix-row'));
    fireEvent.click(screen.getByTestId('tix-add'));
    input('tix-form-name', 'Door');
    fireEvent.click(screen.getByTestId('tix-next'));
    input('tix-form-capacity', '40');
    expect(screen.queryByTestId('tix-every-date')?.textContent ?? null).toBe(want.note ? EVERY_DATE_NOTE : null);
    if (shape.count === 1 && shape.dates[0].materialised_start_utc) {
      // a one-date series keeps today's behaviour: the Event start chip, no note
      expect(screen.getByTestId('tix-close-event').getAttribute('aria-pressed')).toBe('true');
    } else if (want.prefill) {
      expect((screen.getByTestId('tix-form-closesAt') as HTMLInputElement).value).toBe(want.prefill);
      input('tix-form-closesAt', '2026-12-01T10:00');
      expect((screen.getByTestId('tix-form-closesAt') as HTMLInputElement).value).toBe('2026-12-01T10:00');
      fireEvent.click(screen.getByTestId('tix-close-never'));
      expect(screen.queryByTestId('tix-form-closesAt')).toBeNull();
    } else {
      expect(screen.queryByTestId('tix-form-closesAt')).toBeNull();
      expect(screen.getByTestId('tix-close-never').getAttribute('aria-pressed')).toBe('true');
    }
  });

  it('new ticket (contributor): Add a ticket is disabled, so no sheet and no note', () => {
    setup(shape, 'contributor');
    show(<TicketsEntry seriesId="ser-1" />);
    fireEvent.click(screen.getByTestId('tix-row'));
    expect((screen.getByTestId('tix-add') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByTestId('tix-every-date')).toBeNull();
  });

  describe.each([
    ['edit with a close set', '2026-12-25T18:00:00.000Z', '2026-12-25T18:00'],
    ['edit with no close set', null, ''],
  ])('%s', (_n, closeIso, closeText) => {
    it.each(['owner', 'contributor'] as const)('%s: fields unchanged, no note, an untouched save sends nothing', (role) => {
      setup(shape, role, [type('t1', { salesCloseAt: closeIso })]);
      show(<TicketsEntry seriesId="ser-1" />);
      fireEvent.click(screen.getByTestId('tix-row'));
      fireEvent.click(screen.getByTestId('tix-edit'));
      fireEvent.click(screen.getByTestId('tix-next'));
      expect((screen.queryByTestId('tix-form-closesAt') as HTMLInputElement | null)?.value ?? '').toBe(closeText);
      expect(screen.queryByTestId('tix-every-date')).toBeNull();
      if (role === 'owner') {
        fireEvent.click(screen.getByTestId('tix-next'));
        fireEvent.click(screen.getByTestId('tix-save'));
        expect(api.upsertTicketType).not.toHaveBeenCalled();
      }
    });
  });
});
