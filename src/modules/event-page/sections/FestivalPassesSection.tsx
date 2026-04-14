import { Ticket } from 'lucide-react';
import type { FestivalPass } from '@/modules/event-page/types';

type FestivalPassesSectionProps = {
  passes: FestivalPass[];
};

const passTypeLabelMap: Record<string, string> = {
  full_pass: 'Full Pass',
  party_pass: 'Party Pass',
  day_pass: 'Day Pass',
  vip: 'VIP',
};

export const FestivalPassesSection = ({ passes }: FestivalPassesSectionProps) => {
  if (passes.length === 0) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_35px_rgba(0,0,0,0.28)] backdrop-blur-sm">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Passes</p>
      <div className="mt-2 space-y-3">
        {passes.map((pass) => (
          <div key={pass.id} className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500/10">
              <Ticket className="h-3.5 w-3.5 text-orange-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-white">{pass.name}</p>
                <p className="shrink-0 text-sm font-semibold text-orange-400">
                  {pass.price > 0 ? `€${pass.price}` : 'Free'}
                </p>
              </div>
              <p className="mt-0.5 text-[11px] text-white/40">
                {passTypeLabelMap[pass.type] ?? pass.type}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
