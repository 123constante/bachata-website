/**
 * Nothing may depend on vibration: every call is a no-op where navigator.vibrate is missing or throws.
 */
export type Buzz = 'tap' | 'error';
export const BUZZ: Record<Buzz, number | number[]> = { tap: 10, error: [30, 60, 30] };

export function vibrate(kind: Buzz = 'tap'): boolean {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
    return navigator.vibrate(BUZZ[kind]);
  } catch {
    return false;
  }
}
