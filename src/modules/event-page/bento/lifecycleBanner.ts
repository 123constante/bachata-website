// Single source of truth for which lifecycle banner an event page shows.
//
// isCancelled (occurrence-level) and isPaused (series lifecycle_status) are
// independent DB fields with no mutual-exclusion constraint, so both can be
// true at once. Cancellation is permanent and outranks a (temporary) pause:
// when both are set we surface the cancelled banner -- which carries the
// reason label -- rather than silently hiding it behind the paused banner.
export type LifecycleBanner = 'cancelled' | 'paused' | null;

export function selectLifecycleBanner(p: {
  isCancelled: boolean;
  isPaused: boolean;
}): LifecycleBanner {
  if (p.isCancelled) return 'cancelled';
  if (p.isPaused) return 'paused';
  return null;
}
