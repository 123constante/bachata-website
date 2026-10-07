import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SectionLabelProps {
  children: ReactNode;
  /** Heading level; defaults to h2. */
  as?: 'h2' | 'h3' | 'p';
  id?: string;
  testId?: string;
  className?: string;
}

/** 13px muted uppercase label above a card or group. */
export function SectionLabel({ children, as: Tag = 'h2', id, testId, className }: SectionLabelProps) {
  return (
    <Tag
      id={id}
      data-testid={testId}
      className={cn('px-1 pb-2 text-[13px] font-semibold uppercase tracking-[.03em] text-[var(--mut)]', className)}
    >
      {children}
    </Tag>
  );
}
