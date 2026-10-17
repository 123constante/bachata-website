import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { WARN_DATE } from '@/modules/organiser/shared/copy';
import { dayLabel } from '@/modules/organiser/shared/dateList';
import { dateLock } from '@/modules/organiser/shared/eventState';
import { localAsZTime } from '@/modules/organiser/shared/homeModel';
import { fetchCancellationReasons } from '@/modules/organiser/shared/selfServeApi';
import { cancelCommand, uncancelCommand } from '@/modules/organiser/shared/seriesCommands';
import type { DateDetail, WorkspaceDate } from '@/modules/organiser/shared/seriesModel';
import { goDone } from '@/modules/organiser/flows/doneState';
import { Chip, GhostButton, PrimaryButton } from '@/modules/organiser/ui';
import { backOnMessage, cancelDoneMessage, DEFAULT_REASON, findSeries } from '../add/addModel';
import { useDateDetail, useFlowHome, useFlowSend, useSeriesWorkspace } from '../add/useFlow';
import { Conflict, ErrorLine, Failed, Loading, Missing, Refusal, Step } from '../add/parts';
import { PUT_BACK, putBackPath } from './cancelModel';

type Gate =
  | { kind: 'refused'; text: string }
  | { kind: 'scheduled' | 'cancelled'; date: WorkspaceDate; detail: DateDetail };

/**
 * C13: cancel this date, the ONLY screen with the date warning line (D31,
 * D40): a quiet "Keep it", the gold "Cancel this date", an optional reason.
 * ONE occurrence.cancel on the DATE with its own version (event_view_p5), then
 * Done with "Put it back" (D61). In put-back mode (?put=back, from that Done)
 * it sends ONE occurrence.cancel {cancelled:false} (D46) and lands on Done again.
 */
export default function Confirm() {
  const { seriesId = '', occurrenceId = '' } = useParams();
  const [search] = useSearchParams();
  const home = useFlowHome();
  const one = findSeries(home.data, seriesId);
  const ws = useSeriesWorkspace(seriesId, !!one);
  const today = home.data?.today ?? '';
  const date = ws.data?.dates.find((d) => d.id === occurrenceId) ?? null;
  const lock = ws.data && date ? dateLock(ws.data.series.lifecycle_status, date.occurrence_date, today) : null;
  const detail = useDateDetail(occurrenceId, !!date && !lock);

  // Once a write starts the gate is held: the reload flips the date, and the
  // screen must not flash the other state on its way to Done. Read from
  // settled data only (Done's Put it back arrives while the reload runs).
  const [held, setHeld] = useState<Gate | null>(null);
  const live: Gate | null = !ws.data || !date || ws.isFetching ? null
    : lock ? { kind: 'refused', text: lock }
    : detail.data && !detail.isFetching ? { kind: detail.data.cancelled ? 'cancelled' : 'scheduled', date, detail: detail.data }
    : null;
  const gate = held ?? live;
  const hold = () => setHeld(gate);

  return (
    <Step title={one?.name ?? 'Cancel a date'} back={ORG_PATHS.cancelEvent(seriesId)}>
      {home.isError || ws.isError || detail.isError ? (
        <Failed flow="cancel" onRetry={() => { void home.refetch(); void ws.refetch(); void detail.refetch(); }} />
      ) : !home.data || (one && !ws.data) ? (
        <Loading flow="cancel" />
      ) : !one || !date ? (
        <Missing flow="cancel" />
      ) : !gate ? (
        <Loading flow="cancel" />
      ) : gate.kind === 'refused' ? (
        <Refusal flow="cancel" text={gate.text} back={ORG_PATHS.cancelEvent(seriesId)} backLabel="Other dates" />
      ) : gate.kind === 'cancelled' ? (
        <PutBack seriesId={seriesId} date={gate.date} detail={gate.detail} auto={search.get('put') === PUT_BACK} onSend={hold} />
      ) : (
        <CancelForm seriesId={seriesId} date={gate.date} detail={gate.detail} onSend={hold} />
      )}
    </Step>
  );
}

