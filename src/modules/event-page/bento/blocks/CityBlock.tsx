import { BentoTile } from '@/modules/event-page/bento/BentoTile';
import { BLOCK_COLORS, BLOCK_TITLES } from '@/modules/event-page/bento/BentoGrid';
import { useCityCountryCode } from '@/modules/event-page/hooks/useCityCountryCode';
import { iso2ToFlagEmoji } from '@/modules/event-page/bento/utils/flagEmoji';

type CityBlockProps = {
  cityId: string | null;
  cityName: string | null;
};

// Top-right 1-col tile that shows the event's city + country flag. Renders
// only when PromoBlock is hidden (they share the same grid slot and are
// mutually exclusive — wired in BentoPage). Tapping it navigates to the
// /cities picker (a lightweight world-map page added separately in 8c-2).
export const CityBlock = ({ cityId, cityName }: CityBlockProps) => {
  const { data: countryCode } = useCityCountryCode(cityId);
  const flag = iso2ToFlagEmoji(countryCode);
  // Show the resolved name if we have one; fall back to a neutral label so
  // the slot is never blank while snapshot data is still loading.
  const displayName = (cityName ?? '').trim().toUpperCase() || 'CITY';

  return (
    <BentoTile title={BLOCK_TITLES.city} color={BLOCK_COLORS.city} href="/cities">
      <div className="flex flex-1 flex-col items-center justify-center gap-[6px]">
        {flag && (
          // font-family opts this element into the Twemoji Country Flags
          // polyfill (see index.css) so the regional-indicator sequence
          // renders as an actual flag on Windows too, not as bare letters.
          <div
            className="text-[32px] leading-none"
            aria-hidden="true"
            style={{
              fontFamily: '"Twemoji Country Flags", "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
            }}
          >
            {flag}
          </div>
        )}
        <div className="text-[14px] font-extrabold tracking-[-0.015em] text-white">
          {displayName}
        </div>
      </div>
    </BentoTile>
  );
};
