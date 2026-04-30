/**
 * computeVenueOpenStatus — pure helper for the venue page "Open now" pill.
 *
 * Reads venue.opening_hours + venue.timezone and returns a small status
 * object the at-a-glance strip can render. Uses Intl.DateTimeFormat to
 * resolve the venue's local day + time without pulling in a tz lib.
 *
 * Status states:
 *   - open          : currently open, > 60 min until close
 *   - closing-soon  : currently open, ≤ 60 min until close
 *   - opens-soon    : currently closed, next opening within 4 hours
 *   - closed        : all other closed states (with next-opening label if known)
 *   - unknown       : hours data missing / unparseable — caller hides the pill
 *
 * Overnight venues (close < open, e.g. 19:00–02:00) are supported.
 *
 * Day keys in opening_hours may be any case ("Monday", "monday", "MON" all
 * normalise to lowercase). Values can be an object {open, close, isOpen}
 * or a legacy free-text string (treated as unknown for status calc).
 *
 * Plan: plan_venue_page_redesign.md (Phase 2b). Decided 2026-04-30.
 */

export type DayHoursInput =
  | { open?: string | null; close?: string | null; isOpen?: boolean | null }
  | string
  | null
  | undefined;

export type OpeningHoursInput = Record<string, DayHoursInput> | null | undefined;

export type VenueOpenStatus =
  | { status: 'open'; label: string; closesAt: string }
  | { status: 'closing-soon'; label: string; closesAt: string }
  | { status: 'opens-soon'; label: string; opensAt: string }
  | { status: 'closed'; label: string; opensAt?: string; opensDayLabel?: string }
  | { status: 'unknown' };

const DAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

const SHORT_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const HHMM_RE = /^(\d{1,2}):(\d{2})$/;

const toMin = (hhmm: string | null | undefined): number | null => {
  if (!hhmm) return null;
  const m = HHMM_RE.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 47 || min < 0 || min > 59) return null;
  return h * 60 + min;
};

const normaliseHours = (
  raw: DayHoursInput,
): { open: number | null; close: number | null; isOpen: boolean | null } => {
  if (raw == null || typeof raw === 'string') {
    return { open: null, close: null, isOpen: null };
  }
  return {
    open: toMin(raw.open ?? null),
    close: toMin(raw.close ?? null),
    isOpen: raw.isOpen ?? null,
  };
};

const lookupDay = (
  hours: OpeningHoursInput,
  dayIndex: number,
): { open: number | null; close: number | null; isOpen: boolean | null } => {
  if (!hours) return { open: null, close: null, isOpen: null };
  const target = DAY_KEYS[((dayIndex % 7) + 7) % 7];
  for (const key of Object.keys(hours)) {
    if (key.toLowerCase() === target) {
      return normaliseHours(hours[key]);
    }
  }
  return { open: null, close: null, isOpen: null };
};

const TZ_PARTS_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();
const tzFormatter = (tz: string): Intl.DateTimeFormat => {
  let f = TZ_PARTS_FORMATTER_CACHE.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour12: false,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    TZ_PARTS_FORMATTER_CACHE.set(tz, f);
  }
  return f;
};

/**
 * Returns { dayIndex (0=Sun..6=Sat), minutes (since local midnight) }
 * for the given Date in the given IANA timezone. Falls back to Europe/London.
 */
export const localPartsInTz = (
  d: Date,
  tz: string | null | undefined,
): { dayIndex: number; minutes: number } => {
  const useTz = tz && tz.length > 0 ? tz : 'Europe/London';
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = tzFormatter(useTz).formatToParts(d);
  } catch {
    parts = tzFormatter('Europe/London').formatToParts(d);
  }
  let weekday = 'Mon';
  let hour = 0;
  let minute = 0;
  for (const p of parts) {
    if (p.type === 'weekday') weekday = p.value;
    else if (p.type === 'hour') hour = Number(p.value);
    else if (p.type === 'minute') minute = Number(p.value);
  }
  if (hour === 24) hour = 0; // Intl can emit "24" at midnight in some locales
  const dayIndex = SHORT_DAY.findIndex((d) => d === weekday);
  return { dayIndex: dayIndex >= 0 ? dayIndex : 1, minutes: hour * 60 + minute };
};

