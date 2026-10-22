import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { OrganiserShell } from '@/modules/organiser/shell/OrganiserShell';
import { isAccessRefusal } from '@/modules/organiser/shared/selfServeErrors';
import { NoAccess } from '@/modules/organiser/shared/components/NoAccess';
import { Card, ErrorState, GhostButton, SkeletonRows } from '@/modules/organiser/ui';
import { cn } from '@/lib/utils';

// The step pieces Add a date and Cancel a date share (S3). `flow` prefixes the
// test ids, so each flow's screens stay tellable apart.

export type FlowName = 'add' | 'cancel';

/**
 * One tappable row of a step list: tap advances (D35). 52px tall. A row that
 * cannot be used stays focusable (aria-disabled) and says why on its sub-line.
 */
export function StepRow({ label, sub, reason, onClick, testId }: {
  label: ReactNode;
  sub?: ReactNode;
  reason?: string | null;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={() => { if (!reason) onClick(); }}
      aria-disabled={reason ? true : undefined}
      data-testid={testId}
      className={cn('flex min-h-[52px] w-full items-center gap-3 px-3 py-2 text-left', reason && 'cursor-not-allowed opacity-60')}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-[var(--fg)]">{label}</span>
        {(reason || sub) && <span className="block truncate text-[13px] text-[var(--mut)]">{reason || sub}</span>}
      </span>
      {!reason && <ChevronRight aria-hidden="true" className="h-[16px] w-[16px] shrink-0 text-[var(--mut)]" />}
    </button>
  );
}

export const StepList = ({ children, testId }: { children: ReactNode; testId: string }) => (
  <Card testId={testId}>{children}</Card>
);

export const Loading = ({ flow }: { flow: FlowName }) => <SkeletonRows count={3} label="Loading" testId={`${flow}-loading`} />;

/** A read failed. `error` is the event workspace's: a refusal of this login is NoAccess, with no retry (A-B2). */
export const Failed = ({ flow, onRetry, error }: { flow: FlowName; onRetry: () => void; error?: unknown }) =>
  isAccessRefusal(error) ? <NoAccess /> : <ErrorState title="Did not load" onRetry={onRetry} testId={`${flow}-error`} />;

/** A day, date or event this flow cannot use: the reason (dateLock text verbatim) and ONE way on. */
export function Refusal({ flow, text, line, back, backLabel }: { flow: FlowName; text: string; line?: string; back: string; backLabel: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-3" data-testid={`${flow}-refusal`}>
      <p className="text-[15px] text-[var(--fg)]">{text}</p>
      {line ? <p className="text-[14px] text-[var(--mut)]" data-testid={`${flow}-refusal-line`}>{line}</p> : null}
      <GhostButton testId={`${flow}-refusal-back`} onClick={() => navigate(back, { replace: true })}>
        {backLabel}
      </GhostButton>
    </div>
  );
}

/** Not one of this login's events or dates (a link from another account, a deleted date). */
export const Missing = ({ flow }: { flow: FlowName }) => (
  <Refusal flow={flow} text="Not found" back={ORG_PATHS.home} backLabel="Back to Home" />
);


export const ErrorLine = ({ flow, text }: { flow: FlowName; text: string | null }) =>
  text ? <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid={`${flow}-error-message`}>{text}</p> : null;

/** Every step's frame: the shell with its back link (the title is the event name where there is one), compact padding. */
export function Step({ title, back, children }: { title: ReactNode; back: string; children: ReactNode }) {
  return (
    <OrganiserShell title={title} back={{ to: back, label: 'Back' }}>
      <div className="flex flex-col gap-3 p-3">{children}</div>
    </OrganiserShell>
  );
}
