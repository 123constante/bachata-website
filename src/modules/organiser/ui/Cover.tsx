import { Camera, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CoverProps {
  src?: string | null;
  alt: string;
  /** Opens the cover picker. Without it no change button is drawn. */
  onChange?: () => void;
  changeLabel?: string;
  emptyLabel?: string;
  testId?: string;
  className?: string;
}

/**
 * Square cover, radius 20, 78% wide and centred, with a round 44px cream
 * change button overlapping the bottom-right corner (3px page-colour ring).
 */
export function Cover({ src, alt, onChange, changeLabel = 'Change cover', emptyLabel = 'No cover yet', testId, className }: CoverProps) {
  return (
    <div data-testid={testId} className={cn('relative mx-auto aspect-square w-[78%]', className)}>
      <div className="h-full w-full overflow-hidden rounded-[20px] border border-[var(--line)] bg-[var(--card2)]">
        {src ? (
          <img src={src} alt={alt} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[var(--mut)]">
            <ImageIcon aria-hidden="true" className="h-8 w-8" />
            <span className="text-[14px]">{emptyLabel}</span>
          </div>
        )}
      </div>
      {onChange && (
        <button
          type="button"
          onClick={onChange}
          aria-label={changeLabel}
          data-testid={testId ? `${testId}-change` : undefined}
          className="absolute -bottom-2 -right-2 flex h-[44px] w-[44px] items-center justify-center rounded-full bg-[var(--btn)] text-[var(--btnfg)] ring-[3px] ring-[var(--bg)]"
        >
          <Camera aria-hidden="true" className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
