// Pure view model for the rebuilt event editor (W2). Reads admin_event_workspace_p5
// through the old parser (seriesModel.parseWorkspace) and adds the three lists that
// parser drops (music styles, gallery, videos). Builds the owner commands a save
// sends, from the old command builders, and only for the fields that changed.

import { weekdayOfKey } from '@/lib/londonDate';
import { dateLabel } from '@/modules/organiser/shared/homeModel';
import { linkProblem } from '@/modules/organiser/shared/linkRules';
import {
  addDateCommand,
  removeDateCommand,
  upsertCommand,
  type OwnerCommand,
} from '@/modules/organiser/shared/seriesCommands';
import {
  parseWorkspace,
  upcomingDates,
  type SeriesWorkspace,
  type WorkspaceDate,
} from '@/modules/organiser/shared/seriesModel';
import { eventLock, ownerWeeklyRule } from '@/modules/organiser/shared/eventState';
import { MAX_UPCOMING, endWithinCap, type CapInput } from './dateCap';
import { ownerOneDate, scheduleView } from './schedule';

export interface EventWorkspace extends SeriesWorkspace {
  musicStyles: string[];
  gallery: string[];
  videoUrls: string[];
  /** event_series_p5.ended_on (an ended event's last day), YYYY-MM-DD. */
  endedOn: string | null;
  /** The read holds only the newest 100 dates (admin_event_workspace_p5 meta.has_more). */
  hasMore: boolean;
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []);

export function parseEventWorkspace(raw: unknown): EventWorkspace {
  const root = raw as { series?: { series?: Record<string, unknown> }; meta?: { has_more?: unknown } } | null;
  const row = (root?.series?.series ?? {}) as Record<string, unknown>;
  return {
    ...parseWorkspace(raw),
    musicStyles: strings(row.default_music_styles),
    gallery: strings(row.gallery),
    videoUrls: strings(row.video_urls),
    endedOn: typeof row.ended_on === 'string' ? row.ended_on : null,
    hasMore: root?.meta?.has_more === true,
  };
}

/** The music styles offered as chips; a stored style outside this list is shown too. */
export const MUSIC_STYLES = ['Bachata', 'Sensual Bachata', 'Dominican Bachata', 'Salsa', 'Kizomba', 'Brazilian Zouk', 'Merengue', 'Reggaeton'];
export const MAX_GALLERY = 30;
export const MAX_VIDEOS = 10;

export type Shape = 'weekly' | 'single';
export const SHAPE_LABEL: Record<Shape, string> = { weekly: 'Every week', single: 'One date' };
const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const weekdayName = (date: string) => WEEKDAY_LONG[weekdayOfKey(date)];

export interface EventDraft {
  name: string;
  description: string;
  venueId: string | null;
  ticketUrl: string;
  coverUrl: string;
  gallery: string[];
  videos: string[];
  styles: string[];
  /** 'Starts on' (default_start_date), YYYY-MM-DD; '' when unknown. */
  startDate: string;
  shape: Shape;
  /** The weekly rule's end ('Listed until'); null = open-ended. */
  until: string | null;
}

/**
 * 'Starts on' as the organiser should read it: the stored start, unless that date
 * was taken off (a break or a removed date tombstones it in removed_dates, and the
 * stored start stays put), then the first date still listed after it.
 */
export function listedStart(ws: EventWorkspace, today: string): string {
  const s = ws.series;
  const stored = s.default_start_date;
  const upcoming = upcomingDates(ws.dates, today);
  if (!stored) return upcoming[0]?.occurrence_date ?? '';
  if (!s.removed_dates.includes(stored) || ws.dates.some((d) => d.occurrence_date === stored)) return stored;
  return [...ws.dates.map((d) => d.occurrence_date)].filter((d) => d > stored).sort()[0] ?? stored;
}

export function draftFromWorkspace(ws: EventWorkspace, today: string): EventDraft {
  const s = ws.series;
  // Only the owner's own rule (every week, one weekday) is drawn as 'weekly', plus the
  // weekly setup of a recurring series with no rule and no date yet (scheduleView):
  // monthly / custom / no-rule shapes are shown by scheduleView, never edited.
  const rule = ownerWeeklyRule(s) ?? null;
  const setup = !rule && ownerOneDate(s, ws.dates) && ws.dates.length === 0 && !eventLock(s.lifecycle_status);
  return {
    name: s.name,
    description: s.default_description ?? '',
    venueId: s.default_venue_id,
    ticketUrl: s.default_ticket_url ?? '',
    coverUrl: s.default_cover_image_url ?? '',
    gallery: ws.gallery,
    videos: ws.videoUrls,
    styles: ws.musicStyles,
    startDate: listedStart(ws, today),
    shape: rule || setup ? 'weekly' : 'single',
    until: rule?.until ?? null,
  };
}

