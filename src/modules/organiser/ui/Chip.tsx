import type { ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChipProps {
  children: ReactNode;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
  testId?: string;
  /** Adds a remove button after the chip: 28px disc, 44px hit area. */
  onRemove?: () => void;
  /** Screen-reader name for the remove button. */
  removeLabel?: string;
}

/**
 * Tap chip (music styles, levels). Radius 8, 44px target. Selected state is a
 * gold border + gold text + a check mark, so it never relies on colour alone.
 */
export function Chip({ children, selected, onToggle, disabled, testId, onRemove, removeLabel = 'Remove' }: ChipProps) {
  const chip = (
    <button
      type="button"
      aria-pressed={selected}
      data-testid={testId}
      data-selected={selected}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        'inline-flex min-h-[44px] items-center gap-[6px] rounded-[var(--r-chip,8px)] border bg-[var(--card2)] px-[12px] text-[14px] transition-colors duration-300 ease-in-out',
        selected ? 'border-[var(--gold)] font-semibold text-[var(--gold)]' : 'border-[var(--line-strong)] text-[var(--fg)]',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      {selected && <Check aria-hidden="true" className="h-[16px] w-[16px]" />}
      {children}
    </button>
  );
  if (!onRemove) return chip;
  return (
    <span className="inline-flex items-center">
      {chip}
      <button
        type="button"
        aria-label={removeLabel}
        data-testid={testId ? `${testId}-remove` : undefined}
        disabled={disabled}
        onClick={onRemove}
        className="-mr-[8px] flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full text-[var(--fg)] disabled:opacity-60"
      >
        <span aria-hidden="true" className="flex h-[28px] w-[28px] items-center justify-center rounded-full bg-[var(--card2)]">
          <X className="h-[14px] w-[14px]" />
        </span>
      </button>
    </span>
  );
}
