import { useState } from 'react';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { lifecycleCommand } from '@/modules/organiser/shared/seriesCommands';
import { useEventSend, EventConflict, StepError } from '@/modules/organiser/flows/event';
import { Card, GhostButton, PrimaryButton } from '../ui';
import { lifecycleRows } from './lifecycleModel';
import type { EventWorkspace } from './eventModel';

const ROW = 'flex min-h-[52px] w-full items-center gap-[12px] px-[16px] py-[8px] text-left text-[15px]';

/** A row that cannot work: it stays, off, with its reason under it. */
function Off({ label, reason, testId, tone = 'text-[var(--mut)]' }: { label: string; reason: string; testId: string; tone?: string }) {
  return (
    <div>
      <a role="link" aria-disabled="true" data-testid={testId} className={cn(ROW, 'cursor-not-allowed', tone)}>{label}</a>
      <p className="px-[16px] pb-[10px] text-[13px] text-[var(--mut)]" data-testid={`${testId}-reason`}>{reason}</p>
    </div>
  );
}

/**
 * One event's lifecycle card (C28b, C30b, C38): a draft's Go live (off with the
 * reason until A1 and readiness allow it) and Discard (an in-page confirm, then
 * ONE set_lifecycle archived), and the link to the public page for a live event.
 */
export function LifecycleActions({ ws, today }: { ws: EventWorkspace; today: string }) {
  const rows = lifecycleRows(ws, today);
  const { sendThenDone, busy, conflict, error } = useEventSend(ws.series.id);
  const [confirming, setConfirming] = useState(false);
  if (!rows.goLive && !rows.discard && !rows.seeLive) return null;
  if (conflict) return <EventConflict seriesId={ws.series.id} />;
  const name = ws.series.name;
  return (
    <Card testId="org-life">
      {rows.goLive && (rows.goLive.reason ? <Off label="Go live" reason={rows.goLive.reason} testId="org-life-golive" /> : (
        <button type="button" data-testid="org-life-golive" disabled={busy} className={cn(ROW, 'font-semibold text-[var(--gold)]')}
          onClick={() => void sendThenDone(ws.series.version, lifecycleCommand('live'), { title: 'Live', message: `Live - ${name}` })}>
          <span className="min-w-0 flex-1">Go live</span>
          <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
        </button>
      ))}
      {rows.seeLive && (rows.seeLive.href ? (
        <a href={rows.seeLive.href} target="_blank" rel="noopener noreferrer" data-testid="org-life-seelive" className={cn(ROW, 'text-[var(--fg)]')}>
          <span className="min-w-0 flex-1">See it live</span>
          <ExternalLink aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
        </a>
      ) : <Off label="See it live" reason={rows.seeLive.reason ?? ''} testId="org-life-seelive" />)}
      {rows.discard && !confirming && (
        <button type="button" data-testid="org-life-discard" onClick={() => setConfirming(true)} className={cn(ROW, 'text-[var(--danger)]')}>
          <span className="min-w-0 flex-1">Discard draft</span>
        </button>
      )}
      {rows.discard && confirming && (
        <div className="flex flex-col gap-2 p-3" data-testid="org-life-discard-ask">
          <p className="text-[15px] font-semibold text-[var(--fg)]">Discard this draft?</p>
          <p className="text-[14px] text-[var(--mut)]">It leaves your events. Dancers never saw it.</p>
          <PrimaryButton testId="org-life-discard-confirm" loading={busy} loadingLabel="Discarding"
            onClick={() => void sendThenDone(ws.series.version, lifecycleCommand('archived'), { title: 'Discarded', message: `Draft discarded - ${name}` })}>
            Discard draft
          </PrimaryButton>
          <GhostButton testId="org-life-discard-keep" onClick={() => setConfirming(false)}>Keep it</GhostButton>
        </div>
      )}
      <StepError text={error} />
    </Card>
  );
}
