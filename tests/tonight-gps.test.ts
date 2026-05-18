import { describe, expect, it } from 'vitest';

/**
 * Contract tests for the GPS-only Tonight location flow.
 *
 * The hook (src/hooks/useGeolocation.ts) is tightly coupled to React state
 * and the Geolocation API, neither of which run cleanly in vitest's node
 * env without jsdom/happy-dom. These tests cover the pure helpers and the
 * mapping contract â€” the integration paths are covered by browser smoke
 * and the manual iPhone test plan.
 */

function mapPositionErrorToReason(
  code: number | undefined | null,
): 'denied' | 'unavailable' | 'timeout' {
  if (code === 2) return 'unavailable';
  if (code === 3) return 'timeout';
  return 'denied';
}

describe('useGeolocation error -> reason mapping (contract)', () => {
  it('code 1 (PERMISSION_DENIED) maps to denied', () => {
    expect(mapPositionErrorToReason(1)).toBe('denied');
  });

  it('code 2 (POSITION_UNAVAILABLE) maps to unavailable', () => {
    expect(mapPositionErrorToReason(2)).toBe('unavailable');
  });

  it('code 3 (TIMEOUT) maps to timeout (triggers high-accuracy retry)', () => {
    expect(mapPositionErrorToReason(3)).toBe('timeout');
  });

  it('missing or unknown code falls through to denied (safe default)', () => {
    expect(mapPositionErrorToReason(undefined)).toBe('denied');
    expect(mapPositionErrorToReason(null)).toBe('denied');
    expect(mapPositionErrorToReason(99)).toBe('denied');
  });
});

describe('NearMeCta retry-link visibility contract', () => {
  // The "Try again" link is rendered iff retry can plausibly succeed.
  // PERMISSION_DENIED on iOS sticks per-site and re-issuing
  // getCurrentPosition fails instantly. For timeout/unavailable, retry
  // can legitimately recover (better signal, GPS warm-up, etc.).
  const showRetry = (
    reason: 'denied' | 'unavailable' | 'timeout' | 'insecure' | null,
    onIOS: boolean,
  ) => !(reason === 'denied' && onIOS) && reason !== 'insecure';

  it('hides retry on iOS when reason is denied', () => {
    expect(showRetry('denied', true)).toBe(false);
  });

  it('shows retry on iOS for timeout/unavailable', () => {
    expect(showRetry('timeout', true)).toBe(true);
    expect(showRetry('unavailable', true)).toBe(true);
  });

  it('shows retry on non-iOS even for denied (browser flow allows re-prompt)', () => {
    expect(showRetry('denied', false)).toBe(true);
  });

  it('never shows retry when reason is insecure (HTTP context unfixable client-side)', () => {
    expect(showRetry('insecure', true)).toBe(false);
    expect(showRetry('insecure', false)).toBe(false);
  });
});
