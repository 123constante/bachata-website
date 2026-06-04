import { useState } from 'react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import type { FestivalPromoCode } from '@/modules/event-page/types';
import { formatDiscount } from '@/modules/event-page/promoFormat';

type FestivalPromoBannerProps = {
  codes: FestivalPromoCode[];
};

const FLASH_MS = 850;

/**
 * Inline promo ribbon for the cinematic festival page. Renders the first promo
 * code (meta_data entries carry no featured flag, so first-wins) as a tap-to-copy
 * strip that sits under the hero CTAs. Returns null when there is no code.
 *
 * Styled with Tailwind in the festival palette (Bebas Neue + #fb923c) so the
 * giant FestivalDetail CINEMATIC_CSS string stays untouched.
 */
export const FestivalPromoBanner = ({ codes }: FestivalPromoBannerProps) => {
  const [copied, setCopied] = useState(false);
  const code = codes?.[0];
  if (!code) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code.code);
    } catch {
      toast.error('Could not copy, try long-press');
      return;
    }
    toast.success('Copied!');
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(40);
      }
    } catch {
      /* noop */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), FLASH_MS);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Copy promo code ${code.code}`}
      className="relative mx-auto mt-4 flex w-full max-w-[330px] items-stretch overflow-hidden border border-[#fb923c] bg-[rgba(251,146,60,0.07)] text-left transition active:scale-[0.985] hover:bg-[rgba(251,146,60,0.14)]"
    >
      <span className="flex items-center bg-[#fb923c] px-[9px] font-['Bebas_Neue'] text-[10px] uppercase tracking-[3px] text-black">
        Promo
      </span>
      <span className="flex flex-1 flex-col justify-center px-3 py-2">
        <span className="font-['Bebas_Neue'] text-[24px] leading-none tracking-[1px] text-white">
          {code.code}
        </span>
        <span className="mt-[3px] font-['JetBrains_Mono'] text-[8.5px] uppercase tracking-[0.18em] text-white/50">
          Tap to copy
        </span>
      </span>
      <span className="flex items-center border-l border-dashed border-[#fb923c]/50 px-[14px] font-['Bebas_Neue'] text-[18px] uppercase tracking-[1px] text-[#fb923c]">
        {formatDiscount(code.discountType, code.discountAmount, code.currency)}
      </span>
      {copied && (
        <span className="absolute inset-0 flex items-center justify-center gap-2 bg-[rgba(251,146,60,0.16)] font-['Bebas_Neue'] text-[20px] tracking-[4px] text-[#fb923c]">
          <Check className="h-4 w-4" aria-hidden="true" /> Copied
        </span>
      )}
    </button>
  );
};
