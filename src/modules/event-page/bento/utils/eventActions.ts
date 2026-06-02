import { recordEventLinkClick } from '@/lib/eventLinkClicks';
import { toast } from '@/hooks/use-toast';
import type { EventPageModel } from '@/modules/event-page/types';

type Loc = EventPageModel['location'];

/**
 * Resolve a maps target for the venue, for the "Get directions" CTA.
 *
 * Prefers the venue's stored Google Maps link (set in admin); otherwise builds
 * a Google Maps directions URL from the address parts. Returns null when there
 * is nothing to navigate to, so the caller can hide the button entirely.
 */
export function buildDirectionsUrl(location: Loc): string | null {
  const stored = location.googleMapsLink?.trim();
  if (stored) return stored;

  const query = [location.venueName, location.address, location.postcode, location.cityName]
    .filter((s): s is string => Boolean(s && s.trim()))
    .join(', ');
  if (!query) return null;

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
}

type ShareArgs = {
  eventId: string | null;
  title: string;
  subtitle: string | null;
  /** Telemetry source prefix, e.g. 'bento_action_bar'. */
  source: string;
};

/**
 * Share the current event URL. Native share sheet first, then clipboard copy,
 * then a WhatsApp deep-link fallback. Mirrors the classic EventActionBar share
 * behaviour so telemetry and UX stay consistent across surfaces.
 */
export async function shareEvent({ eventId, title, subtitle, source }: ShareArgs): Promise<void> {
  const url = window.location.href;
  const text = [title, subtitle, url].filter(Boolean).join('\n');

  if (navigator.share) {
    try {
      await navigator.share({ title, text: subtitle ?? undefined, url });
      recordEventLinkClick({ eventId, linkType: 'share', targetUrl: url, source: `${source}:web_share` });
      return;
    } catch {
      // User cancelled or share failed -- fall through to clipboard.
    }
  }

  if (navigator?.clipboard) {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copied to clipboard' });
      recordEventLinkClick({ eventId, linkType: 'share', targetUrl: url, source: `${source}:clipboard` });
      return;
    } catch {
      // Fall through to WhatsApp.
    }
  }

  const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
  recordEventLinkClick({ eventId, linkType: 'whatsapp', targetUrl: waUrl, source: `${source}:share_fallback` });
  window.open(waUrl, '_blank', 'noopener,noreferrer');
}
