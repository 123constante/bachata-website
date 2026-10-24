import { useMemo } from 'react';
import { useProfileProgramAppearances } from '@/hooks/useProfileProgramAppearances';
import { usePersonSnapshot } from '../../usePersonRoles';
import type { PersonRole } from '../../personRoles';
import { lowerHalf, nextAppearance, previewOf, worldRoles, type LowerHalf } from './model';

/** The same timeline read (and limit) as the hub, so a cached answer is shared. */
const TIMELINE_LIMIT = 1000;

export type DancerLower = {
  /** The tabs' roles (always with Dancer). */
  roles: PersonRole[];
  /** "Coming up" once a dated other world is known; null = no lower half (or not known yet). */
  half: LowerHalf | null;
  /**
   * S6 (owner): true only while a person who holds a teacher and/or DJ role (and has a slug, which
   * a preview needs) waits for those dates: the page reserves ONE preview row. A dancer-only person,
   * or one whose roles are still being read, reserves nothing.
   */
  reserve: boolean;
};

/**
 * The person's roles and their teacher / DJ next date. Every read is an existing public one; the
 * calendar is never read (S6). S7: when the /dancers/:id loader seeded the snapshot, the SERVER renders
 * the roles and the reserve too (the date reads are still in flight there and on the first client
 * paint, so both match); anything rendered here must therefore be the same on server and client.
 */
export function useDancerLower(id: string | undefined, slug: string | null | undefined): DancerLower {
  // usePersonSnapshot reads after mount (or arrives seeded by the loader); every later read waits for it.
  const { snapshot, answered } = usePersonSnapshot(id);
  const held = useMemo(() => snapshot?.roles ?? [], [snapshot]);
  const teacher = useProfileProgramAppearances('teacher', answered && held.includes('teacher') ? id : undefined, TIMELINE_LIMIT);
  const dj = useProfileProgramAppearances('dj', answered && held.includes('dj') ? id : undefined, TIMELINE_LIMIT);

  // A failed date read counts as "no date": no preview (just the invite), never a stuck box. So does
  // one paused offline ('paused'): the reserve must not pulse until the signal comes back.
  const settled = (q: { isPending: boolean; isError: boolean; fetchStatus: string }, wanted: boolean) =>
    !wanted || q.isError || !q.isPending || q.fetchStatus !== 'fetching';
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
    return lowerHalf(previews);
  }, [ready, slug, held, teacher.isError, teacher.data, dj.isError, dj.data]);
  const reserve = answered && !ready && !!slug && (held.includes('teacher') || held.includes('dj'));

  const roles = useMemo(() => worldRoles(held), [held]);
  return { roles, half, reserve };
}
