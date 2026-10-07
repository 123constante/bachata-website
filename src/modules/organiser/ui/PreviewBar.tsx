import type { ReactNode } from 'react';
import { PrimaryButton } from './Buttons';
import { useKeyboardInset } from './useKeyboardInset';

export const LIVE_NOTE = 'Guests see changes to live events straight away.';

export interface PreviewBarProps {
  /** Compact preview of the public card. Capped in height so the button stays reachable. */
  preview?: ReactNode;
  actionLabel: string;
  onAction: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Shows the live note (default true). */
  live?: boolean;
  /** Spread useShake().shakeProps here to shake the bar on a failed save. */
  shakeProps?: { className?: string; onAnimationEnd?: () => void };
  testId?: string;
}

/**
 * Sticky bottom bar for editing a published event: preview card + the screen's
 * ONE primary button + the plain live note. Pass it to OrganiserShell's
 * `actionBar` slot (which keeps it above the tab bar and the keyboard).
 */
export function PreviewBar({ preview, actionLabel, onAction, loading, disabled, live = true, shakeProps, testId = 'org-preview-bar' }: PreviewBarProps) {
  // While the keyboard is up only the button stays, so the bar fits above it.
  const typing = useKeyboardInset().inset > 0;
  return (
    <div data-testid={testId} className={`space-y-2 px-4 py-3 ${shakeProps?.className ?? ''}`} onAnimationEnd={shakeProps?.onAnimationEnd}>
      {preview && !typing && (
        <div data-testid={`${testId}-preview`} className="max-h-[22dvh] overflow-hidden rounded-[12px] border border-[var(--line)] bg-[var(--card)]">
          {preview}
        </div>
      )}
      <PrimaryButton onClick={onAction} loading={loading} disabled={disabled} testId={`${testId}-action`}>
        {actionLabel}
      </PrimaryButton>
      {live && !typing && <p className="text-center text-[13px] text-[var(--mut)]">{LIVE_NOTE}</p>}
    </div>
  );
}
