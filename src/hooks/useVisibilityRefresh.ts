// Phase 3: useVisibilityRefresh — Smart background refetch only when page is visible
// 
// Replaces aggressive fixed-interval polling with:
// - Refetch only when browser tab is visible (document.visibilitychange event)
// - Refetch only when window regains focus (window focus event)
// - Configurable refetch interval (default 5 min vs old 60s polling)
// - Staggered startup to avoid thundering herd on server restart
//
// Expected impact: 30-50% reduction in Supabase queries for raffles/stats.
// Queries still fire on user interaction (tab switch, navigation), but ONLY when visible.

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface UseVisibilityRefreshOptions {
  queryKey: readonly unknown[];
  refetchInterval?: number; // milliseconds (default: 5 min)
  staggerOffset?: number; // milliseconds to stagger initial refetch (default: 0-10s random)
}

/**
 * Smart refetch hook: refetch a query only when the page is visible.
 * Avoids wasting queries on invisible tabs, reduces Supabase IO.
 * 
 * Usage:
 *   useVisibilityRefresh({ queryKey: ['open-raffles'], refetchInterval: 5 * 60_000 });
 */
export function useVisibilityRefresh(options: UseVisibilityRefreshOptions): void {
  const queryClient = useQueryClient();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Page became visible: refetch immediately
        void queryClient.invalidateQueries({ queryKey: options.queryKey });
        startPolling();
      } else {
        // Page hidden: stop polling
        stopPolling();
      }
    };

    const handleFocus = () => {
      // Window regained focus: refetch immediately
      void queryClient.invalidateQueries({ queryKey: options.queryKey });
      startPolling();
    };

    const handleBlur = () => {
      // Window lost focus: stop polling
      stopPolling();
    };

    const startPolling = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);

      // Stagger initial refetch to avoid thundering herd
      // (if many tabs start polling at the same time)
      const stagger = options.staggerOffset ?? Math.random() * 10_000;
      const refetchInterval = options.refetchInterval ?? 5 * 60_000; // default 5 min

      // First refetch after stagger delay
      const timer = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: options.queryKey });

        // Then on the refetch interval
        intervalRef.current = setInterval(() => {
          if (!document.hidden && typeof window !== 'undefined') {
            void queryClient.invalidateQueries({ queryKey: options.queryKey });
          }
        }, refetchInterval);
      }, stagger);

      intervalRef.current = timer as unknown as NodeJS.Timeout;
    };

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    // Start polling immediately if page is visible
    if (!document.hidden) {
      startPolling();
    }

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [queryClient, options]);
}
