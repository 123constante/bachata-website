import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { captureException } from '@/lib/sentry';
import type { Json } from '@/integrations/supabase/types';

export type UserRole = 'dancer' | 'organiser' | 'dj' | 'teacher' | 'videographer' | 'vendor';

export interface UserIds {
  dancerId: string | null;
  organiserId: string | null;
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
          .from('dancer_profiles')
          .select('id')
          .eq('created_by', user.id)
          .maybeSingle();

        const dancer = dancerRes.data;

        // Teacher identity post phase4_drop_teacher_profiles_table_v1: teacherId is
        // the dancer profile id if (and only if) person_roles has an active 'teaching'
        // role for that person. Skip the lookup entirely when there's no dancer
        // profile — there can be no canonical teacher without one.
        const teacherRolePromise: Promise<{ data: { id: string } | null }> = (async () => {
          if (!dancer?.id) return { data: null };
          const res = await supabase
            .from('person_roles')
            .select('id:person_id')
            .eq('person_id', dancer.id)
            .eq('role', 'teaching')
            .eq('is_active', true)
            .maybeSingle();
          return { data: (res.data as { id: string } | null) ?? null };
        })();

        // Parallel fetching for performance (dependent dancer fetch already resolved)
        const [organiserRes, teacherRes, videographerRes, vendorRes] = await Promise.all([
          supabase
            .from('entities')
            .select('id, city_id, cities(name)')
            .eq('claimed_by', user.id)
            .eq('type', 'organiser')
            .maybeSingle(),

          teacherRolePromise,

          supabase
            .from('videographers')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle(),

          supabase
            .from('vendors')
            .select('id, city_id, cities(name)')
            .eq('user_id', user.id)
            .maybeSingle(),
        ]);

        const organiser = organiserRes.data;
        const teacher = teacherRes.data;
        const videographer = videographerRes.data;
        let vendor: { id: string } | null = vendorRes.data?.id ? { id: vendorRes.data.id } : null;

        // Vendor-claim in its own try/catch so failures don't wipe other IDs
        try {
          if (!vendor?.id && dancer?.id) {
            const { data: unclaimedVendors } = await supabase
              .from('vendors')
              .select('id, city_id, cities(name), meta_data, team')
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
        } catch (vendorClaimErr) {
          console.warn('Vendor claim failed (non-fatal):', vendorClaimErr);
        }

        setIds({
          dancerId: dancer?.id || null,
          organiserId: organiser ? organiser.id : null,
          teacherId: teacher ? teacher.id : null,
          videographerId: videographer?.id || null,
          vendorId: vendor?.id || null,
          loading: false,
        });

      } catch (error) {
        captureException(error, { context: 'useUserIds.fetchIds' });
        setIds(prev => ({ ...prev, loading: false }));
      }
    };

    fetchIds();
  }, [user, reloadIndex]);

  return { ...ids, refetch };
};

