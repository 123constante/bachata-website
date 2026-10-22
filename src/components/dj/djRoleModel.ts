// W2-C DJ page, owner pick D-C "Vinyl kept, centred" (behind flags.personHub). Pure rules, so the
// table-driven tests cover every shape: the name size steps, the dates shown first, the empty state.
import { splitInstagramWebsite } from './djContacts';
import { instagramUrl, normalizeUrl, parseDateParts } from './djFormat';
import type { DjGig } from './DjTiles';

/**
 * A text field as the RPC really returns it, made safe to show: string -> trimmed (blank = null);
 * array of strings -> one per line (empty = null); anything else -> null. Never throws. Prod 2026-10-22:
 * get_public_dj_v1 `faq` is an ARRAY for 21 of 40 DJs (all `[]`), which crashed a `.trim()`.
 */
export function djText(v: unknown): string | null {
  if (typeof v === 'string') return v.trim() || null;
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean).join('\n') || null;
  return null;
}

/** A link or code field: the first non-blank string (an array of links is never joined into one href). */
export function djFirst(v: unknown): string | null {
  return (Array.isArray(v) ? v : [v]).map((x) => (typeof x === 'string' ? x.trim() : '')).find(Boolean) ?? null;
}

/** Every field the W2-C page reads from the get_public_dj_v1 row, through djText / djFirst: the ONE boundary. */
export function djRoleFields(row: Record<string, unknown>) {
  const { instagram, website } = splitInstagramWebsite(djFirst(row.instagram), djFirst(row.website));
  return {
    bio: djText(row.bio),
    faq: djText(row.faq),
    pricing: djText(row.pricing),
    cityName: djText(row.city_name),
    nationalityCode: djFirst(row.nationality_code),
    photoUrl: djFirst(row.photo_url),
    gallery: Array.isArray(row.gallery_urls) ? row.gallery_urls.map(djFirst).filter((u): u is string => !!u) : [],
    links: {
      soundcloud: djFirst(row.soundcloud),
      mixcloud: djFirst(row.mixcloud),
      instagram,
      website,
      facebook: djFirst(row.facebook),
    },
  };
}

/** Upcoming dates shown before "See N more dates". */
export const DATES_SHOWN = 3;
/** The vinyl on this page (today's classic hero is 188). */
export const TURNTABLE = 152;

/**
 * The name wraps (never clipped) and steps down by length: 36 / 30 / 26 px. Same steps as the
 * approved mock (docs/mockups/w2c/index.html nameSize).
 */
export const nameSize = (name: string): 36 | 30 | 26 => (name.length > 28 ? 26 : name.length > 16 ? 30 : 36);

/** "DJ \u00b7 LONDON"; no city = "DJ". */
export const kicker = (city: string | null | undefined): string => {
  const c = city?.trim();
  return c ? `DJ \u00b7 ${c.toUpperCase()}` : 'DJ';
};

export type GigRow = { eventId: string; name: string; day: string; mon: string; sub: string | null; next: boolean };

const CLOCK = /^\d{4}-\d{2}-\d{2}[T ](\d{2}):(\d{2})/;

/**
 * Day, month and clock time of a gig, read exactly as stored: times are naive ("local-as-UTC"),
 * so never Intl-convert (same rule as DjTiles parseDateParts, which this reuses, and DJProfile's
 * dateKey). Midnight on the dot is a date with no time.
 */
export function gigWhen(iso: string | null): { day: string; mon: string; time: string | null } | null {
  const s = djText(iso);
  const d = parseDateParts(s);
  if (!s || !d) return null;
  const t = CLOCK.exec(s);
  return { day: d.day, mon: d.mon, time: t && !(t[1] === '00' && t[2] === '00') ? `${t[1]}:${t[2]}` : null };
}

/** Soonest first (the caller sorts); the first row is the next date. */
export function gigRows(gigs: readonly DjGig[]): GigRow[] {
  return gigs.map((g, i) => {
    const w = gigWhen(g.startTime);
    const sub = [djText(g.location), w?.time ?? null].filter(Boolean).join(' \u00b7 ');
    return { eventId: g.eventId, name: djText(g.name) ?? 'Event', day: w?.day ?? '-', mon: w?.mon ?? '', sub: sub || null, next: i === 0 };
  });
}

/** The first DATES_SHOWN rows and how many more sit behind "See N more dates" (0 = no button). */
export function datesView(rows: readonly GigRow[], expanded: boolean): { rows: GigRow[]; more: number } {
  if (expanded || rows.length <= DATES_SHOWN) return { rows: [...rows], more: 0 };
  return { rows: rows.slice(0, DATES_SHOWN), more: rows.length - DATES_SHOWN };
}

export const seeMoreLabel = (n: number): string => `See ${n} more ${n === 1 ? 'date' : 'dates'}`;

/**
 * No dates: say what the visitor can do. The Instagram button shows ONLY when the DJ has an
 * Instagram link (owner decision 1); otherwise the copy points at the calendar, a link that exists.
 */
export function noDates(instagram: string | null): { line: string; hint: string; action: { label: string; href: string; external: boolean } } {
  return instagram
    ? { line: 'No dates booked right now.', hint: 'Follow on Instagram to hear about the next one.', action: { label: 'Open Instagram', href: instagram, external: true } }
    : { line: 'No dates booked right now.', hint: 'Check back soon, or find a party on the calendar tonight.', action: { label: 'See the calendar', href: '/', external: false } };
}

export type ListenLink = { key: 'soundcloud' | 'mixcloud' | 'instagram' | 'website' | 'facebook'; label: string; href: string };

/** "Listen & book": one button per link the DJ has, in this order (URLs as DjContactPanel builds them). Empty = no section. */
export function listenLinks(p: { soundcloud: string | null; mixcloud: string | null; instagram: string | null; website: string | null; facebook: string | null }): ListenLink[] {
  const all: [ListenLink['key'], string, string | null][] = [
    ['soundcloud', 'SoundCloud', normalizeUrl(p.soundcloud)],
    ['mixcloud', 'Mixcloud', normalizeUrl(p.mixcloud)],
    ['instagram', 'Instagram', instagramUrl(p.instagram)],
    ['website', 'Website', normalizeUrl(p.website)],
    ['facebook', 'Facebook', normalizeUrl(p.facebook)],
  ];
  return all.filter((x): x is [ListenLink['key'], string, string] => !!x[2]).map(([key, label, href]) => ({ key, label, href }));
}
