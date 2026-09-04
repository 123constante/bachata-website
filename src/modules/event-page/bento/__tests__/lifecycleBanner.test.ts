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

  // 'ended' takes NO banner (2026-09-04). The record card in the bento column is
  // the single statement that the series has finished; a banner as well printed
  // the same run dates directly above it. Asserted rather than deleted, because
  // "no banner" is the design and a re-added one must fail here first.
  it('returns NO banner when only ended', () => {
    expect(sel({ isEnded: true })).toEqual([]);
  });

  // Regression: cancelled and paused can co-occur (independent DB fields).
  // Cancelled is permanent and REPLACES the pause, so the cancellation reason
  // is never hidden behind a banner about a temporary hiatus.
  it('prefers "cancelled" over "paused" when both are set', () => {
    expect(sel({ isCancelled: true, isPaused: true })).toEqual(['cancelled']);
  });

  // Series-termination arc P4, revised 2026-09-04. An ended series can have had
  // its final night called off. The cancelled banner still renders -- it is the
  // only surface carrying the reason label -- and it now renders ALONE, with the
  // record card stating that the series has finished.
  it('shows only cancelled when an ended series had its final night called off', () => {
    expect(sel({ isEnded: true, isCancelled: true })).toEqual(['cancelled']);
  });

  // Defence in depth. lifecycle_status is a single column, so ended and paused
  // cannot both be true against a healthy DB -- but if they ever were, the page
  // must not show "back soon" on a page whose record card says the run is over.
  it('suppresses "paused" when ended is somehow also set', () => {
    expect(sel({ isEnded: true, isPaused: true })).toEqual([]);
  });

  it('drops "paused" and keeps only cancelled when all three are set', () => {
    expect(sel({ isEnded: true, isPaused: true, isCancelled: true })).toEqual(['cancelled']);
  });
});
