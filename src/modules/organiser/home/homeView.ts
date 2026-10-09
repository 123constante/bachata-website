// Pure, client-free view model for the rebuilt Home (W1). Input is
// organiser_home_v1's JSON as selfServeApi.fetchOrganiserHome returns it.
import type { HomeOrganiser } from '@/modules/organiser/shared/selfServeApi';
import { upcomingDates, type WorkspaceDate } from '@/modules/organiser/shared/seriesModel';
import { toDraft, type Programme } from '@/modules/organiser/shared/programmeModel';
import { dateTag, ownerWeeklyRule } from '@/modules/organiser/shared/eventState';
import { calendarDate } from '@/modules/organiser/shared/homeModel';
import type { StatusTone } from '../ui';

export { dateTag };

/** How many dates the 'Next dates' list shows. */
export const NEXT_DATES_LIMIT = 8;
/** How many of those dates are checked for a teacher or DJ (one read each). */
export const LINEUP_CHECK_LIMIT = 5;
/** Under this many days of listed dates left, Home offers 'Extend'. */
export const RUNWAY_DAYS = 56;

export interface NextDate {
  seriesId: string;
  seriesName: string;
  occurrenceId: string;
  /** London calendar date, YYYY-MM-DD. */
  date: string;
  venueName: string | null;
  cancelled: boolean;
  tag: { tone: StatusTone; label: string };
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Every upcoming date of every event the user runs, soonest first. */
export function nextDates(organisers: readonly HomeOrganiser[], today: string, limit = NEXT_DATES_LIMIT): NextDate[] {
  const seen = new Set<string>();
  const out: NextDate[] = [];
  for (const org of organisers) {
    for (const s of org.series ?? []) {
      for (const d of s.next_dates ?? []) {
        if (!d?.occurrence_id || seen.has(d.occurrence_id) || (today && d.occurrence_date < today)) continue;
        seen.add(d.occurrence_id);
        const row = d as unknown as Record<string, unknown>;
        out.push({
          seriesId: s.id,
          seriesName: s.name,
          occurrenceId: d.occurrence_id,
          date: d.occurrence_date,
          venueName: text(row.venue_name) ?? text((s as unknown as Record<string, unknown>).default_venue_name),
          cancelled: d.lifecycle_status === 'cancelled',
          tag: dateTag(s.lifecycle_status, d.lifecycle_status),
        });
      }
    }
  }
  out.sort((a, b) => (a.date === b.date ? a.seriesName.localeCompare(b.seriesName) : a.date < b.date ? -1 : 1));
  return out.slice(0, limit);
}

/** Does the user run any event at all (past or future)? */
export const hasAnyEvent = (organisers: readonly HomeOrganiser[]) => organisers.some((o) => (o.series ?? []).length > 0);

// ---- (b) runway: 'Dates listed until <date>. Extend' -------------------------

export interface RunwayCandidate {
  seriesId: string;
  seriesName: string;
  /** Known straight from the home read when every upcoming date is in next_dates (3 or fewer). */
  lastDate: string | null;
}

/**
 * Repeating, running series that MAY have under RUNWAY_DAYS of dates left.
 * The home read lists only the next 3 dates and the upcoming count, so a
 * series with more than 8 upcoming dates (more than ~8 weeks at weekly or
 * slower) is taken as having enough runway without a further read. A lapsed
 * series (0 upcoming) is not a candidate: it simply has no upcoming dates.
 */
export function runwayCandidates(organisers: readonly HomeOrganiser[]): RunwayCandidate[] {
  const out: RunwayCandidate[] = [];
  const seen = new Set<string>();
  for (const org of organisers) {
    for (const s of org.series ?? []) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      const count = Number(s.upcoming_count) || 0;
      if (s.format !== 'recurring' || count < 1 || count > 8) continue;
      if (!['live', 'draft', 'pending_review', 'rejected'].includes(s.lifecycle_status)) continue;
      const dates = (s.next_dates ?? []).map((d) => d.occurrence_date).sort();
      out.push({ seriesId: s.id, seriesName: s.name, lastDate: count <= dates.length ? dates[dates.length - 1] ?? null : null });
    }
  }
  return out;
}

