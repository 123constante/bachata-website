import { describe, expect, it } from 'vitest';
import { selectLifecycleBanners } from '@/modules/event-page/bento/lifecycleBanner';

const sel = (p: Partial<{ isCancelled: boolean; isPaused: boolean; isEnded: boolean }>) =>
  selectLifecycleBanners({ isCancelled: false, isPaused: false, isEnded: false, ...p });

describe('selectLifecycleBanners', () => {
  it('returns nothing when no flag is set', () => {
    expect(sel({})).toEqual([]);
  });

  it('returns "cancelled" when only cancelled', () => {
    expect(sel({ isCancelled: true })).toEqual(['cancelled']);
  });

  it('returns "paused" when only paused', () => {
    expect(sel({ isPaused: true })).toEqual(['paused']);
  });

  it('returns "ended" when only ended', () => {
    expect(sel({ isEnded: true })).toEqual(['ended']);
  });

  // Regression: cancelled and paused can co-occur (independent DB fields).
  // Cancelled is permanent and REPLACES the pause, so the cancellation reason
  // is never hidden behind a banner about a temporary hiatus.
  it('prefers "cancelled" over "paused" when both are set', () => {
    expect(sel({ isCancelled: true, isPaused: true })).toEqual(['cancelled']);
  });

  // Series-termination arc P4. An ended series can have had its final night
  // called off. Ended does NOT replace cancelled -- it STACKS above it, because
  // the cancelled banner is the only surface carrying the reason label.
  // Asserted as an ordered pair: the order is the design, not an accident.
  it('stacks "ended" above "cancelled", in that order', () => {
    expect(sel({ isEnded: true, isCancelled: true })).toEqual(['ended', 'cancelled']);
  });

  // Defence in depth. lifecycle_status is a single column, so ended and paused
  // cannot both be true against a healthy DB -- but if they ever were, the page
  // must not stack "no longer running" on top of "back soon", which contradict
  // each other. Ended wins alone.
  it('suppresses "paused" when ended is somehow also set', () => {
    expect(sel({ isEnded: true, isPaused: true })).toEqual(['ended']);
  });

  it('drops "paused" but keeps the stack when all three are set', () => {
    expect(sel({ isEnded: true, isPaused: true, isCancelled: true })).toEqual([
      'ended',
      'cancelled',
    ]);
  });
});
