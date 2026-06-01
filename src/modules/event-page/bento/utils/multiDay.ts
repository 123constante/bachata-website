import type { EventPageSnapshotOccurrence } from '@/modules/event-page/types';

// Threshold for classifying a single occurrence as multi-day. 20h (not 24h)
// catches e.g. Fri 20:00 -> Sat 03:00 cross-night events as single-day while
// still flipping a multi-night weekender.
const MULTI_DAY_THRESHOLD_MS = 20 * 3600 * 1000;

export const isMultiDay = (occurrence: EventPageSnapshotOccurrence | null): boolean => {
  if (!occurrence || !occurrence.startsAt || !occurrence.endsAt) return false;
  const start = Date.parse(occurrence.startsAt);
  const end = Date.parse(occurrence.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  // Both stamps share the same (+00) offset, so the difference is correct
  // regardless of the local-as-UTC convention.
  return end - start > MULTI_DAY_THRESHOLD_MS;
};

// Read the weekday/day/month straight off the stored naive date. These stamps
// are "local-as-UTC" (a wall clock tagged +00, not a real instant), so we must
// NOT apply a timezone conversion -- doing so shifts the BST hour and can roll
// late-night events onto the wrong day. See occurrenceFormat.ts for the full
// convention note. We anchor the naive date at UTC noon and format in UTC so
// the result is machine-timezone-independent.
const formatDayPart = (isoLike: string): { weekday: string; day: string; month: string } => {
  const ymd = isoLike.slice(0, 10);
  const date = new Date(`${ymd}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return { weekday: '', day: '', month: '' };
  }
  const fmt = (opt: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opt }).format(date);
  return {
    weekday: fmt({ weekday: 'long' }).toUpperCase(),
    day: fmt({ day: 'numeric' }),
    month: fmt({ month: 'long' }).toUpperCase(),
  };
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
  const start = formatDayPart(startSource);

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

  const end = formatDayPart(occurrence.endsAt);
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
