// The two list adapters: /djs and /dancers hand their existing reads to the wall. No new reads.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Headphones } from 'lucide-react';
import { pickNationalityCode } from '@/components/people/nationality';
import { sortDjsUpcomingFirst } from '@/components/dj/djListModel';
import { renderPublicName } from '@/lib/publicName';
import { HOME_ANNOUNCE_HREF } from '@/lib/homeAnnounceBanner';
import { SITE_IA } from '@/lib/breadcrumbs/siteIa';
import type { PersonBadge } from '@/modules/person-page/badges';
import { djWallPerson, dancerWallPerson, type DjWallRow } from './model';
import { PeopleWall, WallSkeleton } from './PeopleWall';
import { FOCUS_RING, WALL } from './tokens';

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
 * Under the /dancers wall (owner, 2026-10-21): join it, or book a photoshoot. Both targets are the
 * site's REAL routes: the dancer sign-up the home banner uses (the old /create-dancers-profile is
 * unrouted) and the media page in the site map (the old /photographers is unrouted).
 */
function JoinRow() {
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-3 pb-6"
      style={{ background: WALL.page, color: WALL.text }}
      data-testid="wall-join-row"
    >
      <Link
        to={HOME_ANNOUNCE_HREF}
        className={`inline-flex items-center rounded-full font-bold no-underline ${FOCUS_RING}`}
        style={{ minHeight: 44, padding: '0 18px', fontSize: 14, background: WALL.text, color: WALL.page }}
      >
        Join the wall
      </Link>
      <Link
        to={SITE_IA.videographers.path}
        className={`inline-flex items-center font-semibold underline ${FOCUS_RING}`}
        style={{ minHeight: 44, fontSize: 14, color: WALL.text }}
      >
        Book a photoshoot
      </Link>
    </div>
  );
}

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
    <div>
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
      <JoinRow />
    </div>
  );
}
