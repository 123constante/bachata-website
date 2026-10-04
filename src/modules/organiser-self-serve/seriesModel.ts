// Pure, client-free view model for the organiser's series page (Lever 2 W4,
// mockup 04-A) and its one-date action sheet (W5, mockup 03-A). Input is
// admin_event_workspace_p5's JSON (the owner may call it: the RPC admits an
// organiser member of the series) and event_view_p5's occurrence shape read
// with the `organiser` viewer role (series-scoped since admin D1).
//
// Times: occurrence and programme times are LOCAL-as-Z (ADR-002). The digits
// of materialised_start_utc ARE London wall-clock time, so they are read off
// the string and never converted through Date.

import { dateLabel, localAsZTime } from './homeModel';
import type { BasicsDraft } from './seriesCommands';

export { dateLabel, localAsZTime };

export interface WorkspaceSeries {
  id: string;
  name: string;
  slug: string | null;
  format: string | null;
  category: string | null;
  lifecycle_status: string;
  version: number;
  default_venue_id: string | null;
  default_local_start_time: string | null;
  /** Postgres interval text, e.g. "02:00:00". */
  default_duration: string | null;
  default_level: string | null;
  default_ticket_url: string | null;
  default_description: string | null;
  default_cover_image_url: string | null;
  default_start_date: string | null;
  created_at: string | null;
  recurrence_rule: unknown;
  /** Tombstoned dates (breaks and removed dates), YYYY-MM-DD. */
  removed_dates: string[];
}

export interface WorkspaceDate {
  id: string;
  occurrence_date: string;
  lifecycle_status: string;
  version: number;
  has_override: boolean;
  session_overrides_count: number;
  added_sessions_count: number;
  materialised_start_utc: string | null;
}

export interface SeriesWorkspace {
  series: WorkspaceSeries;
  /** True when the series has at least one programme session with a start time. */
  hasSessions: boolean;
  dates: WorkspaceDate[];
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || fallback);

function programHasSessions(program: unknown): boolean {
  if (!Array.isArray(program)) return false;
  return program.some((day) =>
    Array.isArray((day as { sections?: unknown })?.sections) &&
    (day as { sections: unknown[] }).sections.some((section) =>
      Array.isArray((section as { items?: unknown })?.items) &&
      (section as { items: unknown[] }).items.some((entry) => {
        const item = (entry as { item?: { start_time?: unknown } })?.item;
        return typeof item?.start_time === 'string' && item.start_time !== '';
      }),
    ),
  );
}

/** admin_event_workspace_p5 → the page's model. Unknown shapes degrade to empty. */
export function parseWorkspace(raw: unknown): SeriesWorkspace {
  const root = (raw ?? {}) as { series?: { series?: Record<string, unknown>; program?: unknown }; occurrences?: unknown };
  const s = root.series?.series ?? {};
  const series: WorkspaceSeries = {
    id: String(s.id ?? ''),
    name: String(s.name ?? ''),
    slug: str(s.slug),
    format: str(s.format),
    category: str(s.category),
    lifecycle_status: String(s.lifecycle_status ?? ''),
    version: num(s.version),
    default_venue_id: str(s.default_venue_id),
    default_local_start_time: str(s.default_local_start_time),
    default_duration: str(s.default_duration),
    default_level: str(s.default_level),
    default_ticket_url: str(s.default_ticket_url),
    default_description: str(s.default_description),
    default_cover_image_url: str(s.default_cover_image_url),
    default_start_date: str(s.default_start_date),
    created_at: str(s.created_at),
    recurrence_rule: s.recurrence_rule ?? null,
    removed_dates: Array.isArray(s.removed_dates) ? (s.removed_dates as unknown[]).map(String) : [],
  };
  const dates: WorkspaceDate[] = (Array.isArray(root.occurrences) ? root.occurrences : []).map((o: Record<string, unknown>) => ({
    id: String(o.id),
    occurrence_date: String(o.occurrence_date),
    lifecycle_status: String(o.lifecycle_status ?? 'scheduled'),
    version: num(o.version, 1),
    has_override: o.has_override === true,
    session_overrides_count: num(o.session_overrides_count),
    added_sessions_count: num(o.added_sessions_count),
    materialised_start_utc: str(o.materialised_start_utc),
  }));
  return { series, hasSessions: programHasSessions(root.series?.program), dates };
}

/** The date's own state, from event_view_p5 (occurrence target, organiser role). */
export interface DateDetail {
  occurrenceId: string;
  date: string;
  version: number;
  cancelled: boolean;
  cancellationReason: string | null;
  /** Effective local start/end, HH:MM (per-date time changes included). */
  start: string | null;
  end: string | null;
  /** Per-date overrides; null = the date follows the series. */
  venueOverride: string | null;
  descriptionOverride: string | null;
  coverImageOverride: string | null;
  ticketUrlOverride: string | null;
  /** The effective values (override, else the series). */
  venueId: string | null;
  ticketUrl: string | null;
  coverImageUrl: string | null;
  sessionCount: number;
}

