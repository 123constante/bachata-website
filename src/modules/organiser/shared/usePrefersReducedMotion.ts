import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';
const matches = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches;

/** True when the device asks for reduced motion (false where matchMedia does not exist). */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(matches);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(QUERY);
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}
