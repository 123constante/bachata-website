import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface PillProps {
  children: ReactNode;
  icon?: ReactNode;
  testId?: string;
  className?: string;
}

/** Neutral read-only pill (full round, 12px). Not interactive: use Chip for taps. */
export function Pill({ children, icon, testId, className }: PillProps) {
  return (
    <span
      data-testid={testId}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--card2)] px-2.5 py-0.5 text-[12px] text-[var(--fg)] [&_svg]:h-3 [&_svg]:w-3',
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
