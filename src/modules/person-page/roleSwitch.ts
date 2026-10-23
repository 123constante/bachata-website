// W2-C: the role page's Back row + role switcher (owner pick N-A, behind flags.personHub).
// Pure, so the table-driven tests cover every shape. Roles, labels and links all come from the
// ONE people mapping (badges.ts roleTagsFor -> ROLE_LABEL / hrefForRole), the same one the wall
// and the hub read: no second copy of either.
import { orderedRoles } from '@/lib/searchEntities';
import { personDestination, roleTagsFor, type PersonBadge } from './badges';
import { peoplePath, type PersonRole } from './personRoles';
import { SEAM, WALL } from './wall/tokens';

/** Explicit px (the phone html font-size is ~13.5px). Every control is at least TAP tall. */
export const TAP = 44;
/** The soft fade at the bar's top and bottom edges, where it meets the page under it. */
export const BAR_FADE = { top: 12, bottom: 24 } as const;

/**
 * The warm bar's ground: solid WALL.page in the middle, fading to clear at the top and bottom so it
 * melts into whatever page sits under it (the dancer page's teal) with no hard line (owner 2026-10-22).
 */
export const BAR_BACKGROUND =
  `linear-gradient(to bottom, ${SEAM.clear} 0px, ${WALL.page} ${BAR_FADE.top}px, ` +
  `${WALL.page} calc(100% - ${BAR_FADE.bottom}px), ${SEAM.clear} 100%)`;

export type RolePill = { role: PersonRole; label: string; href: string; current: boolean };
export type RoleSwitch = {
  back: { href: string; label: string };
  /** Empty when only one role has a page: one role = the back row only, no pills. */
  pills: RolePill[];
};

/** "Back to Marta Silva"; no usable name = "Back to profile" (never "null", never the id). */
export const backLabel = (name: string | null | undefined): string => {
  const n = name?.trim();
  return `Back to ${n || 'profile'}`;
};

/**
 * Null = no bar: no badge yet, no id, or no role with an open page (then /people/:id 404s).
 * A role whose page is closed (teacher while flags.teacherDetail is OFF) never gets a pill.
 * The page the visitor is on always counts as one of their roles.
 */
export function roleSwitchModel(input: {
  badge: PersonBadge | null | undefined;
  current: PersonRole;
  slugOrId: string | null | undefined;
  name: string | null | undefined;
  teacherPagesOpen: boolean;
}): RoleSwitch | null {
  const { badge, current, slugOrId, name, teacherPagesOpen } = input;
  if (!badge || !slugOrId) return null;
  // Back goes to /people/<slug>, which shows the hub only to a person the ONE rule sends there (two or more
  // held roles, one with an open page); anyone else is 302'd straight back to this page, or 404s. No hub = no
  // bar (the page keeps its own Back), so Back never loops onto the page the visitor is on.
  if (personDestination(badge, { teacherPagesOpen }, null).to !== 'hub') return null;
  const roles = orderedRoles([...badge.roles, current]);
  // Pill links use the slug the page was opened with, like Back (every role page resolves it on
  // dancer_profiles), so a switch lands on the canonical URL with no UUID rewrite.
  const pills = roleTagsFor({ ...badge, id: slugOrId, roles }, { teacherPagesOpen })
    .filter((t): t is typeof t & { href: string } => !!t.href)
    .map((t) => ({ role: t.role, label: t.label, href: t.href, current: t.role === current }));
  return {
    back: { href: peoplePath(slugOrId), label: backLabel(name) },
    pills: pills.length > 1 ? pills : [],
  };
}
