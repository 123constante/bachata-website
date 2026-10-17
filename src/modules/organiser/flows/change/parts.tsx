import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { OrganiserShell } from '@/modules/organiser/shell/OrganiserShell';
import { isAccessRefusal } from '@/modules/organiser/shared/selfServeErrors';
import { NoAccess } from '@/modules/organiser/shared/components/NoAccess';
import { Card, ErrorState, GhostButton, PrimaryButton, SkeletonRows } from '@/modules/organiser/ui';
import { cn } from '@/lib/utils';

/** One tappable row of a step list: tap advances (D35). 52px tall. */
export function StepRow({ label, sub, end, onClick, testId, disabled, pressed }: {
  label: ReactNode;
  sub?: ReactNode;
  end?: ReactNode;
  onClick: () => void;
  testId?: string;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      data-testid={testId}
      className={cn('flex min-h-[52px] w-full items-center gap-3 px-3 py-2 text-left', disabled && 'opacity-60')}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-[var(--fg)]">{label}</span>
        {sub && <span className="block truncate text-[13px] text-[var(--mut)]">{sub}</span>}
      </span>
      {end ?? <ChevronRight aria-hidden="true" className="h-[16px] w-[16px] shrink-0 text-[var(--mut)]" />}
    </button>
  );
}

export const StepList = ({ children, testId }: { children: ReactNode; testId: string }) => (
  <Card testId={testId}>{children}</Card>
);

export function Loading() {
  return <SkeletonRows count={3} label="Loading" testId="change-loading" />;
}

/** A read failed. `error` is the event workspace's: a refusal of this login is NoAccess, with no retry (A-B2). */
export function Failed({ onRetry, error }: { onRetry: () => void; error?: unknown }) {
  if (isAccessRefusal(error)) return <NoAccess />;
  return <ErrorState title="Did not load" onRetry={onRetry} testId="change-error" />;
}

/**
 * A date (or event) this flow cannot change: the reason (dateLock text
 * verbatim) and ONE way on: Other dates, or Home from the event's own list.
 */
export function Refusal({ text, seriesId, home = false }: { text: string; seriesId: string; home?: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-3" data-testid="change-refusal">
      <p className="text-[15px] text-[var(--fg)]">{text}</p>
      <GhostButton
        testId="change-refusal-back"
        onClick={() => navigate(home ? ORG_PATHS.home : ORG_PATHS.changeEvent(seriesId), { replace: true })}
      >
        {home ? 'Back to Home' : 'Other dates'}
      </GhostButton>
    </div>
  );
}

/** Not one of this login's events or dates (a link from another account, a deleted date). */
export function Missing() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-3" data-testid="change-missing">
      <p className="text-[15px] text-[var(--fg)]">Not found</p>
      <GhostButton testId="change-missing-home" onClick={() => navigate(ORG_PATHS.home, { replace: true })}>
        Back to Home
      </GhostButton>
    </div>
  );
}


/**
 * The Save of a typed step: aria-disabled (still focusable, so a screen
 * reader reaches it) with the reason on screen until the value differs from
 * the current one; a click then does nothing, so an untouched save sends no
 * command.
 */
export function SaveButton({ ready, reason, busy, error, onSave }: {
  ready: boolean;
  reason: string;
  busy: boolean;
  error: string | null;
  onSave: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {error && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="change-error-message">{error}</p>}
      <PrimaryButton
        testId="change-save"
        aria-disabled={!ready || undefined}
        aria-describedby={ready ? undefined : 'change-save-reason'}
        loading={busy}
        className={cn(!ready && 'cursor-not-allowed opacity-60')}
        onClick={() => { if (ready && !busy) onSave(); }}
      >
        Save
      </PrimaryButton>
      {!ready && (
        <p id="change-save-reason" data-testid="change-save-reason" className="text-[13px] text-[var(--mut)]">{reason}</p>
      )}
    </div>
  );
}

/** Every step's frame: the shell with its back link, compact padding. */
export function Step({ title, back, children }: { title: ReactNode; back: string; children: ReactNode }) {
  return (
    <OrganiserShell title={title} back={{ to: back, label: 'Back' }}>
      <div className="flex flex-col gap-3 p-3">{children}</div>
    </OrganiserShell>
  );
}
