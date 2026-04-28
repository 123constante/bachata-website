import { BentoTile } from '@/modules/event-page/bento/BentoTile';
import { BLOCK_COLORS, BLOCK_TITLES } from '@/modules/event-page/bento/BentoGrid';
import { useCityCountryCode } from '@/modules/event-page/hooks/useCityCountryCode';

type CityBlockProps = {
  cityId: string | null;
  cityName: string | null;
};

// Top-right 1-col tile that shows the event's city + country flag. Renders
// only when PromoBlock is hidden (they share the same grid slot and are
// mutually exclusive — wired in BentoPage). Tapping it navigates to the
// /cities picker (a lightweight world-map page added separately in 8c-2).
//
// The flag is a real SVG image served from flagcdn.com (allowlisted in our
// CSP under img-src). This replaces the previous regional-indicator emoji
// + Twemoji webfont approach, which silently broke on Windows because the
// polyfill webfont lived on cdn.jsdelivr.net and was not in the production
// CSP's font-src directive — the browser fell through to Segoe UI Emoji,
// which renders the regional-indicator pair as bare letters ("GB"). The
// SVG path is identical on every OS, sharp at any size, and adds no
// third-party CDN dependency to the rest of the app.
export const CityBlock = ({ cityId, cityName }: CityBlockProps) => {
  const { data: countryCode } = useCityCountryCode(cityId);
  const isoLower = countryCode?.trim().toLowerCase();
  const hasFlag = !!isoLower && /^[a-z]{2}$/.test(isoLower);
  // Show the resolved name if we have one; fall back to a neutral label so
  // the slot is never blank while snapshot data is still loading.
  const displayName = (cityName ?? '').trim().toUpperCase() || 'CITY';

  return (
    <BentoTile title={BLOCK_TITLES.city} color={BLOCK_COLORS.city} href="/cities">
      <div className="flex flex-1 flex-col items-center justify-center gap-[6px]">
        {hasFlag && (
          <img
            src={`https://flagcdn.com/${isoLower}.svg`}
            alt=""
            aria-hidden="true"
            width={36}
            height={24}
            loading="lazy"
            className="h-6 w-9 rounded-[2px] object-cover"
          />
        )}
        <div
          className="text-[14px] font-extrabold tracking-[-0.015em]"
          style={{ color: 'hsl(var(--bento-fg))' }}
        >
          {displayName}
        </div>
      </div>
    </BentoTile>
  );
};