export type DraftField = keyof EventDraft;
export const FIELD_LABEL: Record<DraftField, string> = {
  name: 'the name', description: 'the description', venueId: 'the place', ticketUrl: 'the ticket link',
  coverUrl: 'the cover', gallery: 'the gallery', videos: 'the videos', styles: 'the music styles',
  startDate: 'the start date', shape: 'how it repeats', until: 'how long it is listed',
};

const norm = (v: unknown) => JSON.stringify(typeof v === 'string' ? v.trim() : v ?? null);
export const sameField = (a: EventDraft, b: EventDraft, f: DraftField) => norm(a[f]) === norm(b[f]);

export function changedFields(base: EventDraft, draft: EventDraft): DraftField[] {
  return (Object.keys(FIELD_LABEL) as DraftField[]).filter((f) => !sameField(base, draft, f));
}

/**
 * Fields the organiser changed that someone else changed too since the screen
 * loaded them (base = what the screen loaded, fresh = what the server holds now).
 * A save is refused for these rather than overwriting the other change.
 */
export function conflictingFields(base: EventDraft, fresh: EventDraft, draft: EventDraft): DraftField[] {
  return changedFields(base, draft).filter((f) => !sameField(base, fresh, f));
}

/** Upcoming dates the weekly rule does not generate (hand-added); they count toward the cap. */
export function otherUpcoming(dates: WorkspaceDate[], today: string, startDate: string): number {
  if (!startDate) return 0;
  const wd = weekdayOfKey(startDate);
  return upcomingDates(dates, today).filter((d) => weekdayOfKey(d.occurrence_date) !== wd || d.occurrence_date < startDate).length;
}

export const capInput = (ws: EventWorkspace, draft: EventDraft, today: string): CapInput => ({
  today,
  startDate: draft.startDate,
  otherUpcoming: otherUpcoming(ws.dates, today, draft.startDate),
});

const SCHEDULE_FIELDS: DraftField[] = ['startDate', 'shape', 'until'];

/**
 * What is wrong with the draft in plain words; null when it can be saved. With
 * `base`, the date rules are checked only when the organiser changed the date
 * fields: a series stored with more than 30 upcoming dates, or with no end,
 * still saves a new name.
 */
export function draftProblem(draft: EventDraft, ws: EventWorkspace, today: string, base?: EventDraft): string | null {
  if (!draft.name.trim()) return 'Give your event a name.';
  if (draft.name.trim().length > 120) return 'Keep the name under 120 characters.';
  if (draft.description.length > 4000) return 'Keep the description under 4,000 characters.';
  // The same rule the ticket and video sheets apply inline (shared/linkRules).
  const link = linkProblem('ticket', draft.ticketUrl) ?? draft.videos.map((v) => linkProblem('video', v)).find(Boolean) ?? null;
  if (link) return link;
  if (base && SCHEDULE_FIELDS.every((f) => sameField(base, draft, f))) return null;
  if (!draft.startDate) return 'Choose the date it starts on.';
  if (draft.shape === 'weekly') {
    if (!draft.until) return `Choose how long it is listed (up to ${MAX_UPCOMING} upcoming dates).`;
    if (!endWithinCap(capInput(ws, draft, today), draft.until)) return `That is more than ${MAX_UPCOMING} upcoming dates. Choose an earlier end.`;
  }
  return null;
}

/** series.set_recurrence for the owner's one rule: every week on one weekday, ending on a date. */
export const weeklyUntilCommand = (startDate: string, until: string): OwnerCommand => ({
  kind: 'series.set_recurrence',
  payload: { mode: 'weekly', weekdays: [weekdayOfKey(startDate)], end: { kind: 'until_date', date: until } },
});

/** series.stop_repeating, keeping the given dates. */
export const stopRepeatingCommand = (keepIds: string[]): OwnerCommand => ({
  kind: 'series.stop_repeating',
  payload: { keep_occurrence_ids: keepIds },
});

/**
 * The commands a save sends, in order, each against the version the one before
 * returned. series.upsert carries `name` always (the handler needs it) plus ONLY
 * the changed fields. `cityId` is the new venue's city (city is automatic).
 */
