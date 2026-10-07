import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChipProps {
  children: ReactNode;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
  testId?: string;
}

/**
 * Tap chip (music styles, levels). Radius 8, 44px target. Selected state is a
 * gold border + gold text + a check mark, so it never relies on colour alone.
 */
export function Chip({ children, selected, onToggle, disabled, testId }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      data-testid={testId}
      data-selected={selected}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        'inline-flex min-h-[44px] items-center gap-1.5 rounded-[8px] border bg-[var(--card2)] px-3 text-[14px] transition-colors duration-300 ease-in-out',
        selected ? 'border-[var(--gold)] font-semibold text-[var(--gold)]' : 'border-[var(--line-strong)] text-[var(--fg)]',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      {selected && <Check aria-hidden="true" className="h-4 w-4" />}
      {children}
    </button>
  );
}
