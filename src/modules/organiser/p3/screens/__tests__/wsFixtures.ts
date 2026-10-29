import { addDaysToKey } from '@/lib/londonDate';
import { parseEventWorkspace, type EventWorkspace } from '../../../events/eventModel';

/**
 * admin_event_workspace_p5 payloads in every shape CONTRACT.md section 1 lists, as the
 * RPC sends them, read through the REAL parser (parseEventWorkspace). Shapes from the
 * read-only prod survey of 26 Oct 2026 (counts only): weekly / monthly / dates-I-pick /
 * course / festival (2 programme days) / one-off; live, paused, draft, ended, archived;
 * cancelled coming dates; a date today; a series with 131 dates (the read holds the newest
 * 100, 57 of them still to come); 0 sessions; an empty line-up; a party with no time;
 * roles teaching / djing / performing / mc. Names are stand-ins, never real organisers.
 */
export const TODAY = '2026-10-25';

type Raw = Record<string, unknown>;
type Person = [name: string, role: string];

export const item = (id: string, type: string, title: string | null, start: string | null, end: string | null, people: Person[] = [], levels: string[] = []) => ({
  item: { id, type, title, start_time: start ? `${start}:00` : null, end_time: end ? `${end}:00` : null, level_keys: levels },
  people: people.map(([name, role], i) => ({ profile_id: `p-${id}-${i}`, display_name: name, profile_type: role === 'djing' ? 'dj' : 'teacher', role })),
});

export const program = (...days: Array<ReturnType<typeof item>[]>) =>
  days.map((items, i) => ({ day: { id: `day${i}`, label: null }, sections: [{ section: { id: `sec${i}`, kind: 'party' }, items }] }));

export const occ = (date: string, status = 'scheduled', extra: Raw = {}) => ({
  id: `o-${date}`, occurrence_date: date, lifecycle_status: status, version: 3,
  has_override: false, session_overrides_count: 0, added_sessions_count: 0, materialised_start_utc: null, ...extra,
});

/** `n` dates a week apart from `from` (a Friday by default). */
export const weekly = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDaysToKey(from, i * 7));

export function wsRaw(series: Raw, prog: unknown, dates: unknown[], meta: Raw = {}): Raw {
  return {
    series: {
      series: {
        id: 'ser-1', name: 'Sensual Fridays', slug: 'sensual-fridays', format: 'recurring', category: 'party',
        lifecycle_status: 'live', version: 7, default_venue_id: 'v1', default_local_start_time: '20:00:00',
        default_description: 'Two rooms, one class.', default_ticket_url: 'https://tickets.example.test/sf',
        default_cover_image_url: null, instagram_url: null, default_music_styles: ['Bachata', 'Sensual Bachata'],
        recurrence_rule: { mode: 'weekly', weekdays: [5], interval: 1, end: { kind: 'none' } }, removed_dates: [],
        ...series,
      },
      program: prog,
    },
    occurrences: [...dates].sort((a, b) => String((b as Raw).occurrence_date).localeCompare(String((a as Raw).occurrence_date))),
    program_forward: [],
    meta: { has_more: false, total: dates.length, ...meta },
  };
}

const TWO = program([
  item('cls', 'class', 'Bachata class', '20:00', '21:00', [['Marco & Elena', 'teaching']], ['open_level']),
  item('pty', 'party', 'Social', '21:00', '01:00', [['DJ Kizzy', 'djing'], ['Host Sam', 'mc']]),
]);
const PARTY = program([item('pty', 'party', null, '21:00', '02:00', [['DJ Kizzy', 'djing']])]);

const FRI = weekly('2026-10-16', 12);
const futureFri = FRI.filter((d) => d >= TODAY);

/** The 131-date series: the read holds the newest 100 (43 past, 57 coming), has_more, total 131. */
const OVER = weekly(addDaysToKey(TODAY, -43 * 7 + 2), 100);

