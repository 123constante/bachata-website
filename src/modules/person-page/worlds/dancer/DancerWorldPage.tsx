import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { BreadcrumbItemType } from '@/components/PageBreadcrumb';
import { PersonFrame, WorldPage } from '../../frame';
import { TAP } from '../../roleSwitch';
import { FOCUS_RING } from '../../wall/tokens';
import { WORLD } from '../tokens';
import { DancerWorld, DancerWorldSkeleton } from './DancerWorld';
import { dancerCard, type DancerWorldInput } from './model';
import { useDancerLower } from './useDancerLower';

const T = WORLD.dancer;

/**
 * /dancers/:id with flags.personWorlds ON: the shared shell (frame/WorldPage: ground, padding,
 * width, no min height), the frame (Back + Share, role tabs) and the dancer world. Its own
 * component so the flag-OFF page makes none of these reads (the hooks live here, not in
 * DancerProfile). S2b: no padding or width of its own, so Back sits where the DJ world's does.
 */
export function DancerWorldPage({ id, slug, input, shareTitle, inviteHref, ownerPlans, breadcrumbs }: {
  id: string;
  slug: string | null | undefined;
  input: DancerWorldInput;
  shareTitle: string;
  inviteHref: string | null;
  ownerPlans?: ReactNode;
  breadcrumbs: BreadcrumbItemType[];
}) {
  const { name, photo, nationality, city, danceRole, languages, contacts } = input;
  const card = useMemo(
    () => dancerCard({ name, photo, nationality, city, danceRole, languages, contacts }),
    [name, photo, nationality, city, danceRole, languages, contacts],
  );
  const lower = useDancerLower(id, slug, city);
  return (
    <WorldPage world="dancer" breadcrumbs={breadcrumbs} backHref="/dancers">
      {/* Owner D9: Back goes where they came from (the frame's history rule). */}
      <PersonFrame backHref="/dancers" shareTitle={shareTitle} roles={lower.roles} current="dancer" slug={slug}>
        <DancerWorld card={card} lower={lower} inviteHref={inviteHref} ownerPlans={ownerPlans} />
      </PersonFrame>
    </WorldPage>
  );
}

/** The dancer read in flight: the frame's boxes on the dancer ground, in the same shell (no jump). */
export function DancerWorldLoading({ breadcrumbs, invite }: { breadcrumbs: BreadcrumbItemType[]; invite: boolean }) {
  return (
    <WorldPage world="dancer" breadcrumbs={breadcrumbs} backHref="/dancers">
      <div data-testid="dancer-world-loading" aria-busy>
        <div className="h-11 w-full animate-pulse rounded-[12px]" style={{ background: T.section.background }} />
        <DancerWorldSkeleton invite={invite} />
      </div>
    </WorldPage>
  );
}

/** No such dancer (or the read failed): says so and offers the list, in the same shell. */
export function DancerWorldMissing({ breadcrumbs }: { breadcrumbs: BreadcrumbItemType[] }) {
  return (
    <WorldPage world="dancer" breadcrumbs={breadcrumbs} backHref="/dancers">
      <div className="flex flex-col items-center gap-3 py-10 text-center" data-testid="dancer-world-missing">
        <p className="m-0" style={{ fontSize: 15, color: T.card.muted }}>This dancer profile doesn&rsquo;t exist or has been removed.</p>
        <Link
          to="/dancers"
          className={`inline-flex items-center gap-2 rounded-full px-4 font-bold ${FOCUS_RING}`}
          style={{ minHeight: TAP, fontSize: 14, color: T.accent, border: `1px solid ${T.avatar.ring}` }}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Dancers
        </Link>
      </div>
    </WorldPage>
  );
}
