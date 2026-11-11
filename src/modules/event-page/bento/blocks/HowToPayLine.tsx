import { howToPayText } from '@/lib/paymentMethods';

/**
 * One compact "How to pay" line for the regular (bento) event page. Renders
 * nothing when no known payment method is stored. The caller decides whether
 * the night is still bookable (hidden on past / cancelled).
 */
export const HowToPayLine = ({ stored }: { stored: string | null | undefined }) => {
  const text = howToPayText(stored);
  if (!text) return null;
  return (
    <p className="mt-3 flex flex-wrap items-baseline gap-x-2 px-1 text-sm" data-testid="how-to-pay">
      <span className="font-semibold">How to pay</span>
      <span className="opacity-90">{text}</span>
    </p>
  );
};
