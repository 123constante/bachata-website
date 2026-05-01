import { Beer, Shirt, BadgeCheck, Sparkles } from 'lucide-react';
import { VenueSectionTile } from '../VenueSectionTile';

export const FeaturesSection = ({
  bar,
  cloakroom,
  idRequired,
}: {
  bar: boolean | null | undefined;
  cloakroom: boolean | null | undefined;
  idRequired: boolean | null | undefined;
}) => {
  if (!bar && !cloakroom && !idRequired) return null;
  const Chip = ({ icon: Icon, label }: { icon: typeof Beer; label: string }) => (
    <span className="inline-flex items-center gap-1 rounded-md bg-venue-card-pill border border-venue-card-border px-1.5 py-0.5 text-[10px] font-medium text-venue-card-pill-fg">
      <Icon className="w-3 h-3 text-venue-brass" aria-hidden="true" />
      {label}
    </span>
  );
  return (
    <VenueSectionTile eyebrow="FEATURES" icon={Sparkles}>
      <div className="flex flex-wrap gap-1">
        {bar && <Chip icon={Beer} label="Bar" />}
        {cloakroom && <Chip icon={Shirt} label="Cloakroom" />}
        {idRequired && <Chip icon={BadgeCheck} label="ID required" />}
      </div>
    </VenueSectionTile>
  );
};
export default FeaturesSection;
