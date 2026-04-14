import type { EventPageModel } from '@/modules/event-page/types';

type EventDescriptionSectionProps = {
  description: EventPageModel['description'];
};

export const EventDescriptionSection = ({ description }: EventDescriptionSectionProps) => {
  if (!description.isVisible || !description.body) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_35px_rgba(0,0,0,0.28)] backdrop-blur-sm">
      <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/45">Description</p>
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm leading-relaxed text-white/80">
        <p className="whitespace-pre-wrap">{description.body}</p>
      </div>
    </section>
  );
};
