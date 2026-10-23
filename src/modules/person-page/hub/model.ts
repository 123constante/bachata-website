// Pure model for the person hub (/people/:id behind flags.personHub), W2-D option C: one hero card for
// the main role, an "Also" row for every other role the person HOLDS, a short About line. No second copy
// of the role vocabulary, its order, the names or the links: all of it comes from badges.ts
// (roleTagsFor / nameFor / hrefForRole / leadRole / personDestination) and the wall model.
import {
  hrefForRole,
  leadRole,
  nameFor,
  personDestination,
  roleTagsFor,
  type BadgeOpts,
  type PersonBadge,
  type RoleTag,
} from '@/modules/person-page/badges';
import { bareStage, firstPhoto, wallDateLabel } from '@/modules/person-page/wall/model';
import { mapDancerPublicProfile } from '@/modules/profile/dancerPublicProfile';
import { londonTodayKey } from '@/lib/londonDate';
import { ROLE_LABEL, type PersonRole } from '@/lib/searchEntities';
import type { PersonSnapshot } from '../reads';

/** The DJ read (get_public_dj_v1, cached by the loader under ['dj-profile', id]): only the fields the hub shows. */
export type HubDjRow = {
  dj_name?: string | null;
  photo_url?: string | string[] | null;
  nationality_code?: string | null;
  languages?: string[] | null;
} | null;

/** One row of get_profile_event_timeline_v2 (useProfileProgramAppearances). */
export type HubAppearance = { event_id: string | null; event_start_time: string | null };

/** The main role: its page is the one big link. */
/** lineRows: rows the line reserves, 2 while a DJ gig line may still grow by " \u00b7 N coming up" (it wraps at 360px). */
export type HeroModel = { role: PersonRole; href: string; line: string | null; lineRows: 1 | 2; cta: string; hint: string };
/** Another held role. href null = no page (a closed Teacher): shown, never a link. */
export type AlsoCardModel = { role: PersonRole; label: string; href: string | null; line: string };

export type HubModel = {
  /** The main role (colours the face, the hero edge and the button); null = no role with a page (empty state). */
  lead: PersonRole | null;
  heading: string;
  subName: string | null;
  photo: string | null;
  initialsFrom: string;
  flagCode: string | null;
  tags: RoleTag[];
  hero: HeroModel | null;
  also: AlsoCardModel[];
  /** City and facts, the About line; empty = no About. */
  about: string[];
};

/** The soonest gig from today on (London calendar day), or null. */
export function nextGigOf(appearances: readonly HubAppearance[] | undefined, today: string = londonTodayKey()): { eventId: string; dateLabel: string; count: number } | null {
  const up = (appearances ?? [])
    .filter((a): a is { event_id: string; event_start_time: string } => !!a.event_id && !!a.event_start_time && !!wallDateLabel(a.event_start_time, today))
    .sort((x, y) => x.event_start_time.localeCompare(y.event_start_time));
  const first = up[0];
  return first ? { eventId: first.event_id, dateLabel: wallDateLabel(first.event_start_time, today) as string, count: up.length } : null;
}

