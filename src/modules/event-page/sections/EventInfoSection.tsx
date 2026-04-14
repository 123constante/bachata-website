import type { EventPageModel } from '@/modules/event-page/types';

type EventInfoSectionProps = {
  eventInfo: EventPageModel['eventInfo'];
};

export const EventInfoSection = ({ eventInfo }: EventInfoSectionProps) => {
  if (!eventInfo.isVisible) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_35px_rgba(0,0,0,0.28)] backdrop-blur-sm">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Event Info</p>
      <div className="mt-2 space-y-1.5 text-sm text-white/80">
        {eventInfo.dressCode && (
          <p>
            <span className="text-white/50">Dress code: </span>
            {eventInfo.dressCode}
          </p>
        )}
        {eventInfo.ageRestriction && (
          <p>
            <span className="text-white/50">Age: </span>
            {eventInfo.ageRestriction}
          </p>
        )}
        {eventInfo.paymentMethods && (
          <p>
            <span className="text-white/50">Payment: </span>
            {eventInfo.paymentMethods}
          </p>
        )}
      </div>
    </section>
  );
};
