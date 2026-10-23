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
