import type { FestivalPromoCode } from '@/modules/event-page/types';
import { formatDiscount } from '@/modules/event-page/promoFormat';
import { PromoTicketStub } from '@/modules/event-page/promo/PromoTicketStub';

type FestivalPromoBannerProps = {
  codes: FestivalPromoCode[];
};

/**
 * Promo slot on the cinematic festival page, under the hero CTAs.
 *
 * Since 2026-07-30 this is a thin adapter over PromoTicketStub (design 1b) --
 * it maps the camelCase FestivalPromoCode shape onto the shared component and
 * owns nothing else. The file and its export name are kept so the 2400-line
 * FestivalDetail.tsx needs no edit.
 *
 * meta_data entries carry no featured flag, so first-wins. Returns null when
 * there is no code.
 */
export const FestivalPromoBanner = ({ codes }: FestivalPromoBannerProps) => {
  const code = codes?.[0];
  if (!code) return null;

  // First-wins is deliberate, but a dropped second code should be visible in
  // development rather than silently absent.
  if (import.meta.env.DEV && codes.length > 1) {
    console.warn(
      `[FestivalPromoBanner] festival has ${codes.length} promo codes; only the first (${code.code}) is rendered.`,
    );
  }

  return (
    <PromoTicketStub
      className="mx-auto mt-4 max-w-[330px]"
      code={code.code}
      discountLabel={formatDiscount(code.discountType, code.discountAmount, code.currency)}
      tone="festival"
    />
  );
};
