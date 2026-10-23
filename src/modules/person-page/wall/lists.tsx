// The two list adapters: /djs and /dancers hand their existing reads to the wall. No new reads.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Headphones } from 'lucide-react';
import { pickNationalityCode } from '@/components/people/nationality';
import { sortDjsUpcomingFirst } from '@/components/dj/djListModel';
import { renderPublicName } from '@/lib/publicName';
import type { PersonBadge } from '@/modules/person-page/badges';
import { djWallPerson, dancerWallPerson, type DjWallRow } from './model';
import { PeopleWall, WallSkeleton } from './PeopleWall';
import { WALL } from './tokens';

type DjRow = DjWallRow & { display_name: string | null; first_name?: string | null; surname?: string | null };

export function DjsWall({ djs, isLoading, badges, badgesFailed, teacherPagesOpen }: {
  djs: readonly DjRow[]; isLoading: boolean; badges: Map<string, PersonBadge>; badgesFailed: boolean; teacherPagesOpen: boolean;
}) {
  const people = useMemo(
    () => sortDjsUpcomingFirst(djs).map((dj) => djWallPerson(dj, renderPublicName(dj, 'DJ'), badges.get(dj.id), teacherPagesOpen)),
    [djs, badges, teacherPagesOpen],
  );
  if (isLoading) return <WallSkeleton />;
  return (
    <PeopleWall
      list="djs"
      people={people}
      showTeachers={teacherPagesOpen}
      filtersWork={!badgesFailed}
      emptyAll={(
        <div className="py-12 text-center" data-testid="wall-empty">
          <Headphones className="mx-auto mb-3 h-8 w-8" style={{ color: WALL.muted }} aria-hidden="true" />
          <p className="text-[14px]">No DJs on the wall yet. Check back soon, or look at <Link to="/" className="font-bold underline">what is on this week</Link>.</p>
        </div>
      )}
    />
  );
}

/**
 * The /dancers hero "Book a Photoshoot" card with the wall ON: the site's only media-booking page
 * (= SITE_IA.videographers.path, pinned by wall.test; today's /photographers is unrouted). Literal for
 * the same chunk reason as ORGANISERS_HREF in PeopleWall.tsx.
 */
export const MEDIA_BOOKING_HREF = '/videographers';

type DancerRow = { id: string; avatar_url: string | null; nationality?: string | null };

export function DancersWall<T extends DancerRow>({ dancers, getName, isLoading, badges, badgesFailed, teacherPagesOpen }: {
  dancers: readonly T[]; getName: (d: T) => string; isLoading: boolean;
  badges: Map<string, PersonBadge>; badgesFailed: boolean; teacherPagesOpen: boolean;
}) {
  const people = useMemo(
    () => dancers.map((d) => dancerWallPerson(d, getName(d), pickNationalityCode(d), badges.get(d.id), teacherPagesOpen)),
    [dancers, getName, badges, teacherPagesOpen],
  );
  if (isLoading) return <WallSkeleton />;
  return (
    <PeopleWall
      list="dancers"
      people={people}
      showTeachers={teacherPagesOpen}
      filtersWork={!badgesFailed}
      emptyAll={(
        <div className="py-12 text-center" data-testid="wall-empty">
          <p className="text-[14px]">No dancers on the wall yet. Check back soon, or look at <Link to="/" className="font-bold underline">what is on this week</Link>.</p>
        </div>
      )}
    />
  );
}
