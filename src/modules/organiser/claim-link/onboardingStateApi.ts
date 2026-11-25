import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// organiser_onboarding_v2_state_v1 is live in prod but not in the generated Database type
// (never hand-edited): same string-named boundary as claimLinkApi.
type UntypedRpc = {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export type OnboardingV2State = { profileGateApplies: boolean };

/** Fail closed: only an explicit `profile_gate_applies === false` lifts the gate. */
export const parseOnboardingV2State = (raw: unknown): OnboardingV2State => {
  const v = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).profile_gate_applies : undefined;
  return { profileGateApplies: v !== false };
};

export async function fetchOnboardingV2State(): Promise<OnboardingV2State> {
  try {
    const { data, error } = await (supabase as unknown as UntypedRpc).rpc('organiser_onboarding_v2_state_v1');
    if (error) return { profileGateApplies: true };
    return parseOnboardingV2State(data);
  } catch {
    return { profileGateApplies: true };
  }
}

/** undefined while loading or signed out (callers keep today's behaviour). */
export function useOnboardingV2State(): OnboardingV2State | undefined {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ['organiser-onboarding-v2-state', user?.id],
    queryFn: fetchOnboardingV2State,
    enabled: !!user,
    staleTime: 60_000,
  });
  return q.data;
}
