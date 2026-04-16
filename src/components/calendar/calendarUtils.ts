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
  goingCount?: number;
  venueLat?: number | null;
  venueLng?: number | null;
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

/** Extract HH:MM time from a program item — checks both start/end and start_time/end_time keys. */
const extractProgramTime = (item: Record<string, unknown>, key: 'start' | 'end'): string | undefined =>
  fmtTime(item[key] as string | null | undefined) ??
  fmtTime(item[`${key}_time`] as string | null | undefined);

/**
 * Given a list of program items all sharing the same type, return the combined
 * time range: [earliest start, latest end].  Returns undefined for each field
 * if none of the items carry usable times.
 */
const programClassRange = (
  items: Array<Record<string, unknown>>,
): { start: string | undefined; end: string | undefined } => {
  const starts: string[] = [];
  const ends: string[] = [];
  for (const item of items) {
    const s = extractProgramTime(item, 'start');
    const e = extractProgramTime(item, 'end');
    if (s) starts.push(s);
    if (e) ends.push(e);
  }
  // Sort lexicographically — HH:MM strings sort correctly as strings
  const earliest = starts.sort()[0];
  const latest = ends.sort().at(-1);
  return { start: earliest, end: latest };
};

export type VenueCoordMap = Map<string, { lat: number | null; lng: number | null }>;

export const transformCalendarEvents = (
  raw: CalendarEvent[],
  venueCoords?: VenueCoordMap,
): CalendarEventItem[] =>
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

    // Program-based flags and times (festival / multi-session meta)
    let programHasParty = false;
    let programHasClass = false;
    const program = meta.program;
    const classItems: Array<Record<string, unknown>> = [];
    const partyItems: Array<Record<string, unknown>> = [];

    if (Array.isArray(program)) {
      for (const item of program as Array<Record<string, unknown>>) {
        if (item?.type === 'party') { programHasParty = true; partyItems.push(item); }
        if (item?.type === 'class' || item?.type === 'workshop') { programHasClass = true; classItems.push(item); }
        if (Array.isArray(item?.music_styles) && (item.music_styles as string[]).includes('party')) {
          programHasParty = true;
          partyItems.push(item);
        }
      }
    }

    // Derive from program/key_times directly — the RPC has_class/has_party
    // are unreliable (live DB returns true for all events regardless of data).
    const hasParty = program ? programHasParty : !!keyTimes.party?.active;
    const hasClass = program ? programHasClass : !!keyTimes.classes?.active;

    // Class times: aggregate across ALL sources → earliest start, latest end
    const rpcClassStart = fmtTime(event.class_start);
    const rpcClassEnd   = fmtTime(event.class_end);
    const progClass     = classItems.length > 0 ? programClassRange(classItems) : { start: undefined, end: undefined };

    const allClassStarts = [rpcClassStart, progClass.start, fmtTime(keyTimes.classes?.start)].filter((v): v is string => !!v);
    const allClassEnds   = [rpcClassEnd,   progClass.end,   fmtTime(keyTimes.classes?.end)  ].filter((v): v is string => !!v);
    const classStart = allClassStarts.length ? allClassStarts.sort()[0]    : undefined;
    const classEnd   = allClassEnds.length   ? allClassEnds.sort().at(-1)  : undefined;

    // Party times: aggregate across ALL sources → earliest start, latest end
    const rpcPartyStart = fmtTime(event.party_start);
    const rpcPartyEnd   = fmtTime(event.party_end);
    const progParty     = partyItems.length > 0 ? programClassRange(partyItems) : { start: undefined, end: undefined };

    const allPartyStarts = [rpcPartyStart, progParty.start, fmtTime(keyTimes.party?.start)].filter((v): v is string => !!v);
    const allPartyEnds   = [rpcPartyEnd,   progParty.end,   fmtTime(keyTimes.party?.end)  ].filter((v): v is string => !!v);
    const partyStart = allPartyStarts.length ? allPartyStarts.sort()[0]   : undefined;
    const partyEnd   = allPartyEnds.length   ? allPartyEnds.sort().at(-1) : undefined;

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
      venueLat: venueCoords?.get(event.event_id)?.lat ?? null,
      venueLng: venueCoords?.get(event.event_id)?.lng ?? null,
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
