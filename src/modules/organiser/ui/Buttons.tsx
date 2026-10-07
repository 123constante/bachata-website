import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OrgButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Busy: disables the button and swaps the label for a spinner WITHOUT changing its size. */
  loading?: boolean;
  /** Screen-reader text while loading. */
  loadingLabel?: string;
  /** 'md' 52px (default), 'sm' 44px. Both meet the 44px target. */
  size?: 'md' | 'sm';
  /** Full width (default true). */
  block?: boolean;
  testId?: string;
}

function makeButton(displayName: string, tone: string) {
  const Btn = forwardRef<HTMLButtonElement, OrgButtonProps>(function OrgButton(
    { loading = false, loadingLabel = 'Saving', size = 'md', block = true, testId, className, children, disabled, type = 'button', ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        data-testid={testId}
        data-loading={loading || undefined}
        aria-busy={loading || undefined}
        disabled={disabled || loading}
        className={cn(
          'relative inline-flex items-center justify-center gap-2 rounded-[12px] px-5 font-bold transition-opacity duration-300 ease-in-out',
          size === 'md' ? 'h-[52px] text-[16px]' : 'h-[44px] text-[15px]',
          block && 'w-full',
          tone,
          disabled && !loading && 'cursor-not-allowed opacity-60',
          className,
        )}
        {...rest}
      >
        <span className={cn('inline-flex items-center gap-2', loading && 'invisible')}>{children}</span>
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
            <span className="sr-only">{loadingLabel}</span>
          </span>
        )}
      </button>
    );
  });
  Btn.displayName = displayName;
  return Btn;
}

/** The ONE cream primary button per screen. */
export const PrimaryButton = makeButton('PrimaryButton', 'bg-[var(--btn)] text-[var(--btnfg)]');
/** Secondary action: card2 surface, cream text. Use as many as needed. */
export const GhostButton = makeButton('GhostButton', 'bg-[var(--card2)] text-[var(--fg)]');
