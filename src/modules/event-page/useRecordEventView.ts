import { useEffect } from 'react';
import { getViewerSession } from '@/lib/viewerSession';
import { flags } from '@/lib/featureFlags';

export function useRecordEventView(
  eventId: string | null | undefined,
  source: string = 'public_event_page',
  occurrenceId?: string | null,
): void {
  useEffect(() => {
    // Event view tracking is disabled during Phase 1 IO optimization.
    // Re-enable once analytics are moved to external storage (Phase 2).
    if (!flags.enableEventTracking) return;

    if (!eventId) return;

    // Skip automated/headless agents. The build-time prerenderer (Playwright /
    // Puppeteer set navigator.webdriver) holds event pages open well past the 3s
    // timer, which would otherwise log ~one fake view per prerendered page nightly.
    if (typeof navigator !== 'undefined' && navigator.webdriver) return;

    const sessionId = getViewerSession();
    if (!sessionId) return;

    // 3s delay filters bounced visits and most automated fetchers that do not
    // execute timers long enough to reach this point.
    const timer = setTimeout(() => {
      // Phase 2: POST to /api/analytics/event-view instead of Supabase RPC.
      // Fire-and-forget; errors are swallowed (telemetry must never block).
      void fetch('/api/analytics/event-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          source,
          occurrenceId: occurrenceId ?? null,
          sessionId,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        }),
      }).catch(() => {
        // Fail silently — telemetry errors must never reach the console
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, [eventId, source, occurrenceId]);
}
