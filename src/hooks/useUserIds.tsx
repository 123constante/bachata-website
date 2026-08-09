import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { captureException } from '@/lib/sentry';
import { hasDancerProfileBasics } from '@/lib/onboardingStatus';
import type { Json } from '@/integrations/supabase/types';

export type UserRole = 'dancer' | 'organiser' | 'dj' | 'teacher' | 'videographer' | 'vendor';

export interface UserIds {
  dancerId: string | null;
  /**
   * Whether that persona is actually set up, as opposed to merely existing.
   * Every signed-in user has a `dancer_profiles` row now (the signup trigger),
   * so `dancerId` alone can no longer answer "is this person a dancer here".
   */
  dancerProfileComplete: boolean;
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
    dancerProfileComplete: false,
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
        // OWNERSHIP, not authorship -- the full note is on AuthGuard. `id` is
        // also the only link `resolve_my_person_id_v1` accepts, so a row this
        // hook reports is a row the write path can actually save.
        const dancerRes = await supabase
          .from('dancer_profiles')
          .select('id, first_name, based_city_id')
          .eq('id', user.id)
          .maybeSingle();

        const dancer = dancerRes.data;

        // `trg_handle_new_dancer_profile` mints a stub for EVERY signup, so
        // `dancer?.id` is non-null for every signed-in user now. dancerId stays
        // truthful to the database; "is this persona actually set up" is a
        // different question, and it gets a different field. The predicate is
        // shared with the onboarding gate on purpose -- two copies would drift
        // into a loop where one surface offers the dancer dashboard and the
        // other bounces the same user back to /onboarding.
        const dancerProfileComplete = hasDancerProfileBasics(dancer);

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
            .from('organiser_profiles')
            .select('id')
            .eq('claimed_by', user.id)
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
          // Deliberately NOT gated on dancerProfileComplete. Gating it there
          // saves a 200-row scan for blank signups, but it also makes the VENDOR
          // role unreachable for an operator who never filled in a dancer
          // profile: the claim never runs, vendorId stays null, availableRoles
          // comes back empty and Profile bounces them to /onboarding. A query is
          // the cheaper thing to spend.
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

              // Only a SUCCESSFUL claim grants the role. The else-arm used to
              // adopt the candidate anyway, so an RLS refusal or a network
              // failure still put the user in a vendor dashboard for a vendor
              // they had just been refused. Harmless only while this block was
              // unreachable -- `dancer?.id` was null for every account under the
              // created_by key, and the ownership repoint makes it run.
              if (!claimError && claimedVendorId) {
                vendor = { id: claimedVendorId };
              } else if (claimError) {
                captureException(claimError, { context: 'useUserIds.claimVendorProfile' });
              }
            }
          }
        } catch (vendorClaimErr) {
          console.warn('Vendor claim failed (non-fatal):', vendorClaimErr);
        }

        setIds({
          dancerId: dancer?.id || null,
          dancerProfileComplete,
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

