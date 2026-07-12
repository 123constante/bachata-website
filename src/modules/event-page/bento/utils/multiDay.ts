import type { EventPageSnapshotOccurrence } from '@/modules/event-page/types';
import { wallClockDateKey, wallClockDurationMinutes } from '@/lib/time/wallClock';

// Threshold for classifying a single occurrence as multi-day. 20h (not 24h)
// catches e.g. Fri 20:00 -> Sat 03:00 cross-night events as single-day while
// still flipping a multi-night weekender.
const MULTI_DAY_THRESHOLD_MIN = 20 * 60;

export const isMultiDay = (occurrence: EventPageSnapshotOccurrence | null): boolean => {
  if (!occurrence || !occurrence.startsAt || !occurrence.endsAt) return false;
  // Both stamps share the same (+00) offset, so the wall-clock difference is the
  // real span regardless of the local-as-UTC convention.
  const mins = wallClockDurationMinutes(occurrence.startsAt, occurrence.endsAt);
  if (mins === null) return false;
  return mins > MULTI_DAY_THRESHOLD_MIN;
};

// Read the weekday/day/month straight off the stored naive date. These stamps
// are "local-as-UTC" (WallClock), so we take the YYYY-MM-DD via the sanctioned
// wallClockDateKey, anchor it at UTC noon and format in UTC -- machine-timezone
// independent, with no BST hour shift that could roll a late event onto the
// wrong day.
const formatDayPart = (
  wc: NonNullable<EventPageSnapshotOccurrence['startsAt']>,
): { weekday: string; day: string; month: string } => {
  const ymd = wallClockDateKey(wc);
  if (!ymd) return { weekday: '', day: '', month: '' };
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