/**
 * True when the event's editor offers Extend: the owner's own weekly rule (every
 * week, one weekday). A monthly / custom / no-rule series has no Extend there,
 * so Home never nudges 'Extend' for it (F4: no copy pointing at a missing control).
 */
export const offersExtend = (series: { format: string | null; recurrence_rule: unknown }) => !!ownerWeeklyRule(series);

/** The last upcoming date of a series from its workspace read (null when none). */
export function lastUpcomingDate(dates: WorkspaceDate[], today: string): string | null {
  const up = upcomingDates(dates, today).map((d) => d.occurrence_date).sort();
  return up[up.length - 1] ?? null;
}

const dayNumber = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

/** Whole days from `today` to `date` (both London calendar dates). */
export const daysBetween = (today: string, date: string) => dayNumber(date) - dayNumber(today);

export interface RunwayStrip {
  seriesId: string;
  seriesName: string;
  lastDate: string;
  /** Further series also running short. */
  others: number;
}

/** The series that runs out soonest, when any has under RUNWAY_DAYS left. */
export function runwayStrip(resolved: { seriesId: string; seriesName: string; lastDate: string | null }[], today: string): RunwayStrip | null {
  const short = resolved
    .filter((r): r is typeof r & { lastDate: string } => !!r.lastDate && daysBetween(today, r.lastDate) < RUNWAY_DAYS)
    .sort((a, b) => (a.lastDate < b.lastDate ? -1 : a.lastDate > b.lastDate ? 1 : 0));
  if (short.length === 0) return null;
  return { ...short[0], others: short.length - 1 };
}

// ---- (c) 'N dates have no teacher or DJ yet' ----------------------------------

/**
 * True when a date's programme names nobody teaching or DJing. A programme the
 * organiser cannot change (past, cancelled, closed) is never flagged: there is
 * nothing for them to do.
 */
export function lacksTeacherOrDj(programme: Programme): boolean {
  if (!programme.editable) return false;
  const rows = toDraft(programme.sessions, programme.sessionPeople).filter((r) => !r.removed);
  return !rows.some((r) => (r.people ?? []).some((p) => !p.removed && (p.role === 'teaching' || p.role === 'djing')));
}

/** The dates (in list order) whose programme came back without a teacher or DJ. */
export function datesWithoutLineup(dates: NextDate[], programmes: Map<string, Programme>): NextDate[] {
  return dates.filter((d) => {
    const p = programmes.get(d.occurrenceId);
    return !!p && lacksTeacherOrDj(p);
  });
}

/**
 * The strip's words. Home reads the programme of only the first
 * LINEUP_CHECK_LIMIT dates that are not cancelled (`checked`), so the count is
 * out of those and the words say so; it is never presented as a total. Null
 * when nothing is missing (no strip).
 */
export function noLineupText(missing: number, checked: number): string | null {
  if (missing <= 0) return null;
  if (checked <= 1) return 'Your next date has no teacher or DJ yet';
  if (missing >= checked) return `Your next ${checked} dates have no teacher or DJ yet`;
  return `${missing} of your next ${checked} dates ${missing === 1 ? 'has' : 'have'} no teacher or DJ yet`;
}

/** Which dates Home checks for a line-up: the first few that are not cancelled. */
export const lineupCheckDates = (dates: NextDate[]) => dates.filter((d) => !d.cancelled).slice(0, LINEUP_CHECK_LIMIT);

/** Organisers whose incoming requests Home may read (owners and managers both can). */
export const requestReaders = (organisers: readonly HomeOrganiser[]) =>
  organisers.filter((o) => o.role === 'owner' || o.role === 'manager');

/** "Fri 20 Nov" for a London calendar date, "Sat 9 Jan 2027" outside today's year (shared calendarDate). */
export const shortDate = (iso: string, today: string): string => calendarDate(iso, today);
