import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Share2 } from 'lucide-react';
import type { PersonRole } from '../personRoles';
import { TAP } from '../roleSwitch';
import { FOCUS_RING } from '../wall/tokens';
import { FRAME } from '../worlds/tokens';
import { RoleTabs } from './RoleTabs';
import { sharePage } from './share';

/**
 * The shared frame on top of every people world, right under the site header: Back (left)
 * and Share (right) in one bar, then the role tabs above the photo. Identical on every world,
 * so the tabs sit at the same y; each world owns everything below it (children).
 */
export function PersonFrame({ backHref, backLabel = 'Back', shareTitle, roles, current, slug, children }: {
  backHref: string;
  backLabel?: string;
  /** The share sheet title, e.g. "Morcilla on Bachata Calendar". */
  shareTitle: string;
  roles: readonly PersonRole[];
  current: PersonRole;
  slug: string | null | undefined;
  children?: ReactNode;
}) {
  return (
    <div data-testid="person-frame" data-world={current} className="flex flex-col gap-[6px]">
      <div className="flex items-center justify-between gap-3">
        <Link
          to={backHref}
          data-testid="frame-back"
          className={`inline-flex min-w-0 items-center gap-2 px-1 font-bold ${FOCUS_RING}`}
          style={{ minHeight: TAP, fontSize: 15, color: FRAME.tabInk }}
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">{backLabel}</span>
        </Link>
        <button
          type="button"
          data-testid="frame-share"
          onClick={() => void sharePage(shareTitle)}
          className={`inline-flex shrink-0 items-center gap-2 px-1 font-bold ${FOCUS_RING}`}
          style={{ minHeight: TAP, minWidth: TAP, fontSize: 15, color: FRAME.tabInk }}
        >
          <Share2 className="h-4 w-4" aria-hidden />
          Share
        </button>
      </div>
      <RoleTabs roles={roles} current={current} slug={slug} />
      {children}
    </div>
  );
}
