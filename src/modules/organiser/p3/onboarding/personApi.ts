// The person screens' reads and writes. Every one is an EXISTING live RPC (read on prod
// 2026-10-29, pg_get_functiondef); no new server code:
//   read  my_dancer_edit_v1            -> dancer_profiles first_name, avatar_url, dance_role, nationality, languages
//   read  my_role_intent_v1            -> account_role_intent roles / declined (the teach answer)
//   read  my_role_details_v1('teacher') -> teacher_role_details levels_taught, teaching_styles, years_teaching
//   read  organiser_profiles (public select) name, bio, organisation_category, city_id (+ cities.name)
//   write save_my_dancer_profile_v2    -> name, photo, role, nationality, languages (diff-first, one key)
//   write set_my_role_intent_v1 / set_my_role_declined_v1 (answerDoYou) -> the teach answer
//   write save_my_role_v1('teacher')   -> levels_taught, teaching_styles, years_teaching
//   write organiser_profile_update_p5_v1 {bio} -> About; skip_organiser_about_v1 -> About skipped
//   write save_my_signin_email_v1()    -> copies the SIGN-IN email to the private dancer_profiles.email
import { supabase } from '@/integrations/supabase/client';
import { answerDoYou, fetchMyRoleIntent, type RoleIntent } from '@/modules/areas/home/rolesApi';
import { fetchMyRoleDetails, saveMyRole } from '@/modules/areas/shared/areaApi';
import { fetchWizardDancer, saveWizardDancer } from '../../wizard/dancerApi';
import type { PersonCommand } from './personModel';

type UntypedRpc = { rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }> };
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase as unknown as UntypedRpc).rpc(fn, args);

export type OrganiserBrief = { id: string; name: string; bio: string; category: string | null; city: string | null };

export interface PersonReads {
  dancer: () => Promise<Record<string, unknown>>;
  intent: () => Promise<RoleIntent>;
  teacher: () => Promise<Record<string, unknown>>;
  organiser: (id: string) => Promise<OrganiserBrief | null>;
}

export interface PersonWrites {
  run: (cmd: PersonCommand, organiserId: string | null) => Promise<void>;
  skipAbout: (organiserId: string) => Promise<void>;
}

async function fetchOrganiserBrief(id: string): Promise<OrganiserBrief | null> {
  const { data, error } = await supabase.from('organiser_profiles').select('id, name, bio, organisation_category, city_id').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as { id: string; name: string | null; bio: string | null; organisation_category: string | null; city_id: string | null };
  let city: string | null = null;
  if (row.city_id) {
    const c = await supabase.from('cities').select('name').eq('id', row.city_id).maybeSingle();
    city = (c.data as { name?: string } | null)?.name ?? null;
  }
  return { id: row.id, name: row.name ?? '', bio: row.bio ?? '', category: row.organisation_category, city };
}

export const REAL_READS: PersonReads = {
  dancer: fetchWizardDancer,
  intent: fetchMyRoleIntent,
  teacher: async () => (await fetchMyRoleDetails('teacher')).details,
  organiser: fetchOrganiserBrief,
};

const must = async (p: PromiseLike<{ error: { message: string } | null }>) => {
  const { error } = await p;
  if (error) throw new Error(error.message);
};

export const REAL_WRITES: PersonWrites = {
  run: async (cmd, organiserId) => {
    switch (cmd.kind) {
      case 'dancer': await saveWizardDancer(cmd.patch); return;
      case 'teach': await answerDoYou('teacher', cmd.yes); return;
      case 'teacher': await saveMyRole('teacher', cmd.patch); return;
      case 'about':
        if (!organiserId) throw new Error('no_organiser');
        await must(rpc('organiser_profile_update_p5_v1', { p_organiser_id: organiserId, p_patch: { bio: cmd.bio } }));
        return;
      case 'signinEmail': await must(rpc('save_my_signin_email_v1')); return;
    }
  },
  skipAbout: (organiserId) => must(rpc('skip_organiser_about_v1', { p_organiser_id: organiserId })),
};

/** The query keys a person save makes stale (the dancer app, the profile gate, the role reads). */
export const PERSON_STALE_KEYS: readonly (readonly string[])[] = [['my-dancer-edit'], ['profile-completion'], ['my-role-intent'], ['my-roles'], ['wizard-dancer']];
