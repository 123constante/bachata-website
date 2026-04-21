import type { EventPageModel } from '@/modules/event-page/types';

type EventMusicStylesSectionProps = {
  musicStyles: EventPageModel['identity']['musicStyles'];
};

export const EventMusicStylesSection = ({ musicStyles }: EventMusicStylesSectionProps) => {
  if (!musicStyles || musicStyles.length === 0) return null;

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <div className="flex flex-wrap gap-[6px]">
        {musicStyles.map((style) => (
          <span
            key={style}
            className="rounded-full px-3 py-[6px] text-[12px] font-medium"
            style={{
              backgroundColor: '#FAEEDA',
              border: '0.5px solid #FFA500',
              color: '#4A1B0C',
            }}
          >
            {style}
          </span>
        ))}
      </div>
    </section>
  );
};
