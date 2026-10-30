// organiser_onboarding_status_v1() for every page the person is on, read ONCE: Home's grace banner and the You
// tab share this key, so the "things left" both show comes from the same answer.
import { supabase } from '@/integrations/supabase/client';

type UntypedRpc = { rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }> };

export const onboardingStatusKey = (userId: string | undefined) => ['p3-ob-status', 'all', userId] as const;

export async function fetchOnboardingStatus(): Promise<unknown> {
  const { data, error } = await (supabase as unknown as UntypedRpc).rpc('organiser_onboarding_status_v1', {});
  if (error) throw new Error(error.message);
  return data;
}