const formatHHMM = (totalMin: number): string => {
  const m = ((totalMin % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

/**
 * Find the next opening from a given (dayIndex, minutes) cursor.
 * Looks up to 7 days ahead. Returns null if no opening is found.
 */
const findNextOpening = (
  hours: OpeningHoursInput,
  fromDay: number,
  fromMins: number,
): { dayOffset: number; openMin: number; closeMin: number } | null => {
  for (let offset = 0; offset < 7; offset++) {
    const day = (fromDay + offset) % 7;
    const slot = lookupDay(hours, day);
    if (slot.isOpen === false) continue;
    if (slot.open == null || slot.close == null) continue;
    if (offset === 0 && slot.open <= fromMins) continue; // already past today's open
    return { dayOffset: offset, openMin: slot.open, closeMin: slot.close };
  }
  return null;
};

export const computeVenueOpenStatus = (
  hours: OpeningHoursInput,
  tz: string | null | undefined,
  now: Date = new Date(),
): VenueOpenStatus => {
  if (!hours || Object.keys(hours).length === 0) {
    return { status: 'unknown' };
  }

  const { dayIndex, minutes } = localPartsInTz(now, tz);

  // 1. Check if open right now (handle overnight close < open).
  // Today's slot first.
  const today = lookupDay(hours, dayIndex);
  if (today.isOpen !== false && today.open != null && today.close != null) {
    const isOvernight = today.close <= today.open;
    const inToday = isOvernight
      ? minutes >= today.open // anytime past open today (close is past midnight)
      : minutes >= today.open && minutes < today.close;
    if (inToday) {
      // For overnight, "minutes until close" wraps via +24h.
      const minutesUntilClose = isOvernight
        ? today.close + 24 * 60 - minutes
        : today.close - minutes;
      const closesAt = formatHHMM(today.close);
      if (minutesUntilClose <= 60) {
        return {
          status: 'closing-soon',
          label: `Closing soon · ${closesAt}`,
          closesAt,
        };
      }
      return {
        status: 'open',
        label: `Open now · until ${closesAt}`,
        closesAt,
      };
    }
  }

  // 2. Check if yesterday's overnight slot is still ongoing.
  const yest = lookupDay(hours, (dayIndex + 6) % 7);
  if (yest.isOpen !== false && yest.open != null && yest.close != null) {
    const overnight = yest.close <= yest.open;
    if (overnight && minutes < yest.close) {
      const closesAt = formatHHMM(yest.close);
      const minutesUntilClose = yest.close - minutes;
      if (minutesUntilClose <= 60) {
        return {
          status: 'closing-soon',
          label: `Closing soon · ${closesAt}`,
          closesAt,
        };
      }
      return {
        status: 'open',
        label: `Open now · until ${closesAt}`,
        closesAt,
      };
    }
  }

  // 3. Currently closed — find next opening.
  const next = findNextOpening(hours, dayIndex, minutes);
  if (!next) {
    return { status: 'closed', label: 'Closed' };
  }

  const opensAt = formatHHMM(next.openMin);
  const opensDayLabel = next.dayOffset === 0
    ? 'today'
    : next.dayOffset === 1
    ? 'tomorrow'
    : SHORT_DAY[(dayIndex + next.dayOffset) % 7];

  // "Opens soon" = within 4 hours of now.
  const minutesUntilOpen = next.dayOffset === 0
    ? next.openMin - minutes
    : next.openMin - minutes + next.dayOffset * 24 * 60;

  if (minutesUntilOpen <= 4 * 60) {
    return {
      status: 'opens-soon',
      label: `Opens at ${opensAt}`,
      opensAt,
    };
  }

  return {
    status: 'closed',
    label: opensDayLabel === 'today'
      ? `Closed · opens ${opensAt}`
      : `Closed · opens ${opensDayLabel}`,
    opensAt,
    opensDayLabel,
  };
};
