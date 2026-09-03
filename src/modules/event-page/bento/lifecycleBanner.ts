// Single source of truth for which lifecycle banners an event page shows.
//
// Three independent DB facts feed this, and they are NOT mutually exclusive:
//   isCancelled -- occurrence-level, from the loaded occurrence
//   isPaused    -- series lifecycle_status = 'paused'
//   isEnded     -- series lifecycle_status = 'ended'
//
// isPaused and isEnded cannot both be true (one lifecycle column, one value),
// but EITHER can coincide with a cancelled occurrence: a series can finish its
// run with its final night called off.
//
// Order and multiplicity are deliberate, and were Ricky's call:
//   - 'ended' outranks everything and STACKS above a cancellation rather than
//     replacing it. The series being over is the bigger fact, but the cancelled
//     banner carries the reason label, and suppressing it would destroy the only
//     place that reason is shown. Both render; ended sits on top.
//   - cancelled still outranks paused and REPLACES it, unchanged from before:
//     a pause is temporary and a cancellation is not, so there is nothing to
//     stack -- the pause is simply the less useful of the two statements.
export type LifecycleBanner = 'ended' | 'cancelled' | 'paused';

export function selectLifecycleBanners(p: {
  isCancelled: boolean;
  isPaused: boolean;
  isEnded: boolean;
}): LifecycleBanner[] {
  const banners: LifecycleBanner[] = [];
  if (p.isEnded) banners.push('ended');
  if (p.isCancelled) banners.push('cancelled');
  else if (p.isPaused && !p.isEnded) banners.push('paused');
  return banners;
}
