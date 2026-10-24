// People arc S1: the ONE place for every fact shown on more than one people world
// (teacher timetable, DJ sleeve, dancer card) and on the frame above them. Pure
// functions, no I/O, no React: the consistency matrix in
// src/modules/person-page/__tests__/facts.test.ts runs every function over every
// real prod shape (docs/people-arc/worlds/data.md). A world never formats one of
// these facts itself.
import { formatKeyDayLabel, isRealDateKey, londonDateKey, parseUtcIso } from '@/lib/londonDate';
import { languageNames } from '@/lib/languageNames';
import { normaliseNationalityCode } from '@/components/people/nationality';
import { ROLE_LABEL, type PersonRole } from '../personRoles';

/** A display name: trimmed, every run of whitespace (double spaces, tabs, NBSP) one space. null = no name. */
export const publicName = (raw: string | null | undefined): string | null => {
  if (typeof raw !== 'string') return null;
  const name = raw.replace(/\s+/g, ' ').trim();
  return name || null;
};

/** A stage name with every leading "DJ " cut (the DJ world already says DJ): "DJ  DJ Morcilla" -> "Morcilla". */
export const stageName = (raw: string | null | undefined): string | null => {
  const name = publicName(raw);
  if (!name) return null;
  return name.replace(/^(?:dj\s+)+/i, '').trim() || null;
};

export type WorldNames = {
  /** The h1. Never empty: the role label ("Dancer") stands in when no name resolves. */
  big: string;
  /** The line under it, or null. Only on the DJ world, only when the DJ name differs from the public name. */
  small: string | null;
};

/**
 * The one name rule. DJ world: the DJ name big and the public name small (Morcilla / Papacito);
 * no DJ name, or one equal to the public name -> the public name only (Ramiro Zapata). Every
 * other world: the public name. Never a duplicated "DJ " prefix on any world.
 */
export function worldNames(person: { name: string | null | undefined; djName?: string | null }, role: PersonRole): WorldNames {
  const plain = publicName(person.name);
  const name = role === 'dj' ? stageName(plain) ?? plain : plain;
  const dj = role === 'dj' ? stageName(person.djName) : null;
  if (dj && dj.toLowerCase() !== (name ?? '').toLowerCase()) return { big: dj, small: name };
  return { big: name ?? ROLE_LABEL[role], small: null };
}

/** Stored languages -> "Spanish, English" (full names, unknown codes dropped, each once). null = hide the line. */
export const languageLine = (raw: readonly unknown[] | null | undefined): string | null => {
  const names = languageNames(raw);
  return names.length ? names.join(', ') : null;
};

const KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The London calendar day of a date key ("2026-10-23") or a UTC timestamp from an RPC row
 * ("2026-10-23T21:00:00+00:00" -> "2026-10-23"; London is BST until 25 October). null when unreadable.
 */
export const londonDayOf = (raw: string | null | undefined): string | null => {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (KEY.test(value)) return isRealDateKey(value) ? value : null;
  const at = parseUtcIso(value);
  return at ? londonDateKey(at) : null;
};

/** "Friday 23 October": the one date label on every world. Reuses londonDate (no second copy). */
export const dateLabel = (raw: string | null | undefined): string | null => formatKeyDayLabel(londonDayOf(raw));

/** "3 gigs coming up": a count is shown only from 2 (owner rule); 0 and 1 -> null. */
export const countLabel = (n: number | null | undefined, noun: string): string | null =>
  typeof n === 'number' && Number.isFinite(n) && n >= 2 ? `${Math.floor(n)} ${noun}` : null;

const UK_POSTCODE = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi;
const OUTWARD_CODE = /\b[A-Z]{1,2}\d[A-Z\d]?\b$/i;

/**
 * City name only: a postcode (or its outward half) that leaked into the city field is cut off
 * ("London SE1 7PB" -> "London"). Same rule as dancer-app's cityOnly, which S2 switches here.
 */
