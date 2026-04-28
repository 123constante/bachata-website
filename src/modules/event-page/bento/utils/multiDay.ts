import type { EventPageSnapshotOccurrence } from '@/modules/event-page/types';

// Threshold for classifying a single occurrence as multi-day. 20h (not 24h)
// catches e.g. Fri 20:00 → Sat 03:00 cross-night events as single-day while
// still flipping a Fri 20:00 → Sat 03:00+next-morning weekender.
const MULTI_DAY_THRESHOLD_MS = 20 * 3600 * 1000;

export const isMultiDay = (occurrence: EventPageSnapshotOccurrence | null): boolean => {
  if (!occurrence || !occurrence.startsAt || !occurrence.endsAt) return false;
  const start = Date.parse(occurrence.startsAt);
  const end = Date.parse(occurrence.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  return end - start > MULTI_DAY_THRESHOLD_MS;
};

const formatDayPart = (isoLike: string, timezone: string | null): { weekday: string; day: string; month: string } => {
  // Anchor naive local-date strings to midday to avoid TZ-boundary off-by-one.
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(isoLike) ? `${isoLike}T12:00:00` : isoLike;
  const date = new Date(normalized);
  const opts = (part: 'weekday' | 'day' | 'month'): Intl.DateTimeFormatOptions => {
    const base: Intl.DateTimeFormatOptions = { timeZone: timezone ?? undefined };
    if (part === 'weekday') return { ...base, weekday: 'long' };
    if (part === 'day') return { ...base, day: 'numeric' };
    return { ...base, month: 'long' };
  };
  try {
    return {
      weekday: new Intl.DateTimeFormat('en-GB', opts('weekday')).format(date).toUpperCase(),
      day: new Intl.DateTimeFormat('en-GB', opts('day')).format(date),
      month: new Intl.DateTimeFormat('en-GB', opts('month')).format(date).toUpperCase(),
    };
  } catch {
    return {
      weekday: date.toLocaleDateString('en-GB', { weekday: 'long' }).toUpperCase(),
      day: String(date.getDate()),
      month: date.toLocaleDateString('en-GB', { month: 'long' }).toUpperCase(),
    };
  }
};

export type DateLabelParts = {
  // Single-day: weekday + day + month (e.g. "FRI 12 JUN")
  // Multi-day: left = start part, right = end part
  isMultiDay: boolean;
  startWeekday: string;
  startDay: string;
  startMonth: string;
  endWeekday: string | null;
  endDay: string | null;
  endMonth: string | null;
};

export const buildDateLabel = (occurrence: EventPageSnapshotOccurrence | null): DateLabelParts | null => {
  if (!occurrence) return null;
  const startSource = occurrence.startsAt ?? occurrence.localDate;
  if (!startSource) return null;
  const tz = occurrence.timezone;
  const start = formatDayPart(startSource, tz);

  if (!isMultiDay(occurrence) || !occurrence.endsAt) {
    return {
      isMultiDay: false,
      startWeekday: start.weekday,
      startDay: start.day,
      startMonth: start.month,
      endWeekday: null,
      endDay: null,
      endMonth: null,
    };
  }

  const end = formatDayPart(occurrence.endsAt, tz);
  return {
    isMultiDay: true,
    startWeekday: start.weekday,
    startDay: start.day,
    startMonth: start.month,
    endWeekday: end.weekday,
    endDay: end.day,
    endMonth: end.month,
  };
};
