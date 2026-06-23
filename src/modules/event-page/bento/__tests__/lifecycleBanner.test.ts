import { describe, expect, it } from 'vitest';
import { selectLifecycleBanner } from '@/modules/event-page/bento/lifecycleBanner';

describe('selectLifecycleBanner', () => {
  it('returns null when neither flag is set', () => {
    expect(selectLifecycleBanner({ isCancelled: false, isPaused: false })).toBeNull();
  });

  it('returns "cancelled" when only cancelled', () => {
    expect(selectLifecycleBanner({ isCancelled: true, isPaused: false })).toBe('cancelled');
  });

  it('returns "paused" when only paused', () => {
    expect(selectLifecycleBanner({ isCancelled: false, isPaused: true })).toBe('paused');
  });

  // Regression: both flags can co-occur (independent DB fields). Cancelled is
  // permanent and must win so the cancellation reason is never hidden behind
  // the paused banner.
  it('prefers "cancelled" when both flags are set', () => {
    expect(selectLifecycleBanner({ isCancelled: true, isPaused: true })).toBe('cancelled');
  });
});
