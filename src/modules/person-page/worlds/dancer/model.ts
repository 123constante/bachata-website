// People arc S2: the dancer world as plain data, so the matrix tests check every shape
// without rendering. Every fact goes through facts/ (the one shared mapping); this file
// only decides WHICH facts show and which lower half the page gets (owner D3/D6/D8).
import { isFestivalByFormat } from '@/lib/eventFormat';
import { optimizedImageUrl, srcWidthFor } from '@/lib/imageCdn';
import { eventHref } from '@/lib/seo/eventHref';
import { londonWallClockToInstant } from '@/lib/londonDate';
import { cityLabel, dateLabel, flagCode, gigDateLabel, languageLine, londonDayOf, timeLabel, wallDayOf, worldNames } from '../../facts';
import { djWorldView } from '../dj/model';
import { ROLE_LABEL, rolePagePath, type PersonRole } from '../../personRoles';

/** Owner D6: a dancer with no city gets London's socials, and the copy says "in London". */
export const DEFAULT_CITY = 'London';

/** The card photo's diameter (px); the photo is fetched at 2x this through the image CDN. */
export const FACE_PX = 112;

/** At most this many socials rows; the "All socials this week" button opens the rest. */
export const SOCIALS_MAX = 6;

/** Owner D8: the invite under every dancer world (the button goes to the site's sign-up entry). */
export const INVITE = { lead: 'Dance bachata too?', button: 'Get your own card' } as const;

/** Where "All socials this week" and every socials empty/error state send the person. */
export const ALL_SOCIALS_HREF = '/parties';

/**
 * Owner D12: the one button when there is nothing to show ("Find a party" -> /parties), read from the
 * DJ world so the wording has ONE source (no shared constant in facts/ yet: "needs frame", S2b handover).
 */
const NO_DATES = djWorldView({
  row: {},
  cityName: null,
  nationalityCode: null,
  links: { soundcloud: null, mixcloud: null, instagram: null, website: null, facebook: null },
  upcoming: [],
  past: [],
  pathname: '/',
}).emptyAction;
export const PARTY_ACTION = { label: NO_DATES?.label ?? '', href: NO_DATES?.href ?? ALL_SOCIALS_HREF } as const;

export type WorldContact = { kind: 'instagram' | 'facebook' | 'website' | 'email' | 'whatsapp'; href: string; label: string };

const CONTACT_KICKER: Record<WorldContact['kind'], string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  website: 'Website',
  email: 'Email',
  whatsapp: 'WhatsApp',
};

export type DancerWorldInput = {
  name: string | null | undefined;
  photo: string | null | undefined;
  nationality: string | null | undefined;
  city: string | null | undefined;
  /** dancer_profiles.dance_role as stored ("Leader", "Follower", "Lead and Follow"). */
  danceRole: string | null | undefined;
  /** dancer_profiles.languages as stored (codes or English names). */
  languages: readonly unknown[] | null | undefined;
  contacts: readonly WorldContact[];
};

export type DancerCard = {
  name: string;
  photo: string | null;
  /** Alpha-2 for NationalityFlag, never printed. */
  flag: string | null;
  /** "Leader &middot; London"; null = no line. */
  sub: string | null;
  /** "Spanish, English"; null = no Speaks block. */
  languages: string | null;
  contacts: { kicker: string; href: string; label: string; external: boolean }[];
};

const clean = (raw: string | null | undefined): string | null => (typeof raw === 'string' && raw.trim() ? raw.trim() : null);

export function dancerCard(input: DancerWorldInput): DancerCard {
  const sub = [clean(input.danceRole), cityLabel(input.city)].filter(Boolean).join(' \u00b7 ');
  return {
    name: worldNames({ name: input.name }, 'dancer').big,
    // Resized like today's portrait, never the original upload (it is the eager LCP image).
    photo: clean(input.photo) ? optimizedImageUrl(clean(input.photo) as string, srcWidthFor(FACE_PX * 2)) : null,
    flag: flagCode(input.nationality),
    sub: sub || null,
    languages: languageLine(input.languages),
    contacts: input.contacts.map((c) => ({ kicker: CONTACT_KICKER[c.kind], href: c.href, label: c.label, external: c.kind !== 'email' })),
  };
}

/** The roles the tabs list. The person is on their dancer page, so the dancer tab is always there. */
export const worldRoles = (roles: readonly PersonRole[]): PersonRole[] => (roles.includes('dancer') ? [...roles] : [...roles, 'dancer']);

export type Appearance = { event_name: string | null; event_location: string | null; event_start_time: string | null };

