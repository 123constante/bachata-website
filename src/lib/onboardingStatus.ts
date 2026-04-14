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

export const inferOnboardingStatusFromDancer = (dancer: DancerLike | null | undefined): OnboardingStatus => {
  if (!dancer) return "not_started";

  const explicitStatus = parseOnboardingStatus(dancer.meta_data);
  if (explicitStatus) return explicitStatus;

  const hasRequiredBasics = Boolean(dancer.first_name?.trim()) && Boolean(dancer.based_city_id || dancer.city_id || dancer.city?.trim());
  return hasRequiredBasics ? "completed" : "in_progress";
};