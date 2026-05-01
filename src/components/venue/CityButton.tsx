import { Link } from 'react-router-dom';
import { useCityCountryCode } from '@/modules/event-page/hooks/useCityCountryCode';

/**
 * CityButton — small pill matching the event-page CityBlock idiom.
 * Flag from flagcdn.com (per the same hook used on the event page),
 * city name in caps, links to /cities (the directory).
 *
 * Decided 2026-04-30 (Ricky): the venue address line is paired with
 * a city button so dancers can jump from this venue to the city
 * directory in one tap, same UX as the event page.
 */
export const CityButton = ({
  cityId,
  cityName,
}: {
  cityId: string | null | undefined;
  cityName: string | null | undefined;
}) => {
  const { data: isoLower } = useCityCountryCode(cityId ?? null);
  if (!cityName) return null;

  return (
    <Link
      to="/cities"
      className="inline-flex items-center gap-1.5 rounded-full border border-venue-line bg-venue-surface hover:bg-venue-surface-hi transition-colors px-2 py-1 text-xs font-bold uppercase tracking-wide text-venue-cream whitespace-nowrap"
      aria-label={`View ${cityName} city directory`}
    >
      {isoLower && (
        <img
          src={`https://flagcdn.com/${isoLower}.svg`}
          alt=""
          className="w-4 h-3 object-cover rounded-sm flex-shrink-0"
          aria-hidden="true"
          loading="lazy"
        />
      )}
      <span>{cityName}</span>
    </Link>
  );
};

export default CityButton;
