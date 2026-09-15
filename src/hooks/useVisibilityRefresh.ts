import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export interface UseVisibilityRefreshOptions {
  /** React Query key to invalidate. Passed by identity each render -- read via
   *  a ref, NEVER put in the effect's dependency array (see note below). */
  queryKey: readonly unknown[];
  /** How often to refetch while the tab is visible. */
  intervalMs: number;
  enabled?: boolean;
}

/**
 * Phase 3 (IO optimization arc, resumed) -- replaces fixed-interval polling
 * with a visibility-gated refetch: refetches immediately on tab focus /
 * becoming visible, then polls on `intervalMs` only while the tab stays
 * visible, and stops the interval entirely on blur/hidden. Net effect vs a
 * plain `refetchInterval`: zero background-tab IO.
 *
 * The reverted Phase 3 (1ae7b10, revert #418) put a fresh object literal
 * (with an inline `Math.random()`) in this effect's own dependency array, so
 * it re-ran and re-subscribed on every render -- silently defeating the
 * whole point. Fixed here by reading `queryKey`/`intervalMs` through a ref
 * updated every render, so the effect itself depends only on `queryClient`
 * and `enabled` (stable across renders) and subscribes exactly once.
 */
export function useVisibilityRefresh({
  queryKey,
  intervalMs,
  enabled = true,
}: UseVisibilityRefreshOptions): void {
  const queryClient = useQueryClient();
  const configRef = useRef({ queryKey, intervalMs });
  configRef.current = { queryKey, intervalMs };

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let staggerTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: configRef.current.queryKey });
    };

    const stop = () => {
      if (intervalId != null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      if (staggerTimeoutId != null) {
        clearTimeout(staggerTimeoutId);
        staggerTimeoutId = null;
      }
    };

    // Stagger the FIRST tick per mount (0-20% of the interval) so many tabs/
    // hooks mounted at the same instant don't all hit Supabase in lockstep.
    const start = () => {
      stop();
      const jitter = Math.random() * configRef.current.intervalMs * 0.2;
      staggerTimeoutId = setTimeout(() => {
        intervalId = setInterval(() => invalidate(), configRef.current.intervalMs);
      }, jitter);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        invalidate();
        start();
      } else {
        stop();
      }
    };

    const handleFocus = () => invalidate();

    if (document.visibilityState === 'visible') {
      start();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
    // queryKey/intervalMs deliberately excluded -- read via configRef so an
    // unstable literal passed by the caller can never rebuild this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, enabled]);
}
