import { cn } from '@/lib/utils';
import { londonDateParts } from './londonDate';

export interface DateChipProps {
  /** 'YYYY-MM-DD' (London date) or an ISO timestamp / Date. */
  date: string | Date;
  /** London today (YYYY-MM-DD): a date in another year shows its year on the tile. */
  today?: string;
  testId?: string;
  className?: string;
}

/** card2 tile, radius 8: big day number over a tiny uppercase month. */
export function DateChip({ date, today, testId, className }: DateChipProps) {
  const { day, month, label, year } = londonDateParts(date, today);
  return (
    <span
      data-testid={testId}
      className={cn('flex h-[52px] w-[48px] shrink-0 flex-col items-center justify-center rounded-[8px] bg-[var(--card2)]', className)}
    >
      <span aria-hidden="true" className={cn('font-bold leading-none text-[var(--fg)]', year ? 'text-[18px]' : 'text-[20px]')}>{day}</span>
      <span aria-hidden="true" className="mt-[4px] text-[11px] font-semibold uppercase leading-none tracking-[.03em] text-[var(--mut)]">{month}</span>
      {year && <span aria-hidden="true" className="mt-[2px] text-[10px] leading-none text-[var(--mut)]" data-testid={testId ? `${testId}-year` : undefined}>{year}</span>}
      <span className="sr-only">{label}</span>
    </span>
  );
}
