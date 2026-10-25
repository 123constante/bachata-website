import { badgeText } from './needsYouModel';
import { useNeedsYouCount } from './useNeedsYouCount';
import { BADGE, BTN_PRIMARY } from './frontDoorUi';

/** The entry point on /admin/organisers: one link to the Add / Organisers / Needs you screens, with the Needs you count. */
export function FrontDoorEntry() {
  const badge = badgeText(useNeedsYouCount());
  return (
    <a href="/admin/organisers/front-door" className={`${BTN_PRIMARY} w-full`} data-testid="front-door-entry">
      Add and manage organisers
      {badge && <span className={BADGE} data-testid="entry-badge">{badge}</span>}
    </a>
  );
}
