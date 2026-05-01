import { AlertCircle } from 'lucide-react';
import { VenueSectionTile } from '../VenueSectionTile';

export const RulesSection = ({ rules }: { rules: string[] | null | undefined }) => {
  if (!rules || rules.length === 0) return null;
  return (
    <VenueSectionTile eyebrow="RULES" icon={AlertCircle} wide={rules.length > 3}>
      <div className="flex flex-wrap gap-1">
        {rules.map((rule, i) => (
          <span
            key={i}
            className="inline-flex items-center rounded-md border border-venue-rose/40 bg-venue-rose/10 px-1.5 py-0.5 text-[10px] font-semibold text-venue-rose"
          >
            {rule}
          </span>
        ))}
      </div>
    </VenueSectionTile>
  );
};
export default RulesSection;
