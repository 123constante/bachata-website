import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type StatusTone = 'live' | 'draft' | 'party' | 'neutral';

const TONE: Record<StatusTone, string> = {
  live: 'bg-[var(--ok-bg)] text-[var(--ok-fg)]',
  draft: 'bg-[var(--warn-bg)] text-[var(--warn-fg)]',
  party: 'bg-[var(--warn-bg)] text-[var(--warn-fg)]',
  neutral: 'bg-[var(--card2)] text-[var(--mut)]',
};

export interface StatusTagProps {
  tone: StatusTone;
  children: ReactNode;
  testId?: string;
  className?: string;
}

/** Status tag: green for Live, amber for Draft/Party. Pill radius, 12px text. */
export function StatusTag({ tone, children, testId, className }: StatusTagProps) {
  return (
    <span
      data-testid={testId}
      data-tone={tone}
      className={cn('inline-flex shrink-0 items-center rounded-full px-[10px] py-[2px] text-[12px] font-semibold', TONE[tone], className)}
    >
      {children}
    </span>
  );
}
