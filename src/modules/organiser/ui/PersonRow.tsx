import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { initials } from './initials';

export interface PersonRowProps {
  name: string;
  /** Role chip, e.g. "Teacher", "DJ". */
  role?: string;
  sublabel?: ReactNode;
  /** Draws the round 32px remove button (44px hit area). */
  onRemove?: () => void;
  /** Greyed (.72, strike-through) with a gold Undo link. */
  removed?: boolean;
  onUndo?: () => void;
  /** Whole-row press (pick a search result). */
  onPress?: () => void;
  trailing?: ReactNode;
  testId?: string;
}

/** 52px people row: 36px initial avatar, name, role chip, remove or undo. */
export function PersonRow({ name, role, sublabel, onRemove, removed, onUndo, onPress, trailing, testId }: PersonRowProps) {
  const main = (
    <span className={cn('flex min-w-0 flex-1 items-center gap-3', removed && 'opacity-[.72]')}>
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--card2)] text-[13px] font-bold text-[var(--fg)]">
        {initials(name)}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className={cn('block truncate text-[15px] text-[var(--fg)]', removed && 'line-through')}>{name}</span>
        {/* Muted text would drop below 4.5:1 once faded, so a removed row uses --fg. */}
        {sublabel && <span className={cn('block truncate text-[13px]', removed ? 'text-[var(--fg)]' : 'text-[var(--mut)]')}>{sublabel}</span>}
      </span>
      {role && (
        <span className="shrink-0 rounded-[8px] bg-[var(--card2)] px-2 py-0.5 text-[12px] text-[var(--fg)]">{role}</span>
      )}
    </span>
  );
  return (
    <div data-testid={testId} data-removed={removed || undefined} className="flex min-h-[52px] items-center gap-3 px-4 py-2">
      {onPress ? (
        <button type="button" onClick={onPress} className="flex min-h-[44px] min-w-0 flex-1 items-center">
          {main}
        </button>
      ) : (
        main
      )}
      {trailing}
      {removed && onUndo && (
        <button
          type="button"
          onClick={onUndo}
          data-testid={testId ? `${testId}-undo` : undefined}
          className="min-h-[44px] shrink-0 px-2 text-[15px] font-semibold text-[var(--gold)]"
        >
          Undo
        </button>
      )}
      {!removed && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          data-testid={testId ? `${testId}-remove` : undefined}
          className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--card2)] text-[var(--fg)] after:absolute after:-inset-1.5 after:content-['']"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