export function savePlan(base: EventDraft, draft: EventDraft, ws: EventWorkspace, today: string, cityId?: string | null): OwnerCommand[] {
  // An ended or archived event takes no owner write (the server refuses them all).
  if (eventLock(ws.series.lifecycle_status)) return [];
  const view = scheduleView(ws.series, ws.dates);
  const mode = view.mode;
  // A one-date event that may be made weekly (recurring, no rule: G5).
  const canRepeat = mode === 'single' && view.repeatsReason === null;
  const changed = new Set(changedFields(base, draft));
  // Date fields this screen does not draw for this shape are never sent.
  if (mode === 'fixed') SCHEDULE_FIELDS.forEach((f) => changed.delete(f));
  if (mode === 'single' && !canRepeat) changed.delete('shape');
  const cmds: OwnerCommand[] = [];
  const payload: Record<string, unknown> = { name: draft.name.trim() };
  if (changed.has('description')) payload.default_description = draft.description.trim();
  if (changed.has('venueId') && draft.venueId) {
    payload.default_venue_id = draft.venueId;
    if (cityId) payload.default_city_id = cityId;
  }
  if (changed.has('ticketUrl')) payload.default_ticket_url = draft.ticketUrl.trim();
  if (changed.has('coverUrl')) payload.default_cover_image_url = draft.coverUrl.trim();
  if (changed.has('gallery')) payload.default_gallery = draft.gallery;
  if (changed.has('videos')) payload.default_video_urls = draft.videos.map((v) => v.trim());
  if (changed.has('styles')) payload.default_music_styles = draft.styles;
  if (changed.has('startDate')) payload.default_start_date = draft.startDate;
  if (Object.keys(payload).length > 1 || changed.has('name')) cmds.push(upsertCommand(payload));

  const upcoming = upcomingDates(ws.dates, today).filter((d) => d.lifecycle_status !== 'cancelled');
  if (mode === 'fixed') return cmds;
  // A one-date event (mode 'single') can only move its date, never start repeating here.
  if ((mode === 'weekly' || canRepeat) && draft.shape === 'weekly') {
    if (draft.until && (changed.has('shape') || changed.has('startDate') || changed.has('until'))) {
      cmds.push(weeklyUntilCommand(draft.startDate, draft.until));
      // One date -> weekly from a new start: the old date is off the rule's path, so it goes.
      const old = canRepeat ? upcoming.find((d) => d.occurrence_date === base.startDate) : undefined;
      if (old && (old.occurrence_date < draft.startDate || weekdayOfKey(old.occurrence_date) !== weekdayOfKey(draft.startDate))) {
        cmds.push(removeDateCommand(old.id));
      }
    }
  } else if (changed.has('shape')) {
    // Weekly -> one date: keep the date it starts on if it is listed, else add it.
    const keep = upcoming.find((d) => d.occurrence_date === draft.startDate);
    cmds.push(stopRepeatingCommand(keep ? [keep.id] : []));
    if (!keep && draft.startDate >= today) cmds.push(addDateCommand(draft.startDate));
  } else if (changed.has('startDate') && draft.startDate >= today) {
    // One date moved: add the new date, then take the old one off.
    const old = upcoming.find((d) => d.occurrence_date === base.startDate);
    if (!upcoming.some((d) => d.occurrence_date === draft.startDate)) cmds.push(addDateCommand(draft.startDate));
    if (old) cmds.push(removeDateCommand(old.id));
  }
  return cmds;
}

/**
 * Weekly -> One date: how many listed upcoming dates go when it is saved (every one
 * but the date it is kept on). The Repeats sheet's confirm names this number, and the
 * Date card says it while the choice is unsaved.
 */
export function oneDateLoss(ws: EventWorkspace, draft: EventDraft, today: string): number {
  return upcomingDates(ws.dates, today).filter((d) => d.lifecycle_status !== 'cancelled' && d.occurrence_date !== draft.startDate).length;
}

// ---- display -------------------------------------------------------------------

export function repeatsLabel(draft: EventDraft): string {
  if (draft.shape === 'single' || !draft.startDate) return SHAPE_LABEL.single;
  return `Every ${weekdayName(draft.startDate)}`;
}

/** 'Listed until Fri 9 Apr' -- the rule's end, else the last upcoming date. */
export function listedUntil(draft: EventDraft, ws: EventWorkspace, today: string): string | null {
  if (draft.shape === 'weekly' && draft.until) return draft.until;
  const upcoming = upcomingDates(ws.dates, today);
  return upcoming.length ? upcoming[upcoming.length - 1].occurrence_date : null;
}

export const shortDate = (date: string, today: string) => dateLabel(date, today);

export interface CardPreview {
  title: string;
  coverUrl: string | null;
  when: string | null;
  where: string | null;
}

export function cardPreview(draft: EventDraft, ws: EventWorkspace, today: string, venueName: string | null): CardPreview {
  const next = upcomingDates(ws.dates, today).find((d) => d.lifecycle_status !== 'cancelled');
  return {
    title: draft.name.trim() || 'Your event',
    coverUrl: draft.coverUrl.trim() || null,
    when: next ? dateLabel(next.occurrence_date, today) : draft.startDate >= today ? dateLabel(draft.startDate, today) : null,
    where: venueName,
  };
}
