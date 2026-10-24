import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCalendarEvents } from '@/integrations/supabase/eventRpcs';
import { resolveCanonicalCity } from '@/lib/city-canonical';
import { londonDayRangeUtc, londonTodayKey } from '@/lib/londonDate';
import { useProfileProgramAppearances } from '@/hooks/useProfileProgramAppearances';
import { usePersonSnapshot } from '../../usePersonRoles';
import type { PersonRole } from '../../personRoles';
import { lowerHalf, nextAppearance, previewOf, socialsThisWeek, worldRoles, type LowerHalf, type SocialsDay } from './model';

/** The same timeline read (and limit) as the hub, so a cached answer is shared. */
const TIMELINE_LIMIT = 1000;

export type SocialsState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; days: SocialsDay[]; total: number };

export type DancerLower = {
  /** The tabs' roles (always with Dancer). */
  roles: PersonRole[];
  /** null while the roles and the other worlds' dates are still being read. */
  half: LowerHalf | null;
  socials: SocialsState;
};

/**
 * Client-only (after mount, so the server HTML and the first paint match): the person's roles,
 * their teacher / DJ next date, and -- only when no other world is dated -- this week's socials
 * in their city (London when none). Every read is an existing public one.
 */
export function useDancerLower(id: string | undefined, slug: string | null | undefined, city: string | null | undefined): DancerLower {
  // usePersonSnapshot reads only after mount, and every later read waits for its answer.
  const { snapshot, answered } = usePersonSnapshot(id);
  const held = useMemo(() => snapshot?.roles ?? [], [snapshot]);
  const teacher = useProfileProgramAppearances('teacher', answered && held.includes('teacher') ? id : undefined, TIMELINE_LIMIT);
  const dj = useProfileProgramAppearances('dj', answered && held.includes('dj') ? id : undefined, TIMELINE_LIMIT);
  const today = londonTodayKey();

  // A failed date read counts as "no date": the page then shows the socials, never a stuck box.
  const settled = (q: { isPending: boolean; isError: boolean; fetchStatus: string }, wanted: boolean) =>
    !wanted || q.isError || !q.isPending || q.fetchStatus === 'idle';
  const ready = answered && settled(teacher, held.includes('teacher')) && settled(dj, held.includes('dj'));

  const half = useMemo(() => {
    if (!ready) return null;
    // Previews link like the role tabs: by slug, and only when there is one (the tabs need it too).
    const previews = slug
      ? [
          held.includes('teacher') ? previewOf('teacher', slug, nextAppearance(teacher.isError ? [] : teacher.data)) : null,
          held.includes('dj') ? previewOf('dj', slug, nextAppearance(dj.isError ? [] : dj.data)) : null,
        ]
      : [];
    return lowerHalf(previews, city);
  }, [ready, slug, held, teacher.isError, teacher.data, dj.isError, dj.data, city]);

  const socialsCity = half?.kind === 'socials' ? half.city : null;
  const socials = useQuery({
    queryKey: ['dancer-world-socials', socialsCity, today],
    enabled: socialsCity !== null,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const found = await resolveCanonicalCity(socialsCity);
      // A city the calendar does not know has no socials listed: an honest empty state.
      if (!found) return [];
      const { start, end } = londonDayRangeUtc(today, 7);
      return getCalendarEvents({ range_start: start.toISOString(), range_end: end.toISOString(), city_slug_param: found.citySlug });
    },
  });

  const socialsState: SocialsState = socials.isError
    ? { status: 'error' }
    : socials.data
      ? { status: 'ready', ...socialsThisWeek(socials.data, today) }
      : { status: 'loading' };

  const roles = useMemo(() => worldRoles(held), [held]);
  return { roles, half, socials: socialsState };
}
