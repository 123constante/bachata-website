import { Link } from 'react-router-dom';
import { useCityCountryCode } from '@/modules/event-page/hooks/useCityCountryCode';

/**
 * CityCard — bento-style city tile for the venue page, matching the
 * `LONDON` card on the event page exactly.
 *
 * Same visual idiom as `CityBlock` (event page):
 *   - Black/forest bento surface, brass-tinted hairline border
 *   - SVG flag from flagcdn.com (CSP-allowlisted)
 *   - Uppercase city name in aged-cream extrabold
 *   - Tap target → /cities directory
 *
 * Decided 2026-04-30 (Ricky): the address row shows the address text on
 * the left and this small bento-style card on the right (matches the
 * previous CityBlock screenshot from the event page). NOT a thin pill.
 *
 * Sized for inline placement next to address text — narrower than a
 * full bento grid tile but immediately recognisable as the same style.
 */
export const CityCard = ({
  cityId,
  cityName,
}: {
  cityId: string | null | undefined;
  cityName: string | null | undefined;
}) => {
  const { data: countryCode } = useCityCountryCode(cityId ?? null);
  const isoLower = countryCode?.trim().toLowerCase();
  const hasFlag = !!isoLower && /^[a-z]{2}$/.test(isoLower);
  const displayName = (cityName ?? '').trim().toUpperCase() || 'CITY';

  return (
    <Link
      to="/cities"
      aria-label={`View ${cityName ?? 'city'} city directory`}
      className="inline-flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-[color:var(--bento-hairline)] bg-bento-surface px-3 py-2 min-h-[44px] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),_0_4px_10px_rgba(0,0,0,0.45)] transition-transform duration-150 ease-out active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 min-w-[80px]"
    >
      {hasFlag && (
        <img
          src={`https://flagcdn.com/${isoLower}.svg`}
          alt=""
          aria-hidden="true"
          width={36}
          height={24}
          loading="lazy"
          className="h-5 w-8 rounded-[2px] object-cover"
        />
      )}
      <span
        className="text-[12px] font-extrabold tracking-[-0.015em]"
        style={{ color: 'hsl(var(--bento-fg))' }}
      >
        {displayName}
      </span>
    </Link>
  );
};

export default CityCard;
