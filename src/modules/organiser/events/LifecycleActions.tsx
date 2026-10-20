import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { lifecycleCommand, type OwnerCommand } from '@/modules/organiser/shared/seriesCommands';
import { eventWorkspaceQueryKey } from '@/modules/organiser/shared/runCommands';
import { goLiveCheckQueryKey, goLiveRefusal, RECOMMENDED_WORD, useGoLiveCheck, type GoLiveCheck } from '@/modules/organiser/shared/goLiveCheck';
import { goDone } from '@/modules/organiser/flows/doneState';
import { useFlowSend } from '@/modules/organiser/flows/add/useFlow';
import { EventConflict, StepError } from '@/modules/organiser/flows/event';
import { Card, GhostButton, PrimaryButton } from '../ui';
import { goLiveList, goLiveState, lifecycleRows, STILL_NEEDED, type GoLiveLine } from './lifecycleModel';
import { LockNote, LockedRow, type EventLock } from './ProfileLock';
import type { EventWorkspace } from './eventModel';

const ROW = 'flex min-h-[52px] w-full items-center gap-[12px] px-[16px] py-[8px] text-left text-[15px]';
/** The step line when the server refused Go live with its list: the list itself says what to do. */
export const NOT_READY_LINE = 'Not ready to go live yet.';
const UNLOCKED: EventLock = { locked: false, reason: null };

/**
 * A row that cannot work: it stays, off, with its reason under it. It can still
 * be reached with Tab (PAR-B N9), and a screen reader reads the reason with it.
 */
function Off({ label, reason, testId, tone = 'text-[var(--mut)]' }: { label: string; reason: string; testId: string; tone?: string }) {
  const reasonId = `${testId}-reason`;
  return (
    <div>
      <a role="link" aria-disabled="true" tabIndex={0} aria-describedby={reasonId} data-testid={testId} className={cn(ROW, 'cursor-not-allowed', tone)}>{label}</a>
      <p id={reasonId} className="px-[16px] pb-[10px] text-[13px] text-[var(--mut)]" data-testid={reasonId}>{reason}</p>
    </div>
  );
}

function Line({ line }: { line: GoLiveLine }) {
  const testId = `org-life-item-${line.code}`;
  const body = (
    <>
      <span className="min-w-0 flex-1 text-[var(--fg)]">{line.label}</span>
      {line.recommended && <span className="shrink-0 text-[13px] text-[var(--mut)]" data-testid={`${testId}-tag`}>{RECOMMENDED_WORD}</span>}
    </>
  );
  return line.href ? (
    <Link to={line.href} data-testid={testId} className={ROW}>
      {body}
      <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
    </Link>
  ) : <div data-testid={testId} className={ROW}>{body}</div>;
}

/** The server's list, in its order: what blocks, the profile row, then what is only recommended. */
function GoLiveListView({ check, seriesId, linked }: { check: GoLiveCheck; seriesId: string; linked: boolean }) {
  const list = goLiveList(check, seriesId, linked);
  const blocking = list.missing.length > 0 || !!list.profile;
  if (!blocking && !list.recommended.length) return null;
  return (
    <div data-testid="org-life-list">
      {blocking && <p className="px-[16px] pt-[10px] text-[13px] font-semibold text-[var(--mut)]" data-testid="org-life-list-head">{STILL_NEEDED}</p>}
      <ul>
        {list.missing.map((l) => <li key={l.code}><Line line={l} /></li>)}
        {list.profile && (
          <li>
            <Link to={list.profile.href} data-testid="org-life-profile" className={ROW}>
              <span className="min-w-0 flex-1 text-[var(--fg)]">{list.profile.label}</span>
              <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
            </Link>
          </li>
        )}
        {list.recommended.map((l) => <li key={l.code}><Line line={l} /></li>)}
      </ul>
    </div>
  );
}

/**
 * One event's lifecycle card (C28b, C30b, C38; A-WEB1a): a draft's Go live, one
 * tap -- it sends when the server says ready, else it jumps to the first missing
 * item's screen; the server's list under it -- and Discard (an in-page confirm,
 * then ONE set_lifecycle archived), and the link to the public page for a live
 * event. While the profile lock is on, Go live is off with its reason.
 */
export function LifecycleActions({ ws, today, lock = UNLOCKED }: { ws: EventWorkspace; today: string; lock?: EventLock }) {
  const seriesId = ws.series.id;
  const rows = lifecycleRows(ws, today);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const check = useGoLiveCheck(seriesId, !!rows.goLive);
  const [refused, setRefused] = useState<GoLiveCheck | null>(null);
  const flow = useFlowSend(seriesId, (err) => {
    const list = goLiveRefusal(err);
    if (!list) return null;
    setRefused(list);
    void queryClient.invalidateQueries({ queryKey: goLiveCheckQueryKey(seriesId) });
    return NOT_READY_LINE;
  });
  const [confirming, setConfirming] = useState(false);
  if (!rows.goLive && !rows.discard && !rows.seeLive) return null;
  if (flow.conflict) return <EventConflict seriesId={seriesId} />;
  const name = ws.series.name;
  const sendThenDone = (command: OwnerCommand, done: { title: string; message: string }) =>
    flow.run(async () => {
      const res = await flow.send(seriesId, ws.series.version, command);
      void queryClient.invalidateQueries({ queryKey: eventWorkspaceQueryKey(seriesId) });
      if (res) goDone(navigate, { ...done, seriesId });
    });
  // A readable refusal is the newest word from the server; else the check, once it loaded.
  const shown = refused ?? check.data;
  const state = goLiveState(shown, seriesId, lock);
  return (
    <Card testId="org-life">
      {rows.goLive && state.kind === 'locked' && (
        <div data-testid="org-life-lock">
          <LockedRow label="Go live" reasonId="org-life-lock-note-reason" testId="org-life-golive" />
          <LockNote reason={state.reason} seriesId={seriesId} testId="org-life-lock-note" />
        </div>
      )}
      {rows.goLive && state.kind === 'a1' && <Off label="Go live" reason={state.reason} testId="org-life-golive" />}
      {rows.goLive && (state.kind === 'send' || state.kind === 'fix') && (
        <button type="button" data-testid="org-life-golive" data-goes={state.kind} disabled={flow.busy} className={cn(ROW, 'font-semibold text-[var(--gold)]')}
          onClick={() => {
            if (state.kind === 'fix') { navigate(state.to); return; }
            void sendThenDone(lifecycleCommand('live'), { title: 'Live', message: `Live - ${name}` });
          }}>
          <span className="min-w-0 flex-1">Go live</span>
          <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
        </button>
      )}
      {/* The profile row is the lock's own way out, so a locked card shows the event items only, without links. */}
      {rows.goLive && shown && <GoLiveListView check={state.kind === 'locked' ? { ...shown, profileMissing: [] } : shown} seriesId={seriesId} linked={state.kind !== 'locked'} />}
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
          <PrimaryButton testId="org-life-discard-confirm" loading={flow.busy} loadingLabel="Discarding" className="bg-[var(--danger)] text-[var(--btnfg)]"
            onClick={() => void sendThenDone(lifecycleCommand('archived'), { title: 'Discarded', message: `Draft discarded - ${name}` })}>
            Discard draft
          </PrimaryButton>
          <GhostButton testId="org-life-discard-keep" onClick={() => setConfirming(false)}>Keep it</GhostButton>
        </div>
      )}
      <StepError text={flow.error} />
    </Card>
  );
}
