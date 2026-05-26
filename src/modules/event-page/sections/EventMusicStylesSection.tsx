import { Link } from 'react-router-dom';
import type { EventPageModel } from '@/modules/event-page/types';
import { useCity } from '@/contexts/CityContext';
import { buildCityPath } from '@/lib/cityPath';

type EventMusicStylesSectionProps = {
  musicStyles: EventPageModel['identity']['musicStyles'];
};

export const EventMusicStylesSection = ({ musicStyles }: EventMusicStylesSectionProps) => {
  const { citySlug } = useCity();
  if (!musicStyles || musicStyles.length === 0) return null;

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <div className="flex flex-wrap gap-[6px]">
        {musicStyles.map((style) => {
          const to = `${buildCityPath(citySlug, 'search')}?q=${encodeURIComponent(style)}`;
          return (
            <Link
              key={style}
              to={to}
              className="rounded-full px-3 py-[6px] text-[12px] font-medium transition hover:brightness-110"
              style={{
                backgroundColor: '#FAEEDA',
                border: '0.5px solid #FFA500',
                color: '#4A1B0C',
              }}
            >
              {style}
            </Link>
          );
        })}
      </div>
    </section>
  );
};
