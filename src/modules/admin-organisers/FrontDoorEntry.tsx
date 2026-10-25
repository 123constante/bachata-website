import { badgeText } from './needsYouModel';
import { useNeedsYouCount } from './useNeedsYouCount';
import { BTN_PRIMARY } from './frontDoorUi';

/** The entry point on /admin/organisers: one link to the Add / Organisers / Needs you screens, with the Needs you count. */
export function FrontDoorEntry() {
  const badge = badgeText(useNeedsYouCount());
  return (
    <a href="/admin/organisers/front-door" className={`${BTN_PRIMARY} w-full`} data-testid="front-door-entry">
      Add organiser and Needs you
      {badge && <span className="ml-1 rounded-full bg-destructive px-1.5 py-0.5 text-xs text-destructive-foreground" data-testid="entry-badge">{badge}</span>}
    </a>
  );
}
