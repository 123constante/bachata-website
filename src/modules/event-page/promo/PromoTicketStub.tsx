import type { CSSProperties } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PROMO_CONFETTI,
  PROMO_TONES,
  type PromoTone,
} from '@/modules/event-page/promo/promoTone';
import { useCopyCode } from '@/modules/event-page/promo/useCopyCode';
import '@/modules/event-page/promo/promoStub.css';

/**
 * Ticket-stub promo code -- claude.ai/design "Bachata promo code
 * interactions", option 1b.
 *
 * Tap the card and the perforated COPY stub tears off and flies away, confetti
 * scatters from the seam, and the panel flips to a copied state with a single
 * shine sweep. One component for every promo surface; the host picks a tone,
 * a layout and a density, and paints nothing itself.
 *
 * The torn/tearing branches below are CONDITIONALLY RENDERED, never toggled
 * with opacity. React mounting and unmounting them is what restarts each CSS
 * animation on every copy -- the same behaviour the design canvas got from
 * sc-if. Toggling visibility instead makes the second tap inert.
 */
type PromoTicketStubProps = {
  code: string;
  /** Output of formatDiscount() -- e.g. "20% off", "GBP 25 off". */
  discountLabel: string;
  tone: PromoTone;
  /** stub-right is the design 1:1; stub-bottom stacks it for square hosts. */
  layout?: 'stub-right' | 'stub-bottom';
  /** compact shrinks type and drops the hint for the 1x1 bento tile. */
  density?: 'default' | 'compact';
  className?: string;
};

// Particle field lifted from the design: 14 pieces fanned across a 205deg arc
// from -150deg, radius 62-116px, staggered 0-140ms. Deterministic, so it is
// computed once at module scope rather than per render.
const CONFETTI = Array.from({ length: 14 }, (_, i) => {
  const angle = ((-150 + (i * 205) / 14) * Math.PI) / 180;
  const radius = 62 + ((i * 41) % 54);
  return {
    w: 4 + (i % 3),
    h: 6 + (i % 4) * 3,
    tx: Math.round(Math.cos(angle) * radius),
    ty: Math.round(Math.sin(angle) * radius - 18),
    rot: (i % 2 ? 1 : -1) * (130 + ((i * 47) % 200)),
    delay: ((i % 5) * 0.035).toFixed(3),
  };
});

export const PromoTicketStub = ({
  code,
  discountLabel,
  tone,
  layout = 'stub-right',
  density = 'default',
  className,
}: PromoTicketStubProps) => {
  const { phase, copy } = useCopyCode(code);
  const torn = phase === 'torn';
  const compact = density === 'compact';
  const confettiColours = PROMO_CONFETTI[tone];

  return (
    <span
      className={cn('promo-stub-wrap', className)}
      data-layout={layout}
      data-density={density}
      style={PROMO_TONES[tone] as unknown as CSSProperties}
    >
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy promo code ${code}`}
        className="promo-stub"
        data-layout={layout}
        data-phase={phase}
        data-density={density}
      >
        <span className="ps-body">
          <span className="ps-eyebrow">{discountLabel}</span>
          <span className="ps-code">
            {torn && <Check className="ps-check" aria-hidden="true" />}
            {code}
          </span>
          {!compact && (
            <span className="ps-hint">
              {torn ? 'Paste it at checkout' : 'Tap to tear off & copy'}
            </span>
          )}
          {torn && <span className="ps-shine" aria-hidden="true" />}
        </span>

        <span className="ps-perf" aria-hidden="true" />

        {!torn && (
          <span className="ps-stub" aria-hidden="true">
            <Copy className="ps-stub-icon" />
            <span>COPY</span>
          </span>
        )}
        {torn && (
          <span className="ps-done" aria-hidden="true">
            {compact ? (
              'COPIED'
            ) : (
              <>
                IN YOUR
                <br />
                CLIPBOARD
              </>
            )}
          </span>
        )}

        <span className="ps-notch ps-notch-a" aria-hidden="true" />
        <span className="ps-notch ps-notch-b" aria-hidden="true" />
      </button>

      {/* Every visual confirmation above -- the check, the IN YOUR CLIPBOARD
          panel, the shine -- is aria-hidden or purely decorative, and compact
          density has no confirming text at all. This is the only signal a
          screen reader gets, which is why it sits outside the button rather
          than inside its aria-hidden ornamentation. */}
      <span className="sr-only" aria-live="polite">
        {torn ? `${code} copied to clipboard` : ''}
      </span>

      {torn && (
        <span className="ps-confetti" aria-hidden="true">
          {CONFETTI.map((p, i) => (
            <span
              key={i}
              className="ps-conf"
              style={
                {
                  width: `${p.w}px`,
                  height: `${p.h}px`,
                  background: confettiColours[i % confettiColours.length],
                  animationDelay: `${p.delay}s`,
                  '--tx': `${p.tx}px`,
                  '--ty': `${p.ty}px`,
                  '--rot': `${p.rot}deg`,
                } as unknown as CSSProperties
              }
            />
          ))}
        </span>
      )}
    </span>
  );
};
