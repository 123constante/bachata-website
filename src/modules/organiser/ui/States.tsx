import type { ReactNode } from 'react';
import { GhostButton, PrimaryButton } from './Buttons';

export interface EmptyStateProps {
  title: ReactNode;
  body?: ReactNode;
  icon?: ReactNode;
  /** Usually the screen's one PrimaryButton, or a GhostButton. */
  action?: ReactNode;
  testId?: string;
}

/** Nothing here yet: one line of what, one line of why, one way on. */
export function EmptyState({ title, body, icon, action, testId }: EmptyStateProps) {
  return (
    <div data-testid={testId} className="flex flex-col items-center gap-[8px] rounded-[16px] border border-[var(--line)] bg-[var(--card)] px-[16px] py-[24px] text-center">
      {icon && <span aria-hidden="true" className="text-[var(--mut)] [&_svg]:h-[28px] [&_svg]:w-[28px]">{icon}</span>}
      <p className="text-[16px] font-semibold text-[var(--fg)]">{title}</p>
      {body && <p className="text-[14px] text-[var(--mut)]">{body}</p>}
      {action && <div className="mt-[8px] w-full">{action}</div>}
    </div>
  );
}

export interface ErrorStateProps {
  title?: ReactNode;
  body?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  retrying?: boolean;
  /**
   * A failed screen's retry is its ONE primary button. Pass `quiet` when the
   * error sits inside a screen or sheet that already has a primary.
   */
  quiet?: boolean;
  testId?: string;
}

/** Calm failure copy with a retry. Never a red wall, never a stack trace. */
export function ErrorState({
  title = 'This did not load',
  body = 'Check your connection, then try again. Nothing you saved is lost.',
  onRetry,
  retryLabel = 'Try again',
  retrying,
  quiet = false,
  testId,
}: ErrorStateProps) {
  const Retry = quiet ? GhostButton : PrimaryButton;
  return (
    <div role="status" data-testid={testId} className="flex flex-col items-center gap-[8px] rounded-[16px] border border-[var(--line)] bg-[var(--card)] px-[16px] py-[24px] text-center">
      <p className="text-[16px] font-semibold text-[var(--fg)]">{title}</p>
      <p className="text-[14px] text-[var(--mut)]">{body}</p>
      {onRetry && (
        <div className="mt-[8px] w-full">
          <Retry onClick={onRetry} loading={retrying} loadingLabel="Trying again" testId={testId ? `${testId}-retry` : undefined}>
            {retryLabel}
          </Retry>
        </div>
      )}
    </div>
  );
}