export const cityLabel = (raw: string | null | undefined): string | null => {
  const value = publicName(raw);
  if (!value) return null;
  const name = value.replace(UK_POSTCODE, '').replace(OUTWARD_CODE, '').replace(/[,\s]+$/, '').trim();
  return name || null;
};

/**
 * Nationality -> the ISO 3166 alpha-2 code a flag is drawn from ("bo" -> "BO"), or null. The
 * code is NEVER printed as text (the teacher page used to show "London &middot; BO"); a world
 * passes it to NationalityFlag, which names the country for screen readers. The rule is
 * NationalityFlag's own (normaliseNationalityCode), so a world and the flag never disagree.
 */
export const flagCode = (raw: string | null | undefined): string | null => normaliseNationalityCode(raw);

/** First + last initial of the display name ("Sabrina Guzman Pastor" -> "SP"), "?" when there is no name. */
export const initials = (name: string | null | undefined): string => {
  const words = (publicName(name) ?? '').split(' ').filter((w) => /[\p{L}\p{N}]/u.test(w));
  const first = (w: string | undefined) => (w ? Array.from(w.replace(/^[^\p{L}\p{N}]+/u, ''))[0] ?? '' : '');
  const out = first(words[0]) + (words.length > 1 ? first(words[words.length - 1]) : '');
  return out.toUpperCase() || '?';
};

// People arc S3: gig times. Event times arrive from the RPCs as a London WALL CLOCK stamped +00
// ("2026-10-23 22:00:00+00" = 22:00 in London; see londonDate.ts londonWallClockToInstant), so
// these read the stored digits and never convert a zone. (londonDayOf above converts, which is
// right for a true instant but moves a 23:30 BST gig to the next day.)
const WALL = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The calendar day of a stored wall-clock stamp, as written ("2026-10-23 23:30:00+00" -> "2026-10-23"). null when unreadable. */
export const wallDayOf = (raw: string | null | undefined): string | null => {
  const m = typeof raw === 'string' ? WALL.exec(raw.trim()) : null;
  const key = m ? `${m[1]}-${m[2]}-${m[3]}` : null;
  return key && isRealDateKey(key) ? key : null;
};

/** "Friday 23 October" for a stored gig time (the day as written, through dateLabel's own format). */
export const gigDateLabel = (raw: string | null | undefined): string | null => dateLabel(wallDayOf(raw));

/** The day of the month ("23", no leading zero) for the big number on a gig row. null when unreadable. */
export const dayNumber = (raw: string | null | undefined): string | null => {
  const key = wallDayOf(raw);
  return key ? String(Number(key.slice(8))) : null;
};

/** "19:30": the stored clock, as written. Midnight on the dot means "no time given" -> null. */
export const timeLabel = (raw: string | null | undefined): string | null => {
  const m = typeof raw === 'string' && wallDayOf(raw) ? WALL.exec(raw.trim()) : null;
  if (!m || m[4] === undefined) return null;
  const [h, min] = [Number(m[4]), Number(m[5])];
  if (h > 23 || min > 59 || (h === 0 && min === 0)) return null;
  return `${m[4]}:${m[5]}`;
};

/**
 * Owner D12: the one button when nothing is coming up (a DJ with no dates). One copy, so no world
 * spells it out. S6: the dancer world no longer has one (no dated world = just the invite).
 */
export const FIND_A_PARTY = { label: 'Find a party', href: '/parties' } as const;

/**
 * Owner D8'' (2026-10-23): "Dance bachata too? Get your own card" is for signed-out visitors, on
 * every world; a signed-in visitor already has an account. An anonymous guest session counts as
 * signed out. Auth still resolving with no user yet also counts as signed out, so a signed-out
 * visitor (the shared-link reader) sees it from the first paint and it never arrives late.
 */
export const showsJoinInvite = (user: { is_anonymous?: boolean | null } | null | undefined): boolean =>
  !user || user.is_anonymous === true;

/** "October 2026": the "Played at" record label (month + year, the gig is in the past). */
export const monthLabel = (raw: string | null | undefined): string | null => {
  const key = wallDayOf(raw);
  return key ? `${MONTH_NAMES[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}` : null;
};
