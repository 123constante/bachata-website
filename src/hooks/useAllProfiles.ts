import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { UnifiedProfile } from '@/types/profiles';

export function useAllProfiles() {
  return useQuery({
    queryKey: ['all-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_all_profiles_v1');
      if (error) throw error;
      return data as UnifiedProfile[];
    },
  });
}
