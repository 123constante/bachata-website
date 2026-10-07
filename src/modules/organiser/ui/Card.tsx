import { useId, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { SectionLabel } from './SectionLabel';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Optional section label rendered above the card (names the region). */
  label?: ReactNode;
  testId?: string;
  /**
   * 'rows' (default): no padding, 1px line dividers between direct children
   * (SummaryRow, PersonRow). 'padded': 16px padding, no dividers.
   */
  variant?: 'rows' | 'padded';
}

/** Soft raised card: bg card, 1px line border, radius 16. */
export function Card({ label, testId, variant = 'rows', className, children, ...rest }: CardProps) {
  const labelId = useId();
  const card = (
    <div
      data-testid={testId}
      className={cn(
        'overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--card)]',
        variant === 'padded' ? 'p-4' : 'divide-y divide-[var(--line)]',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
  if (!label) return card;
  return (
    <section aria-labelledby={labelId}>
      <SectionLabel id={labelId}>{label}</SectionLabel>
      {card}
    </section>
  );
}
