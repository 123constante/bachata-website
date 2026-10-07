import { useCallback, useState } from 'react';
import { usePrefersReducedMotion } from '../motion';

/** Reuses the `shake` keyframe from tailwind.config.ts at the arc's one timing. */
export const SHAKE_CLASS = 'animate-[shake_0.3s_ease-in-out]';

/**
 * Short shake on a failed save. Spread `shakeProps` on the element to shake
 * and call `shake()` when the save fails. Does nothing under reduced motion
 * (pair it with a visible error message either way).
 */
export function useShake() {
  const reduced = usePrefersReducedMotion();
  const [shaking, setShaking] = useState(false);
  const shake = useCallback(() => {
    if (reduced) return;
    // Off then on in the next frame so a second failure replays the animation.
    setShaking(false);
    requestAnimationFrame(() => setShaking(true));
  }, [reduced]);
  const onAnimationEnd = useCallback(() => setShaking(false), []);
  return {
    shake,
    shaking,
    shakeProps: { className: shaking ? SHAKE_CLASS : '', onAnimationEnd, 'data-shaking': shaking || undefined },
  };
}
