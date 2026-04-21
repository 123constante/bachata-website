import type { EventPageModel } from '@/modules/event-page/types';

type EventDescriptionSectionProps = {
  description: EventPageModel['description'];
};

export const EventDescriptionSection = ({ description }: EventDescriptionSectionProps) => {
  if (!description.isVisible || !description.body) return null;

  const paragraphs = description.body
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return null;

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] px-5 py-4">
      {paragraphs.map((para, i) => (
        <p
          key={i}
          className={
            'whitespace-pre-wrap text-[14px] leading-[1.6] text-white/90' +
            (i < paragraphs.length - 1 ? ' mb-3' : '')
          }
        >
          {para}
        </p>
      ))}
    </section>
  );
};
