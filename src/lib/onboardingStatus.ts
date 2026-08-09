export type OnboardingStatus = "not_started" | "in_progress" | "completed";

type DancerLike = {
  first_name?: string | null;
  city?: string | null;
  city_id?: string | null;
  based_city_id?: string | null;
  meta_data?: unknown;
};

export const parseOnboardingStatus = (metaData: unknown): OnboardingStatus | null => {
  if (!metaData || typeof metaData !== "object") return null;
  const status = (metaData as Record<string, unknown>).onboarding_status;
  if (status === "not_started" || status === "in_progress" || status === "completed") {
    return status;
  }
  return null;
};

/**
 * Does this row carry the two things onboarding exists to collect?
 *
 * Shared deliberately with the role-availability gate in `useUserIds`, because
 * `trg_handle_new_dancer_profile` means a persona row now exists for EVERY
 * signed-in user. "A row exists" and "onboarding is done" stopped being the
 * same question at that point, and two copies of this predicate would drift
 * into a routing loop: one surface offering the dancer dashboard while the
 * other bounces the same user back to /onboarding.
 */
export const hasDancerProfileBasics = (dancer: DancerLike | null | undefined): boolean => {
  if (!dancer) return false;
  return (
    Boolean(dancer.first_name?.trim()) &&
    Boolean(dancer.based_city_id || dancer.city_id || dancer.city?.trim())
  );
};

export const inferOnboardingStatusFromDancer = (dancer: DancerLike | null | undefined): OnboardingStatus => {
  if (!dancer) return "not_started";

  // BASICS WIN. `save_my_dancer_profile_v1` has no meta_data arm, so no client
  // path can write this status any more -- and because the RPC also cannot clear
  // a field, honouring a stale "in_progress" stamp ahead of the data would latch
  // the user on /onboarding permanently: they fill the form, the save succeeds,
  // the stamp survives, the gate bounces them back, forever, with no UI able to
  // break the cycle. So a row that HAS the basics is completed regardless of what
  // meta_data says. Measured: zero account-linked rows carry a stamp today, which
  // makes this a latch that is armed rather than one that is firing.
  if (hasDancerProfileBasics(dancer)) return "completed";

  // Without the basics, a stamp may still choose the COPY -- "not_started" and
  // "in_progress" differ only in wording -- but it may never claim completion.
  // Letting it would make this function disagree with hasDancerProfileBasics,
  // and the two gate the same journey: AuthGuard would admit the user to
  // /profile, Profile would find no roles and bounce them back to /onboarding.
  const stamped = parseOnboardingStatus(dancer.meta_data);
  return stamped && stamped !== "completed" ? stamped : "in_progress";
};