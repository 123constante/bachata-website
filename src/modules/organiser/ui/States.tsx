import type { ReactNode } from 'react';
import { GhostButton } from './Buttons';

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
    <div data-testid={testId} className="flex flex-col items-center gap-2 rounded-[16px] border border-[var(--line)] bg-[var(--card)] px-4 py-6 text-center">
      {icon && <span aria-hidden="true" className="text-[var(--mut)] [&_svg]:h-7 [&_svg]:w-7">{icon}</span>}
      <p className="text-[16px] font-semibold text-[var(--fg)]">{title}</p>
      {body && <p className="text-[14px] text-[var(--mut)]">{body}</p>}
      {action && <div className="mt-2 w-full">{action}</div>}
    </div>
  );
}

export interface ErrorStateProps {
  title?: ReactNode;
  body?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  retrying?: boolean;
  testId?: string;
}

/** Calm failure copy with a retry. Never a red wall, never a stack trace. */
export function ErrorState({
  title = 'This did not load',
  body = 'Check your connection, then try again. Nothing you saved is lost.',
  onRetry,
  retryLabel = 'Try again',
  retrying,
  testId,
}: ErrorStateProps) {
  return (
    <div role="status" data-testid={testId} className="flex flex-col items-center gap-2 rounded-[16px] border border-[var(--line)] bg-[var(--card)] px-4 py-6 text-center">
      <p className="text-[16px] font-semibold text-[var(--fg)]">{title}</p>
      <p className="text-[14px] text-[var(--mut)]">{body}</p>
      {onRetry && (
        <div className="mt-2 w-full">
          <GhostButton onClick={onRetry} loading={retrying} loadingLabel="Trying again" testId={testId ? `${testId}-retry` : undefined}>
            {retryLabel}
          </GhostButton>
        </div>
      )}
    </div>
  );
}
