import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { dateDetailQueryKey, fetchDateDetail } from '@/modules/organiser/shared/selfServeApi';
import { overrideCommand, type OwnerCommand } from '@/modules/organiser/shared/seriesCommands';
import { dayLabel } from '@/modules/organiser/shared/dateList';
import { useVenueOptions } from '@/modules/organiser/shared/publicVenues';
import { venueOverridePatch } from '@/modules/organiser/dates/venueOverride';
import { PrimaryButton } from '@/modules/organiser/ui';
import { DateStep, type DateStepReady } from './DateStep';
import { COPY_NONE, COPY_NONE_KEYS, copyPatches, hasOwnChanges } from './changeModel';
import { useNavigate } from 'react-router-dom';
import { useChangeSend } from './useChange';
import { Failed, Loading, StepList, StepRow } from './parts';
import { EventConflict } from '../event/parts';

const KEY_WORD = { venue_id: 'Venue', description: 'Note', cover_image_url: 'Picture', ticket_url: 'Ticket link' } as const;
export const COPY_SAME = 'This date already has the same changes';
export const copyDoneMessage = (from: string) => `Copied from ${dayLabel(from)}`;

/**
 * C60: copy another date's own changes (venue, note, picture, ticket link:
 * the owner override keys) onto this one, ONE occurrence.set_override per
 * changed key, each against the version the last returned. A date with none
 * of its own is listed but off, with the reason.
 */
export default function Copy() {
  return (
    <DateStep back={ORG_PATHS.changeDate} title={() => 'Copy changes from'}>
      {(ready) => <CopyFrom key={ready.occurrenceId} {...ready} />}
    </DateStep>
  );
}

function CopyFrom({ seriesId, occurrenceId, ws, detail }: DateStepReady) {
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const navigate = useNavigate();
  const venues = useVenueOptions();
  const { sendAll, fail, busy, conflict, error } = useChangeSend(seriesId, occurrenceId);
  const source = useQuery({ queryKey: dateDetailQueryKey(sourceId ?? ''), queryFn: () => fetchDateDetail(sourceId as string), enabled: !!sourceId });
  if (conflict) return <EventConflict seriesId={seriesId} testId="change-conflict" />;
  const others = ws.dates.filter((d) => d.id !== occurrenceId).sort((a, b) => b.occurrence_date.localeCompare(a.occurrence_date));

  if (!sourceId && others.length === 0) {
    return (
      <div className="flex flex-col gap-3" data-testid="change-copy-empty">
        <p className="text-[15px] text-[var(--fg)]">No other dates to copy from yet.</p>
        <PrimaryButton testId="change-copy-add" onClick={() => navigate(ORG_PATHS.addEvent(seriesId))}>Add a date</PrimaryButton>
      </div>
    );
  }
  if (!sourceId) {
    return (
      <StepList testId="change-copy-list">
        {others.map((d) => (
          <StepRow key={d.id} testId="change-copy-source" label={dayLabel(d.occurrence_date)}
            sub={d.has_override ? 'Has its own changes: see which can be copied' : COPY_NONE} disabled={!d.has_override}
            onClick={() => { if (d.has_override) setSourceId(d.id); }} />
        ))}
      </StepList>
    );
  }
  if (source.isError) return <Failed onRetry={() => void source.refetch()} />;
  if (!source.data) return <Loading />;
  const patches = copyPatches(source.data, detail);
  // The venue's city comes from the venue list; never copy a venue without it.
  const needsVenues = patches.some((p) => p.key === 'venue_id');
  if (needsVenues && venues.isError) return <Failed onRetry={() => void venues.refetch()} />;
  const waitReason = needsVenues && !venues.data ? 'Loading the venues' : null;
  const ready = patches.length > 0 && !waitReason;
  const from = source.data.date;

  const copy = async () => {
    setRunning(true);
    try {
      const cmds: OwnerCommand[] = [];
      for (const p of patches) {
        cmds.push(p.key === 'venue_id'
          ? overrideCommand(await venueOverridePatch(p.value, venues.data))
          : overrideCommand({ [p.key]: p.value }));
      }
      await sendAll(cmds, detail.version, copyDoneMessage(from));
    } catch (err) {
      fail(err);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-3" data-testid="change-copy-screen">
      <p className="text-[15px] font-semibold text-[var(--fg)]">From {dayLabel(from)}</p>
      {patches.length ? (
        <ul className="flex flex-col gap-1 text-[14px] text-[var(--fg)]" data-testid="change-copy-keys">
          {patches.map((p) => <li key={p.key}>{KEY_WORD[p.key]}</li>)}
        </ul>
      ) : (
        <p className="text-[14px] text-[var(--mut)]" data-testid="change-copy-same">{hasOwnChanges(source.data) ? COPY_SAME : COPY_NONE_KEYS}</p>
      )}
      {error && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="change-error-message">{error}</p>}
      <PrimaryButton testId="change-copy-confirm" loading={busy || running} aria-disabled={!ready || undefined}
        className={ready ? undefined : 'cursor-not-allowed opacity-60'}
        onClick={() => { if (ready && !busy && !running) void copy(); }}>
        Copy {patches.length === 1 ? 'this change' : `${patches.length} changes`}
      </PrimaryButton>
      {waitReason && <p className="text-[13px] text-[var(--mut)]" data-testid="change-copy-wait">{waitReason}</p>}
      <StepRow testId="change-copy-other" label="Pick another date" onClick={() => setSourceId(null)} />
    </div>
  );
}
