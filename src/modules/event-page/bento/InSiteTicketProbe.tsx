import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPublicTicketTypes, publicTicketKeys, sellsInSite } from '@/modules/tickets/ticketCheckoutApi';

/**
 * TICKET_LEAD_IN_SITE probe. Lazy-loaded by EventStickyActionBar so the tickets module and
 * its wire stay out of the event page's first-load graph (chunk ratchet). Renders nothing;
 * reports whether the series sells in-site. Same query key as the buy block: one fetch.
 */
export default function InSiteTicketProbe({ seriesId, onResult }: { seriesId: string; onResult: (sells: boolean) => void }) {
  const { data: types } = useQuery({
    queryKey: publicTicketKeys.types(seriesId),
    queryFn: () => fetchPublicTicketTypes(seriesId),
    staleTime: 30_000,
  });
  const sells = sellsInSite(types);
  useEffect(() => onResult(sells), [sells, onResult]);
  return null;
}
