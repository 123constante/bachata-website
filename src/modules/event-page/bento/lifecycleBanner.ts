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
// 'ended' DELIBERATELY HAS NO BANNER (Ricky, 2026-09-04). It used to stack one
// above the cancelled banner, which meant an ended page opened with two
// full-width statements carrying the SAME run dates -- EventEndedBanner's
// "Finished -- no longer running / Ran 3 - 24 June 2026" directly above
// EventEndedRecord's "RAN / 3 - 24 June 2026". EventEndedRecord's own docblock
// had already reserved the dates for itself ("the banner is one line and gets
// truncated by its own pill on narrow screens"); the banner printed them anyway.
// The record card is the survivor because it is a superset: same dates, plus a
// format-aware sentence ("this class/course/night has finished") and the lead-in
// to the still-running door beneath it. An ended series is a record, not an
// alarm -- the sticky treatment belongs to cancelled and paused, which are the
// states a visitor has to act on.
//
// cancelled still outranks paused and REPLACES it, unchanged: a pause is
// temporary and a cancellation is not, so there is nothing to stack. And a
// cancelled banner still renders on an ended page, because it is the only
// surface carrying the cancellation reason label.
export type LifecycleBanner = 'cancelled' | 'paused';

export function selectLifecycleBanners(p: {
  isCancelled: boolean;
  isPaused: boolean;
  isEnded: boolean;
}): LifecycleBanner[] {
  const banners: LifecycleBanner[] = [];
  if (p.isCancelled) banners.push('cancelled');
  // !isEnded still guards the pause: "back soon" must never render on a series
  // whose record card says it has finished, and the two contradict each other.
  else if (p.isPaused && !p.isEnded) banners.push('paused');
  return banners;
}
