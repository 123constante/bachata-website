import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { flags } from '@/lib/featureFlags';
import { NOT_DEACTIVATED } from '@/lib/notDeactivatedFilter';
import {
  DANCER_PUBLIC_COLS,
  attachPublicDancerName,
  mapDancerPublicProfile,
} from '@/modules/profile/dancerPublicProfile';
import { derivePersonRoles, type PersonRole } from './personRoles';

export type PersonSnapshot = {
  id: string;
  /** Privacy-masked name (surname hidden when the person chose so); null when none resolves. */
  name: string | null;
  avatarUrl: string | null;
  city: string | null;
  instagramUrl: string | null;
  roles: PersonRole[];
  /** First DJ photo, for the og:image when the person has no avatar. */
  djPhoto: string | null;
};

/**
 * The existing public reads of /dancers/:id, /djs/:id and /teachers/:id, run
 * once to learn who this person is and which roles they hold. The dancer and DJ
 * reads use the SAME query keys and bodies as those pages' loaders, so a cached
 * entry is shared (and the tab bodies hydrate without a second request). Null =
 * no public person (unknown id, deactivated/archived).
 */
export async function loadPersonSnapshot(qc: QueryClient, id: string): Promise<PersonSnapshot | null> {
  const dancerP = qc.fetchQuery({
    queryKey: ['dancer-profile', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dancer_profiles')
        .select(DANCER_PUBLIC_COLS)
        .eq('id', id)
        .not(...NOT_DEACTIVATED)
        .maybeSingle();
      if (error) throw error;
      return data ? ((await attachPublicDancerName(data)) as Record<string, unknown>) : null;
    },
    staleTime: 5 * 60 * 1000,
  });
  const djP = qc.fetchQuery({
    queryKey: ['dj-profile', id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_dj_v1', { p_dj_id: id });
      if (error) throw error;
      return (data as unknown as Record<string, unknown> | null) ?? null;
    },
    staleTime: 5 * 60 * 1000,
  }).catch(() => null); // a DJ-read hiccup hides the DJ tab; it must not take the person page down
  const teacherP = flags.teacherDetail
    ? Promise.resolve(supabase.rpc('get_public_teacher_detail_v1', { p_entity_id: id }))
        .then(({ data, error }) => !error && ((data ?? []) as unknown[]).length > 0)
        .catch(() => false)
    : Promise.resolve(false);

  const [dancer, dj, isTeacher] = await Promise.all([dancerP, djP, teacherP]);
  if (!dancer) return null;

  const view = mapDancerPublicProfile(dancer as never);
  const roles = derivePersonRoles({
    isTeacher,
    isDj: !!dj,
    hasDancerRow: true,
    hasDancerContent: !!(
      view.yearsDancing || view.partnerRole || view.favoriteStyles.length || view.achievements.length
    ),
  });
  const djPhoto = dj?.photo_url;
  return {
    id,
    name: view.displayName,
    avatarUrl: view.avatarUrl,
    city: view.city,
    instagramUrl: view.connectLinks.instagram,
    roles,
    djPhoto: ((Array.isArray(djPhoto) ? djPhoto[0] : djPhoto) as string | null | undefined) ?? null,
  };
}
