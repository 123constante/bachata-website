import { BentoTile } from '@/modules/event-page/bento/BentoTile';
import { BLOCK_COLORS } from '@/modules/event-page/bento/BentoGrid';
import type { EventPagePromoCode } from '@/modules/event-page/types';
import { formatDiscount } from '@/modules/event-page/promoFormat';
import { PromoTicketStub } from '@/modules/event-page/promo/PromoTicketStub';

type PromoBlockProps = {
  codes: EventPagePromoCode[];
};

/**
 * Promo tile on the event bento page -- design 1b, compact.
 *
 * The slot is 1 grid cell (LAYOUT: minW 1, preferredW 1, minH 1) -- 93px square
 * on a 390px viewport. The stub runs stub-bottom + compact: same perforation,
 * tear, confetti and copied state, with a 22px bar instead of a 92px side stub.
 *
 * The tile title is deliberately empty. BentoTile renders the strip ABOVE the
 * card, and at this size it cost ~32px of the 73px available -- enough that the
 * code overflowed its own body and got clipped. The date, city and venue tiles
 * already omit their titles for the same reason; the stub says PROMO itself via
 * the discount eyebrow and the COPY bar.
 *
 * Renders the first code only. Live data has never carried more than one:
 * across every event with promo codes the maximum array length is 1.
 *
 * Still a multi-target tile -- the outer card does not navigate, the stub owns
 * its own tap.
 */
export const PromoBlock = ({ codes }: PromoBlockProps) => {
  const code = codes?.[0];
  if (!code) return null;

  // Rendering only the first code is deliberate, but it must not be silent:
  // if an organiser ever adds a second one it would otherwise just vanish.
  if (import.meta.env.DEV && codes.length > 1) {
    console.warn(
      `[PromoBlock] event has ${codes.length} promo codes; only the first (${code.code}) is rendered.`,
    );
  }

  return (
    <BentoTile title="" color={BLOCK_COLORS.promo} mode="multi-target">
      <PromoTicketStub
        className="min-h-0 flex-1"
        code={code.code}
        discountLabel={formatDiscount(code.discount_type, code.discount_amount, code.currency)}
        tone="bento"
        layout="stub-bottom"
        density="compact"
      />
    </BentoTile>
  );
};
