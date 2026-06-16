import { Link } from 'react-router-dom';
import { useCity } from '@/contexts/CityContext';
import { buildCityPath } from '@/lib/cityPath';

type MusicStylesRowProps = {
  musicStyles: string[];
};

export const MusicStylesRow = ({ musicStyles }: MusicStylesRowProps) => {
  const { citySlug } = useCity();
  if (!musicStyles || musicStyles.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {musicStyles.map((style) => {
        // Slugify for visible display only ("#salsa", "#cuban-style").
        // The link target uses the original display string so search ILIKE
        // matches "Cuban Style" rather than "cuban-style".
        const slug = style.trim().toLowerCase().replace(/\s+/g, '-');
        const to = `${buildCityPath(citySlug, 'search')}?q=${encodeURIComponent(style)}`;
        return (
          <Link
            key={slug}
            to={to}
            className="rounded-full px-3 py-[6px] text-[12px] font-medium transition active:scale-[0.97]"
            style={{
              background: 'hsl(var(--bento-surface))',
              border: '1px solid var(--bento-hairline)',
              color: 'hsl(var(--bento-fg-muted))',
            }}
          >
            <span style={{ color: 'hsl(var(--bento-accent))' }}>#</span>{slug}
          </Link>
        );
      })}
    </div>
  );
};
