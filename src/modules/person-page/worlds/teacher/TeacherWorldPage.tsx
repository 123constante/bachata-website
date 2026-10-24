import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { BreadcrumbItemType } from '@/components/PageBreadcrumb';
import { useAuth } from '@/hooks/useAuth';
import { useProfileProgramAppearances } from '@/hooks/useProfileProgramAppearances';
import { useCity } from '@/contexts/CityContext';
import { buildCityPath } from '@/lib/cityPath';
import { londonTodayKey } from '@/lib/londonDate';
import { PersonFrame, WorldPage } from '../../frame';
import { TAP } from '../../roleSwitch';
import { usePersonSnapshot } from '../../usePersonRoles';
import { FOCUS_RING } from '../../wall/tokens';
import { TEACHER_PAPER, WORLD } from '../tokens';
import { TeacherWorld } from './TeacherWorld';
import { teacherWorldView, type TeacherWorldInput } from './model';

const T = WORLD.teacher;

/**
 * /teachers/:id with flags.personWorlds ON: the shared shell (frame/WorldPage: the teacher grid
 * ground, padding, width, no min height), the frame (Back + Share, role tabs) and the teacher
 * world. Its own component so the flag-OFF page makes none of these reads.
 */
export function TeacherWorldPage({ id, slug, row, photo, breadcrumbs }: {
  id: string;
  slug: string | null | undefined;
  row: TeacherWorldInput['row'];
  photo: string | null;
  breadcrumbs: BreadcrumbItemType[];
}) {
  const { pathname } = useLocation();
  // D8'': the invite is for signed-out visitors.
  const { user } = useAuth();
  const { citySlug } = useCity();
  const person = usePersonSnapshot(id);
  // The timeline is not dehydrated by the loader: read it after mount, so the server and the first
  // client render match (the DJ page's React #418 lesson).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const timeline = useProfileProgramAppearances('teacher', mounted ? id : undefined, 1000);
  const classes = timeline.isError ? 'failed' : timeline.isFetched ? 'ready' : 'loading';
  const view = useMemo(
    () => teacherWorldView({
      row,
      classes: timeline.data ?? [],
      today: londonTodayKey(),
      classesHref: buildCityPath(citySlug, 'classes'),
      pathname,
      viewer: user,
    }),
    [row, timeline.data, citySlug, pathname, user],
  );
  return (
    <WorldPage world="teacher" breadcrumbs={breadcrumbs} backHref="/teachers">
      {/* Owner D9: Back goes where they came from (the frame's history rule). */}
      <PersonFrame
        backHref="/teachers"
        shareTitle={`${view.big} on Bachata Calendar`}
        roles={person.snapshot?.roles ?? []}
        current="teacher"
        slug={slug}
        rolesPending={!person.answered}
      >
        <TeacherWorld view={view} photo={photo} classes={classes} onRetry={() => void timeline.refetch()} />
      </PersonFrame>
    </WorldPage>
  );
}

/** The teacher read in flight: the frame's boxes on the teacher ground, in the same shell (no jump). */
export function TeacherWorldLoading({ breadcrumbs }: { breadcrumbs: BreadcrumbItemType[] }) {
  return (
    <WorldPage world="teacher" breadcrumbs={breadcrumbs} backHref="/teachers">
      <div data-testid="teacher-world-loading" aria-busy>
        <div className="h-11 w-full animate-pulse rounded-[12px]" style={{ background: T.section.background }} />
        <div className="mt-3 h-[168px] w-full animate-pulse rounded-[18px]" style={{ background: T.section.row }} />
      </div>
    </WorldPage>
  );
}

/** No such teacher (or the read failed): says so and offers the list, in the same shell. */
export function TeacherWorldMissing({ breadcrumbs }: { breadcrumbs: BreadcrumbItemType[] }) {
  return (
    <WorldPage world="teacher" breadcrumbs={breadcrumbs} backHref="/teachers">
      <div className="flex flex-col items-center gap-3 py-10 text-center" data-testid="teacher-world-missing">
        <p className="m-0" style={{ fontSize: 15, color: TEACHER_PAPER.rowMuted }}>This teacher profile doesn&rsquo;t exist or has been removed.</p>
        <Link
          to="/teachers"
          className={`inline-flex items-center gap-2 rounded-full px-4 font-bold ${FOCUS_RING}`}
          style={{ minHeight: TAP, fontSize: 14, color: T.accent, border: `1px solid ${T.avatar.ring}` }}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Teachers
        </Link>
      </div>
    </WorldPage>
  );
}
