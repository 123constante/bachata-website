import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { OrganiserShell } from '@/modules/organiser/shell';
import { VERSION_CONFLICT } from '@/modules/organiser/shared/copy';
import { PrimaryButton } from '@/modules/organiser/ui';

/** One step of the event screen: its title, Back to the event, the step body. */
export function EventStepShell({ seriesId, title, back, children }: { seriesId: string; title: ReactNode; back?: string; children: ReactNode }) {
  return (
    <OrganiserShell title={title} back={{ to: back ?? ORG_PATHS.event(seriesId), label: 'Back' }}>
      <div className="flex flex-col gap-3 p-3" data-testid="event-step">{children}</div>
    </OrganiserShell>
  );
}

/** R3-7: someone changed the event first. The one button goes back to it. */
export function EventConflict({ seriesId }: { seriesId: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-3" data-testid="event-conflict" role="alert">
      <p className="text-[16px] font-bold text-[var(--fg)]">{VERSION_CONFLICT}</p>
      <PrimaryButton testId="event-conflict-event" onClick={() => navigate(ORG_PATHS.event(seriesId), { replace: true })}>
        Open the event
      </PrimaryButton>
    </div>
  );
}

export const StepError = ({ text }: { text: string | null }) =>
  text ? <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="event-step-error">{text}</p> : null;

/**
 * The step's ONE button. A button that cannot work yet stays on screen with
 * aria-disabled and its reason under it (a click does nothing).
 */
export function SendButton({ label, reason, busy, onSend, testId = 'event-step-send' }: {
  label: string; reason: string | null; busy: boolean; onSend: () => void; testId?: string;
}) {
  return (
    <>
      <PrimaryButton testId={testId} loading={busy} aria-disabled={reason ? true : undefined}
        className={cn(reason && 'cursor-not-allowed opacity-60')}
        onClick={() => { if (!reason) onSend(); }}>
        {label}
      </PrimaryButton>
      {reason && <p className="text-[13px] text-[var(--mut)]" data-testid="event-step-reason">{reason}</p>}
    </>
  );
}

/** A choice on a step (a weekday, tonight's answer): a 44px+ radio button. */
export function ChoiceButton({ selected, onPick, children, testId }: { selected: boolean; onPick: () => void; children: ReactNode; testId: string }) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onPick} data-testid={testId}
      className={cn('flex min-h-[48px] w-full items-center rounded-[12px] border px-[12px] text-left text-[15px]',
        selected ? 'border-[var(--gold)] font-semibold text-[var(--fg)]' : 'border-[var(--line-strong)] text-[var(--fg)]')}>
      {children}
    </button>
  );
}
