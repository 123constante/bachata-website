import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { dayLabel } from '@/modules/organiser/shared/dateList';
import { fetchDateDetail, fetchSeriesWorkspace } from '@/modules/organiser/shared/selfServeApi';
import { addDateCommand, setTimeCommand } from '@/modules/organiser/shared/seriesCommands';
import type { HomeSeriesFull } from '@/modules/organiser/shared/homeModel';
import type { SeriesWorkspace } from '@/modules/organiser/shared/seriesModel';
import { goDone } from '@/modules/organiser/flows/doneState';
import { FIELD_CLASS, PrimaryButton } from '@/modules/organiser/ui';
import { cn } from '@/lib/utils';
import { addDayGate, addDoneMessage, type DayGate, findSeries, seriesLock, usualTime } from './addModel';
import { useFlowHome, useFlowSend, useSeriesWorkspace } from './useFlow';
import { Conflict, ErrorLine, Failed, Loading, Missing, Refusal, Step } from './parts';

/** C9: the time of the new date, prefilled with the event's usual time; Save adds it (C10 Done, no Undo). */
export default function Time() {
  const { seriesId = '', date = '' } = useParams();
  const home = useFlowHome();
  const one = findSeries(home.data, seriesId);
  const lock = one ? seriesLock(one.lifecycle_status, 'add') : null;
  const ws = useSeriesWorkspace(seriesId, !!one && !lock);
  const today = home.data?.today ?? '';
  // Once Save is pressed the gate is held: after the add, the reload holds this
  // day, and the screen must not flash "already has a date" on its way to Done.
  const [held, setHeld] = useState<DayGate | null>(null);
  const live = one && ws.data && !lock ? addDayGate(one, ws.data, date, today) : null;
  const gate = held ?? live;

  return (
    <Step title={one?.name ?? 'Add a date'} back={ORG_PATHS.addEvent(seriesId)}>
      {home.isError || ws.isError ? (
        <Failed flow="add" onRetry={() => { void home.refetch(); void ws.refetch(); }} />
      ) : !home.data ? (
        <Loading flow="add" />
      ) : !one ? (
        <Missing flow="add" />
      ) : lock ? (
        <Refusal flow="add" text={lock} back={ORG_PATHS.home} backLabel="Back to Home" />
      ) : !ws.data || !gate ? (
        <Loading flow="add" />
      ) : gate.kind === 'refused' ? (
        <Refusal flow="add" text={gate.text} back={ORG_PATHS.addEvent(seriesId)} backLabel="Other days" />
      ) : (
        <TimeForm series={one} ws={ws.data} date={date} onSend={() => setHeld(gate)} />
      )}
    </Step>
  );
}

function TimeForm({ series, ws, date, onSend }: { series: HomeSeriesFull; ws: SeriesWorkspace; date: string; onSend: () => void }) {
  const navigate = useNavigate();
  const usual = usualTime(series, ws);
  const [value, setValue] = useState(usual);
  const { send, run, busy, conflict, error } = useFlowSend(series.id);
  if (conflict) return <Conflict flow="add" seriesId={series.id} />;
  const ready = value === '' || /^\d{2}:\d{2}$/.test(value);

  // ONE series.add_date. Only a time other than the usual one adds a second
  // write, occurrence.set_time on the new date (add_date takes the day alone).
  const save = () => run(async () => {
    onSend();
    const added = await send(series.id, ws.series.version, addDateCommand(date));
    if (!added) return;
    let shown = usual;
    if (value && value !== usual) {
      const fromReply = added.data?.occurrence_id;
      const occurrenceId = typeof fromReply === 'string'
        ? fromReply
        : (await fetchSeriesWorkspace(series.id)).dates.find((d) => d.occurrence_date === date)?.id;
      if (occurrenceId) {
        const detail = await fetchDateDetail(occurrenceId);
        if (await send(occurrenceId, detail.version, setTimeCommand(value, null))) shown = value;
      }
    }
    goDone(navigate, { title: 'Added', message: addDoneMessage(date, shown), seriesId: series.id });
  });

  return (
    <div className="flex flex-col gap-3" data-testid="add-time-screen">
      <p className="text-[15px] font-semibold text-[var(--fg)]">{dayLabel(date)}</p>
      <input
        type="time"
        aria-label="Start time"
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, 5))}
        data-testid="add-time-input"
        className={cn(FIELD_CLASS, 'h-[52px] text-[16px]')}
      />
      <ErrorLine flow="add" text={error} />
      <PrimaryButton
        testId="add-save"
        aria-disabled={!ready || undefined}
        loading={busy}
        className={cn(!ready && 'cursor-not-allowed opacity-60')}
        onClick={() => { if (ready) void save(); }}
      >
        Save
      </PrimaryButton>
    </div>
  );
}
