import type { EventPageModel } from '@/modules/event-page/types';

type EventMusicStylesSectionProps = {
  musicStyles: EventPageModel['identity']['musicStyles'];
};

export const EventMusicStylesSection = ({ musicStyles }: EventMusicStylesSectionProps) => {
  if (!musicStyles || musicStyles.length === 0) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_35px_rgba(0,0,0,0.28)] backdrop-blur-sm">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/45 mb-3">Music Styles</p>
      <div className="flex flex-wrap gap-1.5">
        {musicStyles.map((style) => (
          <span
            key={style}
            className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-0.5 text-[11px] font-medium text-orange-300"
          >
            {style}
          </span>
        ))}
      </div>
    </section>
  );
};
