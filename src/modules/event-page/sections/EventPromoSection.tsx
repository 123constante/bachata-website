import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { EventPageModel } from '@/modules/event-page/types';

type EventPromoSectionProps = {
  promoCodes: EventPageModel['promoCodes'];
};

const formatDiscount = (type: 'percent' | 'fixed', amount: number): string => {
  if (type === 'percent') return `${amount}% off`;
  return `£${amount} off`;
};

export const EventPromoSection = ({ promoCodes }: EventPromoSectionProps) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!promoCodes.isVisible) return null;

  const handleCopy = async (code: string, id: string) => {
    if (!navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // clipboard write failed silently
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_35px_rgba(0,0,0,0.28)] backdrop-blur-sm">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Promo Codes</p>
      <div className="mt-2 space-y-3">
        {promoCodes.items.map((promo) => {
          const copied = copiedId === promo.id;
          return (
            <div
              key={promo.id}
              className="flex cursor-pointer items-start gap-3 rounded-xl p-2 -mx-2 transition-colors hover:bg-white/5 active:bg-white/10"
              onClick={() => handleCopy(promo.code, promo.id)}
              title="Click to copy"
            >
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500/10">
                {copied
                  ? <Check className="h-3.5 w-3.5 text-green-400" />
                  : <Copy className="h-3.5 w-3.5 text-orange-400" />
                }
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-mono text-sm font-bold tracking-wide text-white">{promo.code}</p>
                  <p className="shrink-0 text-sm font-semibold text-orange-400">
                    {formatDiscount(promo.discount_type, promo.discount_amount)}
                  </p>
                </div>
                {promo.valid_until && (
                  <p className="mt-0.5 text-[11px] text-white/40">Valid until {promo.valid_until}</p>
                )}
                <p className="mt-0.5 text-[10px] text-white/30">{copied ? 'Copied!' : 'Tap to copy'}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
