import { cn } from '@/lib/utils';
import { londonDateParts } from './londonDate';

export interface DateChipProps {
  /** 'YYYY-MM-DD' (London date) or an ISO timestamp / Date. */
  date: string | Date;
  testId?: string;
  className?: string;
}

/** card2 tile, radius 8: big day number over a tiny uppercase month. */
export function DateChip({ date, testId, className }: DateChipProps) {
  const { day, month, label } = londonDateParts(date);
  return (
    <span
      data-testid={testId}
      className={cn('flex h-[52px] w-[48px] shrink-0 flex-col items-center justify-center rounded-[8px] bg-[var(--card2)]', className)}
    >
      <span aria-hidden="true" className="text-[20px] font-bold leading-none text-[var(--fg)]">{day}</span>
      <span aria-hidden="true" className="mt-1 text-[11px] font-semibold uppercase leading-none tracking-[.03em] text-[var(--mut)]">{month}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
