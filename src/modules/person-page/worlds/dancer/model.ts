// People arc S2: the dancer world as plain data, so the matrix tests check every shape
// without rendering. Every fact goes through facts/ (the one shared mapping); this file
// only decides WHICH facts show and which lower half the page gets (owner D3/D6/D8).
import { optimizedImageUrl, srcWidthFor } from '@/lib/imageCdn';
import { londonWallClockToInstant } from '@/lib/londonDate';
import { cityLabel, flagCode, gigDateLabel, languageLine, wallDayOf, worldNames, yearsDancingLine } from '../../facts';
import { ROLE_LABEL, rolePagePath, type PersonRole } from '../../personRoles';

/** The card photo's diameter (px); the photo is fetched at 2x this through the image CDN. */
export const FACE_PX = 112;

/** Owner D8: the invite under every dancer world (the button goes to the site's sign-up entry). */
export const INVITE = { lead: 'Dance bachata too?', button: 'Get your own card' } as const;

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
  /** dancerView.yearsDancing as the page has it ("4"; null = no start year). */
  yearsDancing: string | null | undefined;
  contacts: readonly WorldContact[];
};

export type DancerCard = {
  name: string;
  photo: string | null;
  /** Alpha-2 for NationalityFlag, never printed. */
  flag: string | null;
  /** "Leader &middot; London"; null = no line. */
  sub: string | null;
  /** Owner 2026-10-25: "4 years dancing", the only experience fact (no Level); null = no line. */
  years: string | null;
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
    years: yearsDancingLine(input.yearsDancing),
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

/** Owner D6 + S6: "Coming up" with the dancer's own dated worlds. There is no other lower half. */
export type LowerHalf = { heading: 'Coming up'; items: Preview[] };

/**
 * Owner D6: another world with an upcoming date -> its preview. S6 (owner, phone test 2026-10-24):
 * otherwise nothing (null) -- the "Socials in <city> this week" filler read as the dancer's own plans,
 * so the invite follows the card and contacts directly. Never a heading without an item under it.
 */
export function lowerHalf(previews: readonly (Preview | null)[]): LowerHalf | null {
  const items = previews.filter((p): p is Preview => p !== null);
  return items.length ? { heading: 'Coming up', items } : null;
}
