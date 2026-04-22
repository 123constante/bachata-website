import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getViewerSession } from '@/lib/viewerSession';

export function useRecordEventView(
  eventId: string | null | undefined,
  source: string = 'public_event_page',
): void {
  useEffect(() => {
    if (!eventId) return;

    const sessionId = getViewerSession();
    if (!sessionId) return;

    // 3s delay filters bounced visits and most automated fetchers that do not
    // execute timers long enough to reach this point.
    const timer = setTimeout(() => {
      void supabase
        .rpc('record_event_view_v1' as any, {
          p_event_id: eventId,
          p_session_id: sessionId,
          p_source: source,
          p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        })
        .then(() => undefined, () => undefined);
    }, 3000);

    return () => clearTimeout(timer);
  }, [eventId, source]);
}
