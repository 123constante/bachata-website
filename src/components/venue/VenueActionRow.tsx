import { useCallback, useState } from 'react';
import { Heart, MapPin, Share2, Calendar } from 'lucide-react';
import { useFavouriteVenue } from '@/hooks/useFavouriteVenue';
import { useToast } from '@/hooks/use-toast';

/**
 * VenueActionRow — primary actions for the public venue page.
 *
 *   Directions  → opens venue.google_maps_url (or constructed query)
 *   Save        → server-backed, see useFavouriteVenue
 *   Share       → navigator.share if supported, else copy URL
 *   Events      → scrolls to the upcoming events tile
 *
 * On mobile the buttons inline as a flex row of 2-4 columns. On md+
 * the same row sits to the right of the at-a-glance strip if the
 * parent layout chooses to combine them; this component just renders
 * a horizontal button row and lets the parent compose.
 *
 * Density: every button is py-2 px-3 per the public-site density
 * rules. Icons are w-4 h-4. Labels are text-xs.
 *
 * Plan: plan_venue_page_redesign.md (Phase 2c).
 */
export const VenueActionRow = ({
  venueId,
  venueName,
  mapsUrl,
  upcomingCount,
  onScrollToEvents,
}: {
  venueId: string;
  venueName: string;
  mapsUrl: string | null;
  upcomingCount: number;
  onScrollToEvents?: () => void;
}) => {
  const { toast } = useToast();
  const { isFavourited, isPending, toggle } = useFavouriteVenue(venueId);
  const [shareSpinning, setShareSpinning] = useState(false);

  const handleShare = useCallback(async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        setShareSpinning(true);
        await navigator.share({ title: venueName, url });
      } catch (err) {
        // AbortError on user-cancel is fine; ignore silently.
        if ((err as { name?: string })?.name !== 'AbortError') {
          console.warn('[VenueActionRow] share failed', err);
        }
      } finally {
        setShareSpinning(false);
      }
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        toast({ title: 'Link copied', description: 'Paste it anywhere to share this venue.' });
      } catch {
        toast({
          title: 'Could not copy link',
          description: 'Long-press the address bar to copy manually.',
          variant: 'destructive',
        });
      }
    }
  }, [venueName, toast]);

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3"
      role="group"
      aria-label="Venue actions"
    >
      {mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={ACTION_CLASS}
        >
          <MapPin className="w-4 h-4 flex-shrink-0 text-venue-ember" aria-hidden="true" />
          Directions
        </a>
      )}

      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        className={`${ACTION_CLASS} ${isFavourited ? 'border-venue-rose/40 text-venue-rose' : ''}`}
        aria-pressed={isFavourited}
        aria-label={isFavourited ? 'Remove venue from saved' : 'Save venue to your favourites'}
      >
        <Heart
          className={`w-4 h-4 flex-shrink-0 ${isFavourited ? 'fill-venue-rose text-venue-rose' : 'text-venue-rose'}`}
          aria-hidden="true"
        />
        {isFavourited ? 'Saved' : 'Save'}
      </button>

      <button
        type="button"
        onClick={handleShare}
        disabled={shareSpinning}
        className={ACTION_CLASS}
        aria-label="Share this venue"
      >
        <Share2 className="w-4 h-4 flex-shrink-0 text-venue-brass" aria-hidden="true" />
        Share
      </button>

      {upcomingCount > 0 && (
        <button
          type="button"
          onClick={onScrollToEvents}
          className={ACTION_CLASS}
          aria-label={`View ${upcomingCount} upcoming events at this venue`}
        >
          <Calendar className="w-4 h-4 flex-shrink-0 text-venue-cumin" aria-hidden="true" />
          Events ({upcomingCount})
        </button>
      )}
    </div>
  );
};

const ACTION_CLASS =
  'inline-flex items-center justify-center gap-1.5 rounded-md border border-venue-line bg-venue-surface hover:bg-venue-surface-hi transition-colors px-3 py-2 text-xs font-medium text-venue-cream disabled:opacity-60 disabled:cursor-not-allowed';

export default VenueActionRow;
