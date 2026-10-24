import type { ReactNode } from 'react';
import GlobalLayout from '@/components/layout/GlobalLayout';
import type { GroundPalette } from '@/components/layout/pageGrounds';
import type { BreadcrumbItemType } from '@/components/PageBreadcrumb';
import type { PersonRole } from '../personRoles';
import { TEACHER_PAPER, WORLD } from '../worlds/tokens';

/** The page ground under each world (S4 added the teacher grid). */
const GROUND: Record<PersonRole, GroundPalette> = { dj: 'dj', dancer: 'dancer', teacher: 'teacher' };

/** The teacher world's timetable grid, on the page box (a lazy chunk) rather than in pageGrounds (every first load). */
const line = (deg: number) => `repeating-linear-gradient(${deg}deg, ${TEACHER_PAPER.grid} 0 1px, transparent 1px 28px)`;
export const TEACHER_GRID = { backgroundImage: `${line(0)}, ${line(90)}` } as const;

/**
 * The page box around PersonFrame, ONE for every world (S3b). The owner saw Back move 4px right
 * and 3px down between the DJ (px-3 pt-2) and dancer (px-4 pt-3) pages because each world padded
 * the frame itself. max-w-xl keeps the column phone-shaped on a laptop (576px at 1280).
 */
export const WORLD_PAGE = { page: 'px-3 pb-6 pt-2', slot: 'mx-auto w-full max-w-xl' } as const;

/**
 * The shell every people world renders in: the site layout without its sub-header, the world's
 * ground, the page padding and width, then `children` (PersonFrame, or the world's own loading or
 * not-found box). No min height (owner D13): on a short page the footer comes straight after the
 * content. A world never wraps PersonFrame in its own padding (guarded by worldShellGuard.test.ts).
 */
export function WorldPage({ world, breadcrumbs, backHref, head, children }: {
  world: PersonRole;
  /** buildBreadcrumbs(...) for the page, as every GlobalLayout page passes. */
  breadcrumbs: BreadcrumbItemType[];
  /** The world's list (the layout's own back target). */
  backHref: string;
  /** Rendered before the padded box, e.g. the breadcrumb JSON-LD script. */
  head?: ReactNode;
  children: ReactNode;
}) {
  return (
    <GlobalLayout breadcrumbs={breadcrumbs} backHref={backHref} showSubheader={false} gradientPalette={GROUND[world]} fitContent>
      {head}
      <div data-testid="world-page" data-world={world} className={WORLD_PAGE.page} style={{ color: WORLD[world].ink, ...(world === 'teacher' ? TEACHER_GRID : null) }}>
        <div data-testid="world-page-slot" className={WORLD_PAGE.slot}>
          {children}
        </div>
      </div>
    </GlobalLayout>
  );
}
