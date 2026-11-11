import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPublicTicketTypes, publicTicketKeys, quietBarButton, siteBarState, type SiteBarState } from '@/modules/tickets/ticketCheckoutApi';

/**
 * TICKET_LEAD_IN_SITE probe. Lazy-loaded by EventStickyActionBar so the tickets module and
 * its wire stay out of the event page's first-load graph (chunk ratchet). Renders nothing;
 * reports whether the night on screen sells in-site. Same query key (series + night) as the
 * buy block: one fetch, and the bar and the block read the same v2 rows (S1a).
 */
export default function InSiteTicketProbe({ seriesId, occurrenceId, onResult }: { seriesId: string; occurrenceId: string | null; onResult: (seriesId: string, occurrenceId: string | null, state: SiteBarState, quietLabel: string) => void }) {
  const { data: types, isPending } = useQuery({
    queryKey: publicTicketKeys.types(seriesId, occurrenceId),
    queryFn: () => fetchPublicTicketTypes(seriesId, occurrenceId),
    staleTime: 30_000,
  });
  const state = siteBarState(types);
  const label = state === 'quiet' && types ? quietBarButton(types) : '';
  // Silent while the fetch is in flight: the bar shows a neutral placeholder, not her link, until this resolves.
  // The answer names its night, so the bar can tell a stale answer from this night's, and a
  // switch to a cached night with the same state still reports (the night is a dependency).
  useEffect(() => {
    if (!isPending) onResult(seriesId, occurrenceId, state, label);
  }, [isPending, seriesId, occurrenceId, state, label, onResult]);
  return null;
}
