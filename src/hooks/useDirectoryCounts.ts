import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { NOT_DEACTIVATED } from '@/lib/notDeactivatedFilter';

// Live directory counts for the homepage News-tab brand-card stat strip:
// public teachers and active organisers. Each mirrors the EXACT filter of its
// directory page (/teachers via get_public_teachers_list_v1, /organisers via
// the organiser_profiles is_active query) so the headline number matches the
// list a visitor lands on. Organisers use a head-only count (zero rows on the
// wire); teachers reuse the directory RPC (~tens of small rows, cached). Both
// fall back to 0 on error so the strip never breaks. 30-min staleTime -- these
// move on the scale of days, not minutes.

export interface DirectoryCounts {
  teachers: number;
  organisers: number;
}

async function fetchTeacherCount(): Promise<number> {
  const { data, error } = await supabase.rpc('get_public_teachers_list_v1', {
    p_city_slug: null,
    p_limit: 1000,
    p_offset: 0,
  });
  if (error) throw error;
  return data?.length ?? 0;
}

async function fetchOrganiserCount(): Promise<number> {
  const { count, error } = await supabase
    .from('organiser_profiles')
    .select('id', { count: 'exact', head: true })
    .not(...NOT_DEACTIVATED);
  if (error) throw error;
  return count ?? 0;
}

export function useDirectoryCounts() {
  return useQuery<DirectoryCounts>({
    queryKey: ['home-directory-counts'],
    queryFn: async () => {
      const [teachers, organisers] = await Promise.all([
        fetchTeacherCount(),
        fetchOrganiserCount(),
      ]);
      return { teachers, organisers };
    },
    staleTime: 1000 * 60 * 30,
  });
}
