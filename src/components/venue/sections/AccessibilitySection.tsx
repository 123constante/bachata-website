import { Accessibility } from 'lucide-react';
import { VenueSectionTile } from '../VenueSectionTile';

export const AccessibilitySection = ({ text }: { text: string | null | undefined }) => {
  if (!text) return null;
  return (
    <VenueSectionTile eyebrow="ACCESSIBILITY" icon={Accessibility}>
      <p className="text-xs leading-relaxed text-venue-card-fg">{text}</p>
    </VenueSectionTile>
  );
};
export default AccessibilitySection;
