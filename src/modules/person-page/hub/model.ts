// Pure model for the person hub (/people/:id behind flags.personHub). No second copy of the
// role vocabulary, its order, the names or the links: all of it comes from badges.ts
// (roleTagsFor / nameFor / hrefForRole / linkRoleFor / leadRole) and the wall model.
import {
  hrefForRole,
  leadRole,
  linkRoleFor,
  nameFor,
  roleTagsFor,
  type BadgeOpts,
  type PersonBadge,
  type RoleTag,
} from '@/modules/person-page/badges';
import { bareStage, firstPhoto, wallDateLabel } from '@/modules/person-page/wall/model';
import { mapDancerPublicProfile } from '@/modules/profile/dancerPublicProfile';
import { londonTodayKey } from '@/lib/londonDate';
import type { PersonRole } from '@/lib/searchEntities';
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

/** eventId null = the wall said there is a gig on dateLabel, the timeline has not arrived yet (no link yet). */
export type NextGig = { eventId: string | null; dateLabel: string };

export type RoleCardModel = { role: PersonRole; label: string; href: string; line: string };

export type HubModel = {
  /** The role whose accent colours the face and decides the name (linkRoleFor, like the wall tile). */
  lead: PersonRole;
  heading: string;
  subName: string | null;
  photo: string | null;
  initialsFrom: string;
  flagCode: string | null;
  city: string | null;
  tags: RoleTag[];
  facts: string[];
  nextGig: NextGig | null;
  cards: RoleCardModel[];
  cardsHeading: string;
};

/** The soonest gig from today on (London calendar day), or null. */
export function nextGigOf(appearances: readonly HubAppearance[] | undefined, today: string = londonTodayKey()): (NextGig & { count: number }) | null {
  const up = (appearances ?? [])
    .filter((a): a is { event_id: string; event_start_time: string } => !!a.event_id && !!a.event_start_time && !!wallDateLabel(a.event_start_time, today))
    .sort((x, y) => x.event_start_time.localeCompare(y.event_start_time));
  const first = up[0];
  return first ? { eventId: first.event_id, dateLabel: wallDateLabel(first.event_start_time, today) as string, count: up.length } : null;
}

/** Card order: leadRole, then leadRole of what is left, and so on (the ONE order rule, badges.ts). */
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

/** Facts that exist, nothing else. Level has no public read today, so it never shows. */
export function factsOf(yearsDancing: string | null, languages: readonly string[] | null | undefined): string[] {
  const years = Number(yearsDancing);
  return [
    yearsDancing && Number.isFinite(years) && years > 0 ? `${plural(years, 'year')} dancing` : null,
    languages && languages.length ? languages.join(', ') : null,
  ].filter((x): x is string => !!x);
}

function cardLine(role: PersonRole, gig: { count: number } | null, facts: { years: string | null }): string {
  if (role === 'dj') return !gig ? 'Their DJ page' : gig.count > 0 ? `${plural(gig.count, 'gig')} coming up` : 'Gigs coming up';
  if (role === 'dancer') return facts.years && Number(facts.years) > 0 ? `${plural(Number(facts.years), 'year')} dancing` : 'Their dancer page';
  return 'Their teacher page';
}

export function hubModel(input: {
  person: PersonSnapshot;
  dancerRow: unknown;
  dj: HubDjRow;
  appearances: readonly HubAppearance[] | undefined;
  opts: BadgeOpts;
  today?: string;
  /**
   * This person's row from the wall's badges read when the visitor came from the wall (already in the
   * query cache, no read of its own). Used ONLY while the timeline is still loading, so the cards are in
   * their final order and the next-event button keeps its place on first paint (critique #1).
   */
  wallBadge?: PersonBadge | null;
}): HubModel {
  const { person, dj, opts } = input;
  const view = input.dancerRow ? mapDancerPublicProfile(input.dancerRow as never) : null;
  const isDj = person.roles.includes('dj');
  const hintLabel = input.appearances === undefined && input.wallBadge?.djHasUpcoming
    ? wallDateLabel(input.wallBadge.nextGigDate, input.today)
    : null;
  const gig = !isDj ? null : nextGigOf(input.appearances, input.today) ?? (hintLabel ? { eventId: null, dateLabel: hintLabel, count: 0 } : null);
  const djName = dj?.dj_name?.trim() || null;
  const badge: PersonBadge = {
    id: person.id,
    roles: person.roles,
    djName,
    djHasUpcoming: !!gig,
    nextGigDate: null,
  };
  const lead = linkRoleFor(badge, opts) ?? person.roles[0];
  const realName = person.name ?? 'Bachata Calendar profile';
  const heading = nameFor(lead === 'dj' ? 'dj' : 'other', { name: realName, djName });
  const subName = !djName ? null : lead === 'dj' ? (person.name && person.name !== heading ? person.name : null) : `DJ ${bareStage(djName)}`;
  const djPhoto = firstPhoto(dj?.photo_url) ?? person.djPhoto;
  const photo = lead === 'dj' ? djPhoto ?? person.avatarUrl : person.avatarUrl ?? djPhoto;
  const cards = cardOrder(badge)
    .map((role) => ({ role, href: hrefForRole(role, person.id, opts) }))
    .filter((c): c is { role: PersonRole; href: string } => !!c.href)
    .map(({ role, href }) => ({
      role,
      href,
      label: roleTagsFor(badge, opts).find((t) => t.role === role)?.label ?? role,
      line: cardLine(role, gig, { years: view?.yearsDancing ?? null }),
    }));
  return {
    lead,
    heading,
    subName,
    photo,
    // No real name and no stage name: "?" rather than the placeholder's initials.
    initialsFrom: !person.name && !djName ? '' : lead === 'dj' ? bareStage(heading) : heading,
    flagCode: view?.nationalityCode ?? dj?.nationality_code ?? null,
    city: person.city,
    // Chips from the HELD roles, like the wall tile (a closed Teacher is plain text, href null);
    // the cards above stay on the visible roles, so no closed page is ever offered.
    tags: roleTagsFor({ ...badge, roles: person.heldRoles ?? person.roles }, opts),
    facts: factsOf(view?.yearsDancing ?? null, dj?.languages),
    nextGig: gig ? { eventId: gig.eventId, dateLabel: gig.dateLabel } : null,
    cards,
    // No real name: never split the placeholder ("What Bachata does", critique #2).
    cardsHeading: cards.length < 2 ? 'Their page' : person.name ? `What ${person.name.split(/\s+/)[0]} does` : 'What they do',
  };
}
