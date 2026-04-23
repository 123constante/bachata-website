import { useCallback, useState } from 'react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { BentoTile } from '@/modules/event-page/bento/BentoTile';
import { BLOCK_COLORS, BLOCK_TITLES } from '@/modules/event-page/bento/BentoGrid';
import type { EventPagePromoCode } from '@/modules/event-page/types';

type PromoBlockProps = {
  codes: EventPagePromoCode[];
};

const formatDiscount = (code: EventPagePromoCode): string => {
  if (code.discount_type === 'percent') return `${code.discount_amount}% off`;
  return `£${code.discount_amount} off`;
};

const TICK_DURATION_MS = 800;

const useCopyCode = () => {
  // Tracks which code id is currently showing its tick flash. A single id is
  // sufficient because taps are serial on mobile.
  const [flashingId, setFlashingId] = useState<string | null>(null);

  const copy = useCallback(async (code: EventPagePromoCode) => {
    try {
      await navigator.clipboard.writeText(code.code);
    } catch {
      toast.error("Couldn't copy — try long-press");
      return;
    }
    toast.success('Copied!');
    // iOS Safari often ignores vibrate; Android honours it. Try/catch keeps
    // the interaction working on browsers that throw on the API.
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(50);
      }
    } catch {
      /* noop */
    }
    setFlashingId(code.id);
    window.setTimeout(() => {
      setFlashingId((current) => (current === code.id ? null : current));
    }, TICK_DURATION_MS);
  }, []);

  return { flashingId, copy };
};

export const PromoBlock = ({ codes }: PromoBlockProps) => {
  const { flashingId, copy } = useCopyCode();
  if (!codes || codes.length === 0) return null;

  return (
    <BentoTile title={BLOCK_TITLES.promo} color={BLOCK_COLORS.promo}>
      <div
        className="flex min-h-0 flex-1 flex-col gap-[6px] overflow-y-auto"
        style={{ scrollbarWidth: 'thin' }}
      >
        {codes.map((code) => {
          const flashing = flashingId === code.id;
          return (
            <button
              key={code.id}
              type="button"
              onClick={() => copy(code)}
              className="flex min-w-0 items-center justify-between gap-2 rounded-[10px] border border-white/25 bg-black/15 px-2 py-[6px] text-left text-white transition active:scale-[0.98]"
              aria-label={`Copy promo code ${code.code}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-[6px]">
                  <span className="truncate text-[15px] font-extrabold tracking-[-0.02em]">
                    {code.code}
                  </span>
                  {flashing && (
                    <Check
                      className="h-3 w-3 shrink-0 text-white"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <div className="text-[10px] text-white/85">{formatDiscount(code)}</div>
              </div>
            </button>
          );
        })}
      </div>
    </BentoTile>
  );
};
