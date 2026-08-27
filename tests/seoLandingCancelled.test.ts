// @vitest-environment node
/**
 * The SEO landing seam must not hand a cancelled occurrence to its listings.
 *
 * THE BUG THIS PINS (measured on prod, 2026-08-25). "Bachata Time by Spike"
 * moved from Tuesdays to Thursdays. Its final Tuesday, 25 Aug, was cancelled in
 * the admin editor; `get_calendar_events_v2` correctly returned that row with
 * is_cancelled = true, and the purge fired. /bachata-london-tuesday listed the
 * dead night anyway.
 *
 * WHY IT IS WORSE THAN A STRAY ROW, and why these cases assert ORDER rather than
 * mere absence. Both consumers of this seam collapse a recurring series to the
 * soonest occurrence per event_id (pages/seo/BachataWeekday,
 * components/seo/LiveEventsSection). A surviving cancelled row does not just
 * appear in the list -- it WINS that dedup, so the series' next LIVE date never
 * surfaces. Absence of the dead row and presence of the live one are two
 * different failures; a filter that dropped everything would satisfy only the
 * first, which is what `keeps live occurrences` below exists to catch.
 *
 * BOTH DIRECTIONS. Firing on the known-bad input is half a test
 * (admin CLAUDE.md, guards-and-review doctrine): these also prove the filter
 * cannot swallow legitimate rows, including the null-flag legacy shape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CalendarEventRow } from '@/integrations/supabase/eventRpcs';
import { SEO_LANDING_WINDOWS, fetchSeoLandingEvents } from '@/lib/seoLandingEvents';

const rows = vi.hoisted(() => ({ value: [] as unknown[] }));

vi.mock('@/integrations/supabase/eventRpcs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/integrations/supabase/eventRpcs')>();
  return { ...actual, getCalendarEvents: async () => rows.value };
});

const TODAY = '2026-08-25'; // a Tuesday, the day of the real incident

/**
 * Only the fields these listings actually read. Cast at the boundary rather than
 * building a full 39-column wire row: a fixture that has to be re-typed whenever
 * an unrelated column lands is a fixture that rots.
 */
const row = (
  over: Partial<CalendarEventRow> & Pick<CalendarEventRow, 'event_id' | 'instance_date'>,
): CalendarEventRow =>
  ({
    name: 'Bachata Time by Spike',
    location: 'Marmalade Club',
    is_cancelled: false,
    ...over,
  }) as CalendarEventRow;

const SERIES = '86aafbc9-4e54-41b6-9891-313044a3023b';

beforeEach(() => {
  rows.value = [];
});

describe('SEO landing seam -- cancelled occurrences', () => {
  it('drops a cancelled occurrence so the next live date wins the dedup', async () => {
    // The exact prod shape: the cancelled Tuesday sorts FIRST, so it is the row
    // the consumers' "soonest per event_id" dedup would otherwise keep.
    rows.value = [
      row({ event_id: SERIES, instance_date: '2026-08-25', is_cancelled: true }),
      row({ event_id: SERIES, instance_date: '2026-08-27' }),
      row({ event_id: SERIES, instance_date: '2026-09-03' }),
    ];

    const out = await fetchSeoLandingEvents(TODAY, SEO_LANDING_WINDOWS.weekday);

    expect(out.map((e) => e.instance_date)).toEqual(['2026-08-27', '2026-09-03']);
    // The consequence, stated separately from the absence: what the dedup keeps
    // is the live night. This is the assertion that fails if a future change
    // re-admits cancelled rows while still "filtering" something.
    expect(out[0].instance_date).toBe('2026-08-27');
    expect(out[0].is_cancelled).toBe(false);
  });

  it('keeps live occurrences -- the filter must not empty the listings', async () => {
    // Non-vacuity. Without this, `rows.filter(() => false)` passes every other
    // case in this file and blanks all nine landing pages.
    rows.value = [
      row({ event_id: 'a', instance_date: '2026-08-25' }),
      row({ event_id: 'b', instance_date: '2026-08-26' }),
    ];

    const out = await fetchSeoLandingEvents(TODAY, SEO_LANDING_WINDOWS.weekday);

    expect(out).toHaveLength(2);
    expect(out.map((e) => e.event_id)).toEqual(['a', 'b']);
  });

  it('treats a null cancellation flag as NOT cancelled', async () => {
    // Legacy rows predate the flag. Hiding a live event costs a dancer their
    // night; listing one that turns out to be off costs them a wasted trip that
    // the event page still warns about. The safe default is to show.
    rows.value = [
      row({ event_id: 'legacy', instance_date: '2026-08-25', is_cancelled: null as never }),
      row({ event_id: 'undef', instance_date: '2026-08-26', is_cancelled: undefined as never }),
    ];

    const out = await fetchSeoLandingEvents(TODAY, SEO_LANDING_WINDOWS.weekday);

    expect(out.map((e) => e.event_id)).toEqual(['legacy', 'undef']);
  });

  it('drops a series whose only dates in the window are cancelled', async () => {
    // Spike's actual Tuesday state after the move: no live Tuesday remains, so
    // the series must leave /bachata-london-tuesday entirely rather than linger
    // as a dead entry on an SEO page Google indexes as "what's on".
    rows.value = [row({ event_id: SERIES, instance_date: '2026-08-25', is_cancelled: true })];

    const out = await fetchSeoLandingEvents(TODAY, SEO_LANDING_WINDOWS.weekday);

    expect(out).toEqual([]);
  });
});