const hhmm = (t: unknown) => (typeof t === 'string' && /^\d{2}:\d{2}/.test(t) ? t.slice(0, 5) : null);

export function parseDateDetail(raw: unknown): DateDetail {
  const root = (raw ?? {}) as { event?: Record<string, unknown>; occurrence?: Record<string, unknown>; schedule?: Record<string, unknown>; program?: unknown; added_sessions?: unknown };
  const e = root.event ?? {};
  const o = root.occurrence ?? {};
  const sch = root.schedule ?? {};
  const program = Array.isArray(root.program) ? root.program : [];
  const added = Array.isArray(root.added_sessions) ? root.added_sessions : [];
  return {
    occurrenceId: String(o.id ?? ''),
    date: String(o.date ?? ''),
    version: num(o.version, 1),
    cancelled: o.lifecycle_status === 'cancelled',
    cancellationReason: str(e.cancellation_reason_label),
    start: hhmm(sch.local_start_time) ?? localAsZTime(str(o.materialised_start_utc)),
    end: hhmm(sch.local_end_time) ?? localAsZTime(str(o.materialised_end_utc)),
    venueOverride: str(e.venue_id_override),
    descriptionOverride: str(e.description_override),
    coverImageOverride: str(e.cover_image_url_override),
    ticketUrlOverride: str(e.ticket_url_override),
    venueId: str(e.venue_id),
    ticketUrl: str(e.ticket_url),
    coverImageUrl: str(e.cover_image_url),
    sessionCount: program.filter((p) => (p as { start_time?: unknown })?.start_time && (p as { cancelled?: unknown }).cancelled !== true).length + added.length,
  };
}

// ---- times -------------------------------------------------------------------

/** "02:00:00" → 120. Only the HH:MM:SS interval form the column holds; else null. */
export function durationMinutes(interval: string | null | undefined): number | null {
  const m = interval?.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  return minutes > 0 ? minutes : null;
}

const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const pad = (n: number) => String(n).padStart(2, '0');

