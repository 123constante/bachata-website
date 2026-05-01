import { Info } from 'lucide-react';
import { VenueSectionTile } from '../VenueSectionTile';

export const AboutSection = ({ description }: { description: string | null | undefined }) => {
  if (!description) return null;
  return (
    <VenueSectionTile eyebrow="ABOUT" icon={Info} wide>
      <p className="text-sm leading-relaxed text-venue-card-fg">{description}</p>
    </VenueSectionTile>
  );
};
export default AboutSection;