function CancelForm({ seriesId, date, detail, onSend }: { seriesId: string; date: WorkspaceDate; detail: DateDetail; onSend: () => void }) {
  const navigate = useNavigate();
  const [reason, setReason] = useState<string | null>(null);
  const reasons = useQuery({ queryKey: ['cancellation-reasons'], queryFn: fetchCancellationReasons, staleTime: Infinity });
  const { send, run, busy, conflict, error } = useFlowSend(seriesId);
  if (conflict) return <Conflict flow="cancel" seriesId={seriesId} />;
  const time = localAsZTime(date.materialised_start_utc) ?? detail.start;
  // "Other" is what no pick means, so it is not offered as a chip.
  const offered = (reasons.data ?? []).filter((r) => r.label !== DEFAULT_REASON);

  const cancel = () => run(async () => {
    onSend();
    if (await send(date.id, detail.version, cancelCommand(reason ?? DEFAULT_REASON))) {
      goDone(navigate, {
        title: 'Cancelled',
        message: cancelDoneMessage(date.occurrence_date),
        seriesId,
        next: putBackPath(seriesId, date.id),
      });
    }
  });

  return (
    <div className="flex flex-col gap-3" data-testid="cancel-confirm">
      <p className="text-[16px] font-bold text-[var(--fg)]">
        {dayLabel(date.occurrence_date)}{time ? `, ${time}` : ''}
      </p>
      <p className="text-[14px] text-[var(--mut)]" data-testid="cancel-warning">{WARN_DATE}</p>
      {offered.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Reason">
          {offered.map((r) => (
            <Chip key={r.key} selected={reason === r.label} onToggle={() => setReason(reason === r.label ? null : r.label)}>
              {r.label}
            </Chip>
          ))}
        </div>
      )}
      <ErrorLine flow="cancel" text={error} />
      <PrimaryButton testId="cancel-send" loading={busy} onClick={() => void cancel()}>
        Cancel this date
      </PrimaryButton>
      <button
        type="button"
        data-testid="cancel-keep"
        onClick={() => navigate(ORG_PATHS.cancelEvent(seriesId), { replace: true })}
        className="min-h-[44px] w-full text-[15px] font-semibold text-[var(--mut)]"
      >
        Keep it
      </button>
    </div>
  );
}

/** A cancelled date: put it back (ONE uncancel). From Done's "Put it back" it sends on arrival. */
function PutBack({ seriesId, date, detail, auto, onSend }: { seriesId: string; date: WorkspaceDate; detail: DateDetail; auto: boolean; onSend: () => void }) {
  const navigate = useNavigate();
  const { send, run, busy, conflict, error } = useFlowSend(seriesId);
  const putBack = () => run(async () => {
    onSend();
    if (await send(date.id, detail.version, uncancelCommand())) {
      goDone(navigate, { title: 'Back on', message: backOnMessage(date.occurrence_date), seriesId });
    }
  });
  const fired = useRef(false);
  useEffect(() => {
    if (auto && !fired.current) {
      fired.current = true;
      void putBack();
    }
  });
  if (conflict) return <Conflict flow="cancel" seriesId={seriesId} />;
  return (
    <div className="flex flex-col gap-3" data-testid="cancel-already">
      <p className="text-[16px] font-bold text-[var(--fg)]">{dayLabel(date.occurrence_date)}</p>
      <p className="text-[14px] text-[var(--mut)]">Cancelled</p>
      <ErrorLine flow="cancel" text={error} />
      <PrimaryButton testId="cancel-put-back" loading={busy} onClick={() => void putBack()}>
        Put it back
      </PrimaryButton>
      <GhostButton testId="cancel-other-dates" onClick={() => navigate(ORG_PATHS.cancelEvent(seriesId), { replace: true })}>
        Other dates
      </GhostButton>
    </div>
  );
}
