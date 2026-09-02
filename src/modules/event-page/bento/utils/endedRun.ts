// Series-termination arc P4 -- formatting the run of a series that has ended.
//
// Inputs are naive 'YYYY-MM-DD' London dates (event_series_p5.ended_on, and the
// earliest occurrence's local_date). They are NOT instants. Nothing here builds
// a Date or touches Intl: constructing a Date from 'YYYY-MM-DD' parses it as
// UTC midnight, and rendering that in Europe/London prints the PREVIOUS day for
// roughly half the year. Every value below is assembled from the string's own
// parts.
//
// Returns structural parts rather than one joined string on purpose: the dash
// between the two halves has to be an HTML entity at the JSX call site (this
// repo's Cowork mount corrupts raw Unicode punctuation), and a util returning
// "&ndash;" inside plain text would render the entity literally.

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// February is resolved by the leap rule in `parse`, so its entry is never read.
const MONTH_LENGTHS = [31, 0, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

type Parts = { y: string; m: number; d: number };

const parse = (iso: string | null | undefined): Parts | null => {
  if (!iso) return null;
  const match = ISO_DATE.exec(iso.slice(0, 10));
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  // Reject impossible components rather than printing "undefined" as a month.
  // A 13th month means the payload is not what this function documents, and a
  // wrong-but-plausible date on a tombstone is worse than no date at all.
  //
  // The day is checked against ITS OWN MONTH, not a flat 31: a bare range test
  // let '2026-02-31' through and rendered "31 February 2026" onto the tombstone
  // and into the og:description -- precisely the wrong-but-plausible output the
  // paragraph above rules out.
  //
  // Done with arithmetic rather than `new Date(Date.UTC(y, m, 0)).getUTCDate()`,
  // which would have been correct but would have made this file's opening rule
  // ("nothing here builds a Date") false. That rule is worth more than the three
  // lines it costs: it is checkable by grep, and the next person to add a helper
  // here reads it as absolute.
  if (m < 1 || m > 12 || d < 1) return null;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const lastOfMonth = m === 2 ? (leap ? 29 : 28) : MONTH_LENGTHS[m - 1];
  if (d > lastOfMonth) return null;
  return { y: match[1], m, d };
};

/** '2026-06-28' -> '28 June 2026'. Null for anything unparseable. */
export const formatLongDate = (iso: string | null | undefined): string | null => {
  const p = parse(iso);
  return p ? `${p.d} ${MONTHS[p.m - 1]} ${p.y}` : null;
};

/**
 * The noun the copy uses for the thing that has finished. Deliberately a tiny
 * closed set: "night" is the community's own word and the right default for a
 * party or a social, while a course and a festival would both read wrong as one.
 *
 * `format` is null for legacy-only events, hence the `type` fallback -- the same
 * COALESCE the rest of the event-page module uses.
 *
 * Lives here, beside the date formatting, because TWO surfaces need the same
 * word: the on-page record card and the og:description a share preview shows.
 * Two copies would drift, and the drift would only ever be visible in WhatsApp.
 */
export const runNoun = (format: string | null, type: string | null): string => {
  const shape = format ?? type;
  if (shape === 'course') return 'course';
  if (shape === 'festival') return 'festival';
  return 'night';
};

export type RunRange =
  /** Two halves to be joined with an en-dash entity at the call site. */
  | { kind: 'range'; from: string; to: string }
  /** Only the end is known, or both ends fall on the same day. */
  | { kind: 'single'; to: string };

/**
 * Build the run's date range. `to` is authoritative (ended_on); `from` is the
 * earliest occurrence and may legitimately be missing.
 *
 * Repeated units are shed from the left half, so a run inside one month reads
 * "7 - 28 June 2026" rather than "7 June 2026 - 28 June 2026".
 */
export const formatRunRange = (
  from: string | null | undefined,
  to: string | null | undefined,
): RunRange | null => {
  const end = parse(to);
  // No authoritative end means no range. The caller falls back to date-free
  // copy -- which is also the path taken before the migration exposing
  // ended_on is applied, so this is a live branch, not a defensive one.
  if (!end) return null;
  const toText = `${end.d} ${MONTHS[end.m - 1]} ${end.y}`;

  const start = parse(from);
  if (!start) return { kind: 'single', to: toText };
  // A one-night run, or a start recorded as the same day: no range to show.
  if (start.y === end.y && start.m === end.m && start.d === end.d) {
    return { kind: 'single', to: toText };
  }
  // A start AFTER the end means the two sources disagree. Trust ended_on, the
  // authoritative one, and show it alone rather than printing a backwards range.
  const startKey = `${start.y}${String(start.m).padStart(2, '0')}${String(start.d).padStart(2, '0')}`;
  const endKey = `${end.y}${String(end.m).padStart(2, '0')}${String(end.d).padStart(2, '0')}`;
  if (startKey > endKey) return { kind: 'single', to: toText };

  if (start.y !== end.y) {
    return { kind: 'range', from: `${start.d} ${MONTHS[start.m - 1]} ${start.y}`, to: toText };
  }
  if (start.m !== end.m) {
    return { kind: 'range', from: `${start.d} ${MONTHS[start.m - 1]}`, to: toText };
  }
  return { kind: 'range', from: String(start.d), to: toText };
};
