import type { ReactNode } from 'react';
import { ChevronRight, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SummaryRowProps {
  /** 22px icon tile on the left (pass a lucide icon). */
  icon?: ReactNode;
  label: ReactNode;
  sublabel?: ReactNode;
  /** Current value, right-aligned and muted (truncates). */
  value?: ReactNode;
  /** Trailing affordance. Defaults to chevron when onPress is set. */
  affordance?: 'chevron' | 'pencil' | 'none';
  /** Opens ONE small editor (usually a SheetView). Without it the row is static. */
  onPress?: () => void;
  disabled?: boolean;
  testId?: string;
  'aria-label'?: string;
  className?: string;
}

/**
 * A summary row: shows the current value and opens one editor. Min height 52,
 * padding 14px 16px. Put several inside a <Card> for the 1px dividers.
 */
export function SummaryRow({
  icon,
  label,
  sublabel,
  value,
  affordance,
  onPress,
  disabled,
  testId,
  className,
  ...aria
}: SummaryRowProps) {
  // A disabled row opens nothing, so it draws no chevron or pencil promising it does.
  const trail = disabled ? 'none' : affordance ?? (onPress ? 'chevron' : 'none');
  const body = (
    <>
      {icon && (
        <span
          aria-hidden="true"
          className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] bg-[var(--card2)] text-[var(--mut)] [&_svg]:h-[14px] [&_svg]:w-[14px]"
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] text-[var(--fg)]">{label}</span>
        {sublabel && <span className="block truncate text-[13px] text-[var(--mut)]">{sublabel}</span>}
      </span>
      {value !== undefined && value !== null && value !== '' && (
        <span className="min-w-0 max-w-[50%] truncate text-right text-[15px] text-[var(--mut)]" data-testid={testId ? `${testId}-value` : undefined}>
          {value}
        </span>
      )}
      {trail === 'chevron' && <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />}
      {trail === 'pencil' && <Pencil aria-hidden="true" className="h-[16px] w-[16px] shrink-0 text-[var(--mut)]" />}
    </>
  );
  const base = cn(
    'flex min-h-[52px] w-full items-center gap-[12px] px-[16px] py-[14px] text-left',
    disabled && 'cursor-not-allowed opacity-60',
    className,
  );
  if (!onPress) {
    return (
      <div data-testid={testId} className={base}>
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onPress}
      disabled={disabled}
      aria-label={aria['aria-label']}
      className={cn(base, !disabled && 'transition-colors duration-300 ease-in-out active:bg-[var(--card2)]')}
    >
      {body}
    </button>
  );
}
