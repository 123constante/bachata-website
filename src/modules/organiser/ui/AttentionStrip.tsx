import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AttentionStripProps {
  children: ReactNode;
  /** Short action word shown on the right, e.g. "Extend". */
  actionLabel?: string;
  /** The whole strip is one button when set. */
  onPress?: () => void;
  icon?: ReactNode;
  testId?: string;
}

/** Amber strip for something that needs the organiser (shown only when needed). */
export function AttentionStrip({ children, actionLabel, onPress, icon, testId }: AttentionStripProps) {
  const cls = cn(
    'flex min-h-[52px] w-full items-center gap-3 rounded-[12px] border border-[#5a4118] bg-gradient-to-r from-[#3a2a10] to-[#2a1f10] px-4 py-3 text-left text-[14px] text-[var(--warn-fg)] [&_svg]:shrink-0',
  );
  const body = (
    <>
      {icon && <span aria-hidden="true" className="[&_svg]:h-[18px] [&_svg]:w-[18px]">{icon}</span>}
      <span className="min-w-0 flex-1">{children}</span>
      {actionLabel && <span className="font-semibold">{actionLabel}</span>}
      {onPress && <ChevronRight aria-hidden="true" className="h-[18px] w-[18px]" />}
    </>
  );
  return onPress ? (
    <button type="button" data-testid={testId} onClick={onPress} className={cls}>
      {body}
    </button>
  ) : (
    <div data-testid={testId} className={cls}>
      {body}
    </div>
  );
}
