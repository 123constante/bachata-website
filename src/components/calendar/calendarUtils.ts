import { resolveEventImage } from '@/lib/utils';
import type { CalendarEvent } from '@/hooks/useCalendarEvents';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Category = 'all' | 'parties' | 'classes';
export type ViewType = 'calendar' | 'list';

export interface CalendarEventItem {
  id: string;
  date: number;
  month: number;
  year: number;
  startDate: Date;
  endDate: Date;
  instanceDateIso: string;
  type: 'parties' | 'classes' | 'both';
  hasParty: boolean;
  hasClass: boolean;
  title: string;
  startTime: string;
  endTime: string;
  partyStart?: string;
  partyEnd?: string;
  classStart?: string;
  classEnd?: string;
  venueName: string;
  eventLink: string;
  coverImageUrl: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export { DAYS, MONTHS };

const fmtTime = (t: string | null | undefined): string | undefined => {
  if (!t) return undefined;
  // If the value looks like a full datetime (contains 'T' or starts with a date),
  // extract the time portion first.
  const sep = t.indexOf('T') !== -1 ? t.indexOf('T') : t.indexOf(' ');
  const timePart = sep !== -1 && sep > 4 ? t.substring(sep + 1) : t;
  return timePart.substring(0, 5);
};

const parseJson = (value: unknown): Record<string, unknown> => {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
};

// ---------------------------------------------------------------------------
// Transform RPC rows → CalendarEventItem[]
// ---------------------------------------------------------------------------

interface KeyTimesSlot { active?: boolean; start?: string; end?: string }
interface KeyTimesData {
  party?: KeyTimesSlot;
  classes?: KeyTimesSlot;
}

const asKeyTimes = (obj: Record<string, unknown>): KeyTimesData => obj as unknown as KeyTimesData;

export const transformCalendarEvents = (raw: CalendarEvent[]): CalendarEventItem[] =>
  raw.map((event) => {
    const instanceDate = new Date(event.instance_date);

    const normalizedStart = new Date(instanceDate);
    normalizedStart.setHours(0, 0, 0, 0);

    const normalizedEnd = new Date(instanceDate);
    normalizedEnd.setHours(23, 59, 59, 999);

    // Parse key_times (root-level then meta_data fallback)
    const meta = parseJson(event.meta_data);
    let keyTimesRaw = parseJson(event.key_times);
    if (Object.keys(keyTimesRaw).length === 0) {
      keyTimesRaw = parseJson(meta.key_times);
    }
    const keyTimes = asKeyTimes(keyTimesRaw);

    // Program-based flags (festival meta)
    let programHasParty = false;
    let programHasClass = false;
    const program = meta.program;
    if (Array.isArray(program)) {
      for (const item of program as Array<Record<string, unknown>>) {
        if (item?.type === 'party') programHasParty = true;
        if (item?.type === 'class' || item?.type === 'workshop') programHasClass = true;
        if (Array.isArray(item?.music_styles) && (item.music_styles as string[]).includes('party'))
          programHasParty = true;
      }
    }

    const hasParty =
      event.has_party ?? (program ? programHasParty : !!keyTimes.party?.active);
    const hasClass =
      event.has_class ?? (program ? programHasClass : !!keyTimes.classes?.active);

    const partyStart = fmtTime(event.party_start) ?? fmtTime(keyTimes.party?.start);
    const partyEnd = fmtTime(event.party_end) ?? fmtTime(keyTimes.party?.end);
    const classStart = fmtTime(event.class_start) ?? fmtTime(keyTimes.classes?.start);
    const classEnd = fmtTime(event.class_end) ?? fmtTime(keyTimes.classes?.end);

    const globalStart = fmtTime(event.start_time);
    const globalEnd = fmtTime(event.end_time);

    let type: CalendarEventItem['type'];
    if (hasParty && hasClass) type = 'both';
    else if (hasParty) type = 'parties';
    else type = 'classes';

    return {
      id: event.event_id,
      date: instanceDate.getDate(),
      month: instanceDate.getMonth(),
      year: instanceDate.getFullYear(),
      startDate: normalizedStart,
      endDate: normalizedEnd,
      instanceDateIso: event.instance_date,
      type,
      hasParty,
      hasClass,
      title: event.name,
      startTime: partyStart ?? classStart ?? globalStart ?? 'TBA',
      endTime: partyEnd ?? classEnd ?? globalEnd ?? 'TBA',
      partyStart,
      partyEnd,
      classStart,
      classEnd,
      venueName: event.location || (meta.venues as any)?.[0]?.name || 'Venue TBA',
      eventLink: `/event/${event.event_id}`,
      coverImageUrl: resolveEventImage(event.photo_url, null),
    };
  });

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

const isSameDay = (isoStr: string, date: Date): boolean =>
  isoStr.split('T')[0] === date.toISOString().split('T')[0];

export const isEventVisibleOnDay = (event: CalendarEventItem, day: Date, category: Category): boolean => {
  const visible = event.instanceDateIso
    ? isSameDay(event.instanceDateIso, day)
    : day >= event.startDate && day <= event.endDate;

  if (!visible) return false;
  if (category === 'all') return true;
  if (category === 'parties') return event.hasParty;
  if (category === 'classes') return event.hasClass;
  return true;
};

export const matchesCategory = (event: CalendarEventItem, category: Category): boolean => {
  if (category === 'all') return true;
  if (category === 'parties') return event.hasParty;
  if (category === 'classes') return event.hasClass;
  return true;
};

/** Monday-adjusted day index (0 = Mon, 6 = Sun) */
export const mondayIndex = (jsDay: number): number => (jsDay === 0 ? 6 : jsDay - 1);