export const SHAPES = {
  weekly: wsRaw({}, TWO, FRI.map((d) => d === '2026-11-06' ? occ(d, 'cancelled') : d === '2026-11-13' ? occ(d, 'scheduled', { has_override: true }) : occ(d))),
  over100: wsRaw({ name: 'Long Tuesdays' }, PARTY, OVER.map((d) => occ(d)), { has_more: true, total: 131 }),
  monthly: wsRaw({ name: 'First Saturdays', recurrence_rule: { mode: 'monthly', nth_weekday: { n: 1, weekday: 6 } } }, TWO,
    ['2026-10-03', '2026-11-07', '2026-12-05'].map((d) => occ(d))),
  custom: wsRaw({ name: 'Picked Nights', recurrence_rule: { mode: 'custom', dates: [] } }, PARTY, ['2026-09-12', '2026-10-10'].map((d) => occ(d))),
  course: wsRaw({ name: 'Beginners Course', format: 'course', category: 'class' },
    program([item('c', 'class', 'Week by week', '19:00', '20:00', [['Lena Ortiz', 'teaching']], ['beginner'])]),
    weekly('2026-10-07', 8).map((d) => occ(d))),
  courseDone: wsRaw({ name: 'Summer Course', format: 'course', category: 'class' },
    program([item('c', 'class', 'Week by week', '19:00', '20:00', [['Lena Ortiz', 'teaching']])]),
    weekly('2026-08-05', 8).map((d) => occ(d))),
  festival: wsRaw({ name: 'Winter Festival', format: 'festival', category: null, recurrence_rule: null },
    program(
      [item('f1', 'workshop', 'Footwork', '14:00', '15:00', [['Pao Pao Army', 'performing']]), item('f2', 'party', 'Opening party', '21:00', '03:00', [['DJ Kizzy', 'djing']])],
      [item('f3', 'masterclass', 'Musicality', '13:00', '14:30', [['Marco & Elena', 'teaching']])],
    ),
    [occ('2026-11-20')]),
  oneoff: wsRaw({ name: 'Halloween Party', format: 'one_off', recurrence_rule: null }, PARTY, [occ('2026-10-31')]),
  oneoffPast: wsRaw({ name: 'Summer Party', format: 'one_off', recurrence_rule: null }, PARTY, [occ('2026-08-01')]),
  tonight: wsRaw({ name: 'Sunday Social' }, PARTY, weekly(addDaysToKey(TODAY, -14), 6).map((d) => occ(d))),
  paused: wsRaw({ lifecycle_status: 'paused' }, TWO, futureFri.map((d) => occ(d))),
  draft: wsRaw({ name: '', format: 'one_off', lifecycle_status: 'draft', recurrence_rule: null, default_description: null, default_ticket_url: null, default_music_styles: [] }, [], []),
  draftReady: wsRaw({ name: 'New Thursdays', lifecycle_status: 'draft', default_cover_image_url: 'https://example.test/cover.jpg' }, PARTY, weekly('2026-10-29', 4).map((d) => occ(d))),
  ended: wsRaw({ name: 'Old Wednesdays', lifecycle_status: 'ended', recurrence_rule: null }, PARTY, weekly('2026-06-03', 10).map((d) => occ(d))),
  archived: wsRaw({ name: 'Gone Nights', lifecycle_status: 'archived', recurrence_rule: null }, [], []),
  noSessions: wsRaw({ name: 'Empty Mondays' }, [], weekly('2026-10-26', 4).map((d) => occ(d))),
  noTime: wsRaw({ name: 'Late Saturdays' }, program([item('p', 'party', 'Social', null, null)]), weekly('2026-10-31', 4).map((d) => occ(d))),
  emptyLineup: wsRaw({ name: 'Quiet Thursdays' }, program([item('p', 'party', 'Social', '21:00', '00:00')]), weekly('2026-10-29', 4).map((d) => occ(d))),
} satisfies Record<string, Raw>;

export type ShapeKey = keyof typeof SHAPES;
export const SHAPE_KEYS = Object.keys(SHAPES) as ShapeKey[];

export const ws = (k: ShapeKey): EventWorkspace => parseEventWorkspace(SHAPES[k]);

/* W3b-1 History: organiser_series_history_v1 payloads in the live shape (pg_get_functiondef 28 Oct 2026). */
export const histItem = (at: string, extra: Raw = {}): Raw => ({ at, kind: 'series.upsert', label: 'Changed the details', who: 'you', date: null, fields: [], ...extra });
/** n rows, one per hour back from `from` (newest first), as the RPC orders them. */
export const histItems = (n: number, from = '2026-10-25T18:00:00+00:00'): Raw[] =>
  Array.from({ length: n }, (_, i) => histItem(new Date(Date.parse(from) - i * 3_600_000).toISOString()));
export const histPage = (items: unknown[], more = false, seriesId = 'ser-1'): Raw => ({
  series_id: seriesId, items, has_more: more, next_before: more ? (items[items.length - 1] as Raw).at : null,
});
