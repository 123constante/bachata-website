import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPublicTicketTypes, publicTicketKeys, quietBarButton, siteBarState, type SiteBarState } from '@/modules/tickets/ticketCheckoutApi';

/**
 * TICKET_LEAD_IN_SITE probe. Lazy-loaded by EventStickyActionBar so the tickets module and
 * its wire stay out of the event page's first-load graph (chunk ratchet). Renders nothing;
 * reports whether the night on screen sells in-site. Same query key (series + night) as the
 * buy block: one fetch, and the bar and the block read the same v2 rows (S1a).
 */
export default function InSiteTicketProbe({ seriesId, occurrenceId, onResult }: { seriesId: string; occurrenceId: string | null; onResult: (state: SiteBarState, quietLabel: string) => void }) {
  const { data: types } = useQuery({
    queryKey: publicTicketKeys.types(seriesId, occurrenceId),
    queryFn: () => fetchPublicTicketTypes(seriesId, occurrenceId),
    staleTime: 30_000,
  });
  const state = siteBarState(types);
  const label = state === 'quiet' && types ? quietBarButton(types) : '';
  useEffect(() => onResult(state, label), [state, label, onResult]);
  return null;
}
