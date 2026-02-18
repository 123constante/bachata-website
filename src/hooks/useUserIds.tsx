import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export type UserRole = 'dancer' | 'organiser' | 'dj' | 'teacher' | 'videographer' | 'vendor';

export interface UserIds {
  dancerId: string | null;
  organiserId: string | null;
  djId: string | null;
  teacherId: string | null;
  videographerId: string | null;
  vendorId: string | null;
  loading: boolean;
}

export const useUserIds = () => {
  const { user } = useAuth();
  const [ids, setIds] = useState<UserIds>({
    dancerId: null,
    organiserId: null,
    djId: null,
    teacherId: null,
    videographerId: null,
    vendorId: null,
    loading: true,
  });

  const [reloadIndex, setReloadIndex] = useState(0);

  const refetch = useCallback(() => {
    setReloadIndex((prev) => prev + 1);
  }, []);

  useEffect(() => {
    const fetchIds = async () => {
      if (!user) {
        setIds(prev => ({ ...prev, loading: false }));
        return;
      }

      try {
        const dancerRes = await supabase
          .from('dancers')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        const dancer = dancerRes.data;

        // Parallel fetching for performance (dependent dancer fetch already resolved)
        const [organiserRes, djRes, teacherRes, videographerRes, vendorRes] = await Promise.all([
          supabase
            .from('organisers')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle(),

          supabase
            .from('dj_profiles')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle(),

          supabase
            .from('teacher_profiles')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle(),

          supabase
            .from('videographers')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle(),

          supabase
            .from('vendors')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle(),
        ]);

        const organiser = organiserRes.data;
        const dj = djRes.data;
        const teacher = teacherRes.data;
        const videographer = videographerRes.data;
        let vendor = vendorRes.data;

        if (!vendor?.id && dancer?.id) {
          const { data: unclaimedVendors } = await supabase
            .from('vendors')
            .select('id, meta_data, team')
            .is('user_id', null)
            .limit(200);

          const matchesDancer = (row: { id: string; meta_data: Json | null; team: Json | null }) => {
            const md = row.meta_data as Record<string, unknown> | null;
            const metadataLeaderId = md?.business_leader_dancer_id;
            if (metadataLeaderId === dancer.id) return true;

            const team = Array.isArray(row.team) ? row.team : [];
            return team.some((member) => {
              const m = member as Record<string, unknown> | null;
              return m?.dancer_id === dancer.id;
            });
          };

          const candidate = (unclaimedVendors || []).find((row) => matchesDancer(row));

          if (candidate?.id) {
            const { data: claimedVendorId, error: claimError } = await supabase.rpc(
              'claim_vendor_profile_for_current_user',
              { p_vendor_id: candidate.id }
            );

            if (!claimError && claimedVendorId) {
              vendor = { id: claimedVendorId };
            } else {
              vendor = { id: candidate.id };
            }
          }
        }

        setIds({
          dancerId: dancer?.id || null,
          organiserId: organiser ? organiser.id : null,
          djId: dj ? dj.id : null,
          teacherId: teacher ? teacher.id : null,
          videographerId: videographer?.id || null,
          vendorId: vendor?.id || null,
          loading: false,
        });

      } catch (error) {
        console.error('Error fetching user IDs:', error);
        setIds(prev => ({ ...prev, loading: false }));
      }
    };

    fetchIds();
  }, [user?.id, reloadIndex]);

  return { ...ids, refetch };
};