/**
 * The soonest appearance that has not started yet (a class at 19:00 is not "next" at 23:00), or null.
 * event_start_time is a London WALL CLOCK stamped +00 (S2b): "not started" is London's clock and the
 * day is the one written, so a 23:30 summer gig stays on its own day.
 */
export function nextAppearance<T extends Appearance>(rows: readonly T[] | null | undefined, now: Date = new Date()): T | null {
  const up = (rows ?? [])
    .map((r) => ({ r, at: londonWallClockToInstant(r.event_start_time) }))
    .filter((x): x is { r: T; at: Date } => x.at !== null && x.at.getTime() >= now.getTime() && wallDayOf(x.r.event_start_time) !== null)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  return up[0]?.r ?? null;
}

export type Preview = { role: 'teacher' | 'dj'; kicker: string; href: string; line: string; detail: string | null };

const NEXT_LINE: Record<'teacher' | 'dj', string> = { teacher: 'Next class', dj: 'Next gig' };

/** One preview of another world with an upcoming date (owner D6), linking to that world. */
export function previewOf(role: 'teacher' | 'dj', slug: string, next: Appearance | null): Preview | null {
  const day = next ? gigDateLabel(next.event_start_time) : null;
  if (!next || !day) return null;
  const detail = [clean(next.event_name), clean(next.event_location)].filter(Boolean).join(' \u00b7 ');
  return { role, kicker: ROLE_LABEL[role], href: rolePagePath(role, slug), line: `${NEXT_LINE[role]} ${day}`, detail: detail || null };
}

export type LowerHalf =
  | { kind: 'previews'; heading: string; items: Preview[] }
  | { kind: 'socials'; heading: string; city: string };

/**
 * Owner D6: another world with an upcoming date -> its preview; otherwise the socials in the
 * person's city this week, London (and the copy says so) when they have no city.
 */
export function lowerHalf(previews: readonly (Preview | null)[], city: string | null | undefined): LowerHalf {
  const items = previews.filter((p): p is Preview => p !== null);
  if (items.length) return { kind: 'previews', heading: 'Coming up', items };
  const where = cityLabel(city) ?? DEFAULT_CITY;
  return { kind: 'socials', heading: `Socials in ${where} this week`, city: where };
}

export type CalendarLike = {
  event_id: string;
  slug?: string | null;
  occurrence_id?: string | null;
  name: string | null;
  location?: string | null;
  /** Festival rows (one per festival day) are not socials: the calendar lists festivals apart. */
  type?: string | null;
  format?: string | null;
  has_party?: boolean | null;
  is_cancelled?: boolean | null;
  /** The occurrence's calendar day ("2026-10-23"). The day comes from here, never from a wall clock. */
  instance_date?: string | null;
  /** A WallClock (London local, not an instant): used only to order a day's rows. */
  occurrence_starts_at?: unknown;
};

/** `time` is the stored clock ("21:00") through facts.timeLabel; null when none is given. */
export type SocialRow = { key: string; href: string; time: string | null; name: string; venue: string | null };
export type SocialsDay = { day: string; label: string; rows: SocialRow[] };

/** This week's socials (parties, not festivals, not cancelled, from today on), soonest first, grouped by London day. */
export function socialsThisWeek(rows: readonly CalendarLike[], today: string, max = SOCIALS_MAX): { days: SocialsDay[]; total: number } {
  const picked = rows
    .filter((r) => r.has_party && !r.is_cancelled && !isFestivalByFormat({ format: r.format ?? null, type: r.type ?? null }) && clean(r.name))
    .map((r) => ({ r, day: londonDayOf(r.instance_date ?? null) }))
    .filter((x): x is { r: CalendarLike; day: string } => x.day !== null && x.day >= today)
    .sort((a, b) => a.day.localeCompare(b.day) || String(a.r.occurrence_starts_at ?? '').localeCompare(String(b.r.occurrence_starts_at ?? '')));
  const days: SocialsDay[] = [];
  for (const { r, day } of picked.slice(0, max)) {
    let group = days.find((d) => d.day === day);
    if (!group) {
      group = { day, label: dateLabel(day) as string, rows: [] };
      days.push(group);
    }
    const at = typeof r.occurrence_starts_at === 'string' ? r.occurrence_starts_at : null;
    group.rows.push({ key: `${r.event_id}:${r.occurrence_id ?? day}`, href: eventHref(r, r.occurrence_id), time: timeLabel(at), name: clean(r.name) as string, venue: clean(r.location) });
  }
  return { days, total: picked.length };
}

/** The socials states, each saying what the person can do. */
export const SOCIALS_COPY = {
  empty: (city: string) => `No socials listed in ${city} this week yet. See every party on the calendar.`,
  error: "This week's socials did not load. You can still see every party on the calendar.",
  all: 'All socials this week',
} as const;