/** Role order: leadRole, then leadRole of what is left, and so on (the ONE order rule, badges.ts). */
export function cardOrder(badge: PersonBadge): PersonRole[] {
  const out: PersonRole[] = [];
  let rest = badge;
  for (let r = leadRole(rest); r; r = leadRole(rest)) {
    out.push(r);
    rest = { ...rest, roles: rest.roles.filter((x) => x !== r) };
  }
  return out;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
export const MIDDOT = ' \u00b7 ';

/** Facts that exist, nothing else. Level has no public read today, so it never shows. */
export function factsOf(yearsDancing: string | null, languages: readonly string[] | null | undefined): string[] {
  const years = Number(yearsDancing);
  return [
    yearsDancing && Number.isFinite(years) && years > 0 ? `${plural(years, 'year')} dancing` : null,
    languages && languages.length ? languages.join(', ') : null,
  ].filter((x): x is string => !!x);
}

/** The page word in "Open DJ page" / "their dancer page". */
const PAGE_WORD: Record<PersonRole, string> = { dj: 'DJ', dancer: 'dancer', teacher: 'teacher' };
const WHAT: Record<PersonRole, string> = {
  dj: 'gigs and DJ details',
  dancer: 'style, level and how to say hi',
  teacher: 'classes and teacher details',
};

/**
 * /people/:id: where a person who should NOT see the hub goes instead (a replace redirect), or null =
 * show the hub. personDestination on the HELD roles, so the tile, this redirect and the hub agree.
 */
export function personPageRedirect(person: PersonSnapshot, opts: BadgeOpts, slugOrId: string = person.id): string | null {
  const badge: PersonBadge = { id: slugOrId, roles: person.heldRoles ?? person.roles, djName: null, djHasUpcoming: false, nextGigDate: null };
  const d = personDestination(badge, opts, hrefForRole('dancer', slugOrId, opts));
  return d.to === 'hub' ? null : d.href;
}

export function hubModel(input: {
  person: PersonSnapshot;
  dancerRow: unknown;
  dj: HubDjRow;
  /** undefined = the gig list has not arrived yet. */
  appearances: readonly HubAppearance[] | undefined;
  opts: BadgeOpts;
  today?: string;
  /**
   * This person's badges row (the wall's, or the one the loader fetched): no read of its own. It fixes
   * which role leads on first paint, so the hero never swaps when the gig list arrives late, and it gives
   * the gig date until the list is in.
   */
  wallBadge?: PersonBadge | null;
}): HubModel {
  const { person, dj, opts } = input;
  const view = input.dancerRow ? mapDancerPublicProfile(input.dancerRow as never) : null;
  const isDj = person.roles.includes('dj');
  const hint = input.wallBadge;
  const timelineGig = nextGigOf(input.appearances, input.today);
  const hintLabel = hint?.djHasUpcoming ? wallDateLabel(hint.nextGigDate, input.today) : null;
  const gigPending = isDj && input.appearances === undefined;
  const gig = !isDj ? null : timelineGig ?? (gigPending && hintLabel ? { dateLabel: hintLabel, count: 0 } : null);
  // Lead decided by the badge when there is one (stable from first paint), else by what is known now.
  const djHasUpcoming = hint ? !!hintLabel : !!gig;
  const djName = dj?.dj_name?.trim() || null;
  const visible: PersonBadge = { id: person.id, roles: person.roles, djName, djHasUpcoming, nextGigDate: null };
  const held: PersonBadge = { ...visible, roles: person.heldRoles ?? person.roles };
  const lead = cardOrder(visible).find((r) => hrefForRole(r, person.id, opts)) ?? null;

  const facts = factsOf(view?.yearsDancing ?? null, dj?.languages);
  // The ONE dancer facts line: the hero shows it bare (nothing when empty), an Also card falls back to naming its page.
  const dancerLine = facts.join(MIDDOT);
  const lineOf = (role: PersonRole, href: string | null): string => {
    if (!href) return `${ROLE_LABEL[role]} pages open soon`;
    if (role === 'dj') {
      // The count only from 2 (owner, 2026-10-23): one gig is just its date.
      if (gig) return `Next gig ${gig.dateLabel}${gig.count > 1 ? `${MIDDOT}${gig.count} coming up` : ''}`;
      return gigPending ? 'Checking for gigs\u2026' : 'No gigs listed right now';
    }
    if (role === 'dancer') return dancerLine || 'Their dancer page';
    return 'Their teacher page';
  };

  const realName = person.name ?? 'Bachata Calendar profile';
  const heading = nameFor(lead === 'dj' ? 'dj' : 'other', { name: realName, djName });
  const subName = !djName ? null : lead === 'dj' ? (person.name && person.name !== heading ? person.name : null) : `DJ ${bareStage(djName)}`;
  const djPhoto = firstPhoto(dj?.photo_url) ?? person.djPhoto;
  const photo = lead === 'dj' ? djPhoto ?? person.avatarUrl : person.avatarUrl ?? djPhoto;
  const heroHref = lead ? hrefForRole(lead, person.id, opts) : null;
  return {
    lead,
    heading,
    subName,
    photo,
    // No real name and no stage name: "?" rather than the placeholder's initials.
    initialsFrom: !person.name && !djName ? '' : lead === 'dj' ? bareStage(heading) : heading,
    flagCode: view?.nationalityCode ?? dj?.nationality_code ?? null,
    // Chips from the HELD roles, like the wall tile (a closed Teacher is plain text).
    tags: roleTagsFor(held, opts),
    hero: lead && heroHref
      ? {
          role: lead,
          href: heroHref,
          // The DJ line always shows (its row is reserved for the late gig list); a dancer line only when there
          // are facts; a teacher hero has none of its own. Never a filler that repeats the button under it.
          line: lead === 'dj' ? lineOf(lead, heroHref) : lead === 'dancer' ? dancerLine || null : null,
          lineRows: lead === 'dj' && (hintLabel || gig) ? 2 : 1,
          cta: `Open ${PAGE_WORD[lead]} page`,
          hint: `Opens their ${PAGE_WORD[lead]} page: ${WHAT[lead]}.`,
        }
      : null,
    also: !lead ? [] : cardOrder(held)
      .filter((r) => r !== lead)
      .map((role) => {
        const href = hrefForRole(role, person.id, opts);
        return { role, label: ROLE_LABEL[role], href, line: lineOf(role, href) };
      }),
    about: [person.city, ...facts].filter((x): x is string => !!x),
  };
}