/** Wall-clock end from a HH:MM start and a duration, wrapping past midnight. */
export function endTime(start: string | null, minutes: number | null): string | null {
  if (!start || !/^\d{2}:\d{2}/.test(start) || !minutes) return null;
  const total = (toMinutes(start) + minutes) % 1440;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** Minutes from start to end; an end before the start crosses midnight. Equal → null. */
export function minutesBetween(start: string, end: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
  const diff = (toMinutes(end) - toMinutes(start) + 1440) % 1440;
  return diff === 0 ? null : diff;
}

// ---- dates -------------------------------------------------------------------

export const isCancelledDate = (d: WorkspaceDate) => d.lifecycle_status === 'cancelled';

/**
 * A date that keeps its own changes when the series is edited: an override row
 * (a cancellation reason, a venue, a note, a picture, a link), a per-date
 * session time or an added session. Series edits never overwrite these.
 */
export const keepsOwnChanges = (d: WorkspaceDate) =>
  d.has_override || d.session_overrides_count > 0 || d.added_sessions_count > 0 || isCancelledDate(d);

export function upcomingDates(dates: WorkspaceDate[], today: string): WorkspaceDate[] {
  return dates.filter((d) => d.occurrence_date >= today).sort((a, b) => a.occurrence_date.localeCompare(b.occurrence_date));
}

/** "2 dates keep their own changes: Tue 6 Oct (own changes) and Tue 13 Oct (cancelled)." */
export function scopeNote(upcoming: WorkspaceDate[], today: string): { count: number; text: string } {
  const own = upcoming.filter(keepsOwnChanges);
  if (own.length === 0) {
    return { count: 0, text: 'A change here applies to every future date. No date has its own changes yet.' };
  }
  const named = own.slice(0, 3).map((d) => `${dateLabel(d.occurrence_date, today)} (${isCancelledDate(d) ? 'cancelled' : 'own changes'})`);
  const rest = own.length - named.length;
  const list = rest > 0 ? `${named.join(', ')} and ${rest} more` : named.length > 1 ? `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}` : named[0];
  const noun = own.length === 1 ? 'date keeps its' : 'dates keep their';
  return {
    count: own.length,
    text: `A change here applies to every future date. ${own.length} ${noun} own changes: ${list}. Series edits never overwrite a date you changed yourself.`,
  };
}

// ---- the weekly rule ---------------------------------------------------------

export interface WeeklyRule {
  /** 0 = Sunday … 6 = Saturday (the server's convention, measured on E2E). */
  weekdays: number[];
  interval: number;
  until: string | null;
}

export function weeklyRule(rule: unknown): WeeklyRule | null {
  const r = rule as { mode?: unknown; weekdays?: unknown; interval?: unknown; end?: { kind?: unknown; date?: unknown } } | null;
  if (!r || r.mode !== 'weekly' || !Array.isArray(r.weekdays)) return null;
  return {
    weekdays: r.weekdays.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
    interval: r.interval == null ? 1 : Number(r.interval) || 1,
    until: r.end?.kind === 'until_date' && typeof r.end.date === 'string' ? r.end.date : null,
  };
}

const weekdayOf = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

const WEEKDAY_PLURAL = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

/**
 * Whether the series' own weekly rule generates this date. Only such a date
 * can be a break (series.skip_date): the server's unskip refuses a tombstone
 * off the rule's cadence, so skipping an ad-hoc date would leave it with no
 * way back (the server's own note on _cmd_series_skip_date_p5). Only the
 * every-week rule an owner can set is recognised; anything else answers false
 * and the date is offered "Remove" instead.
 */
export function isRuleDate(date: string, series: Pick<WorkspaceSeries, 'recurrence_rule' | 'default_start_date' | 'created_at'>): boolean {
  const rule = weeklyRule(series.recurrence_rule);
  if (!rule || rule.interval !== 1 || !rule.weekdays.includes(weekdayOf(date))) return false;
  const anchor = series.default_start_date ?? series.created_at?.slice(0, 10) ?? null;
  if (anchor && date < anchor) return false;
  if (rule.until && date > rule.until) return false;
  return true;
}

/** "Weekly · Sundays · 19:30–21:30" (or "One-off · 19:30"). */
export function scheduleSummary(series: WorkspaceSeries): string {
  const rule = weeklyRule(series.recurrence_rule);
  const start = series.default_local_start_time?.slice(0, 5) ?? null;
  const end = endTime(start, durationMinutes(series.default_duration));
  const parts: string[] = [];
  if (rule && rule.weekdays.length > 0) {
    parts.push(rule.interval === 1 ? 'Weekly' : `Every ${rule.interval} weeks`);
    parts.push(rule.weekdays.map((d) => WEEKDAY_PLURAL[d]).join(', '));
  } else {
    parts.push(series.format === 'recurring' ? 'Repeating' : 'One-off');
  }
  if (start) parts.push(end ? `${start}–${end}` : start);
  return parts.join(' · ');
}

/** Future tombstones the organiser can put back. */
export function removedUpcoming(series: WorkspaceSeries, today: string): string[] {
  return series.removed_dates.filter((d) => d >= today).sort();
}

// ---- lifecycle ---------------------------------------------------------------

export type LifecycleTarget = 'paused' | 'live' | 'archived';

export interface LifecycleAction {
  to: LifecycleTarget;
  label: string;
  /** Archive asks again before it is sent. */
  confirm: boolean;
}

/**
 * Pause, resume and archive: the owner transitions the server admits
 * (_owner_lifecycle_transition_allowed_p5, admin migration 20261108130000)
 * restricted to the three this screen offers. Submitting a draft or a
 * returned series for review is the review strip's (W6, ReviewStrip.tsx).
 */
const OWNER_TRANSITIONS: Record<string, LifecycleTarget[]> = {
  draft: ['archived'],
  live: ['paused', 'archived'],
  paused: ['live', 'archived'],
};

const ACTION_LABEL: Record<LifecycleTarget, string> = { paused: 'Pause', live: 'Resume', archived: 'Archive' };

export function lifecycleActions(status: string): LifecycleAction[] {
  return (OWNER_TRANSITIONS[status] ?? []).map((to) => ({ to, label: ACTION_LABEL[to], confirm: to === 'archived' }));
}

// ---- the basics form -----------------------------------------------------------

/** What the basics form edits; times are HH:MM London wall-clock. */
export interface BasicsForm {
  name: string;
  description: string;
  venueId: string | null;
  startTime: string;
  endTime: string;
  level: string;
  ticketUrl: string;
  coverImageUrl: string;
}

export function basicsFormFromSeries(s: WorkspaceSeries): BasicsForm {
  const start = s.default_local_start_time?.slice(0, 5) ?? '';
  return {
    name: s.name,
    description: s.default_description ?? '',
    venueId: s.default_venue_id,
    startTime: start,
    endTime: endTime(start || null, durationMinutes(s.default_duration)) ?? '',
    level: s.default_level ?? '',
    ticketUrl: s.default_ticket_url ?? '',
    coverImageUrl: s.default_cover_image_url ?? '',
  };
}

export function formToDraft(f: BasicsForm): BasicsDraft {
  return {
    name: f.name,
    description: f.description,
    venueId: f.venueId,
    startTime: f.startTime,
    durationMinutes: f.startTime && f.endTime ? minutesBetween(f.startTime, f.endTime) : null,
    level: f.level,
    ticketUrl: f.ticketUrl,
    coverImageUrl: f.coverImageUrl,
  };
}

export const LEVEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'open_level', label: 'All levels' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'improver', label: 'Improver' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];
