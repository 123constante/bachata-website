import type { EventPageModel } from '@/modules/event-page/types';

type EventInfoSectionProps = {
  eventInfo: EventPageModel['eventInfo'];
};

const chipClass =
  'inline-flex items-center gap-[5px] rounded-full border-[0.5px] border-black/10 bg-white px-[10px] py-[6px]';

const Chip = ({ emoji, value }: { emoji: string; value: string }) => (
  <span className={chipClass}>
    <span className="text-[13px] leading-none" aria-hidden>{emoji}</span>
    <span className="text-[12px] text-black/85">{value}</span>
  </span>
);

export const EventInfoSection = ({ eventInfo }: EventInfoSectionProps) => {
  const { dressCode, ageRestriction, paymentMethods } = eventInfo;

  if (!dressCode && !ageRestriction && !paymentMethods) return null;

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <div className="flex flex-wrap gap-[6px]">
        {dressCode && <Chip emoji="👔" value={dressCode} />}
        {ageRestriction && <Chip emoji="🔞" value={ageRestriction} />}
        {paymentMethods && <Chip emoji="💳" value={paymentMethods} />}
      </div>
    </section>
  );
};
