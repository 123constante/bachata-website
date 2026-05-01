import { Info } from 'lucide-react';
import { VenueSectionTile } from '../VenueSectionTile';

type FaqItem = { q?: string | null; a?: string | null };

export const FaqSection = ({ items }: { items: FaqItem[] | null | undefined }) => {
  const filtered = Array.isArray(items) ? items.filter((f) => f && (f.q || f.a)) : [];
  if (filtered.length === 0) return null;
  return (
    <VenueSectionTile eyebrow="FAQ" icon={Info} wide>
      <dl className="flex flex-col gap-2">
        {filtered.map((item, i) => (
          <div key={i}>
            {item.q && (
              <dt className="text-sm font-semibold text-venue-card-fg">{item.q}</dt>
            )}
            {item.a && (
              <dd className="text-xs text-venue-card-mut leading-relaxed">{item.a}</dd>
            )}
          </div>
        ))}
      </dl>
    </VenueSectionTile>
  );
};
export default FaqSection;
