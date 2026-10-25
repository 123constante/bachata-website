// The W2-C role bar on the public dancer page (flags.personHub ON), blended into the teal ground.
// Owner 2026-10-22: the bar must melt into the page at the sides AND the bottom (no visible box),
// and the page shows ONE Back: the bar's "Back to <name>" replaces the page's own Back.
//
// The bar itself (labels, links, pills) is the person-page RoleSwitchView, built from the ONE
// mapping (roleSwitchModel). Only its ground is drawn here, so the dancer page owns its own seam.
import { useEmbeddedProfile } from '@/lib/embeddedProfile';
import { flags } from '@/lib/featureFlags';
import { usePeopleBadges } from '@/modules/person-page/badges';
import { roleSwitchModel, type RoleSwitch } from '@/modules/person-page/roleSwitch';
import { usePersonSnapshot } from '@/modules/person-page/usePersonRoles';
import { SEAM, WALL } from '@/modules/person-page/wall/tokens';

/** Where the warm ground fades into the teal: in at the top, out at the bottom and at both sides. */
export const DANCER_BAR_FADE = { top: 12, bottom: 32, side: 24 } as const;

/** Top to bottom: clear -> warm -> clear. */
export const DANCER_BAR_FILL =
  `linear-gradient(to bottom, ${SEAM.clear} 0px, ${WALL.page} ${DANCER_BAR_FADE.top}px, ` +
  `${WALL.page} calc(100% - ${DANCER_BAR_FADE.bottom}px), ${SEAM.clear} 100%)`;

/** Left to right, as a mask on the ground's own layer (never on the text, which must stay solid). */
export const DANCER_BAR_SIDES =
  `linear-gradient(to right, transparent 0px, black ${DANCER_BAR_FADE.side}px, ` +
  `black calc(100% - ${DANCER_BAR_FADE.side}px), transparent 100%)`;

/**
 * The bar's model for /dancers/:id, or null = no bar (the page keeps its own Back). Same reads and
 * the same rule as the person-page RoleSwitch: nothing with the flag OFF, in a /people/:id tab
 * (context or the page's `embedded` prop), when `skip` (a branch that never shows the bar), or until
 * both reads answer, and never a Back link into a hub that would 404.
 */
export function useDancerRoleBar(id: string | undefined, slug: string | null | undefined, skip = false): RoleSwitch | null {
  const embedded = useEmbeddedProfile();
  const off = !flags.personHub || embedded || skip || !id;
  const { badges } = usePeopleBadges(off ? [] : [id as string]);
  const person = usePersonSnapshot(off ? undefined : id);
  if (off || !person.answered || !person.snapshot?.roles.length) return null;
  return roleSwitchModel({
    badge: badges.get(id as string),
    current: 'dancer',
    slugOrId: slug ?? id,
    name: person.snapshot.name,
    teacherPagesOpen: flags.teacherDetail,
  });
}
