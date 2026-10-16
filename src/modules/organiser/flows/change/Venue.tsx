import { useState } from 'react';
import { Check } from 'lucide-react';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { overrideCommand } from '@/modules/organiser/shared/seriesCommands';
import { useVenueOptions } from '@/modules/organiser/shared/publicVenues';
import { venueOverridePatch } from '@/modules/organiser/dates/venueOverride';
import { SearchField } from '@/modules/organiser/ui';
import { DateStep, type DateStepReady } from './DateStep';
import { venueDoneMessage } from './changeModel';
import { useChangeSend } from './useChange';
import { Conflict, Failed, Loading, SaveButton, StepList, StepRow } from './parts';

/** C5b: a different venue for this one date. Save only once a different venue is picked. */
export default function Venue() {
  return (
    <DateStep back={ORG_PATHS.changeDate}>
      {(ready) => <VenuePicker key={ready.occurrenceId} {...ready} />}
    </DateStep>
  );
}

function VenuePicker({ seriesId, occurrenceId, ws, date, detail }: DateStepReady) {
  const venues = useVenueOptions();
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string | null>(detail.venueId);
  const { send, busy, conflict, error } = useChangeSend(seriesId, occurrenceId);
  if (conflict) return <Conflict seriesId={seriesId} />;

  const term = q.trim().toLowerCase();
  const list = (venues.data ?? [])
    .filter((v) => !term || `${v.name} ${v.city_name ?? ''} ${v.neighbourhood ?? ''}`.toLowerCase().includes(term))
    .slice(0, 40);
  const ready = !!picked && picked !== detail.venueId;

  const save = async () => {
    // The usual venue clears the override (and its city) instead of copying it onto the date.
    const patch = await venueOverridePatch(picked === ws.series.default_venue_id ? null : picked, venues.data);
    await send(overrideCommand(patch), detail.version, venueDoneMessage(date.occurrence_date));
  };

  return (
    <div className="flex flex-col gap-3" data-testid="change-venue-screen">
      <SearchField value={q} onChange={setQ} aria-label="Search venues" placeholder="Search venues" testId="change-venue-search" />
      {venues.isError && !venues.data ? (
        <Failed onRetry={() => void venues.refetch()} />
      ) : !venues.data ? (
        <Loading />
      ) : (
        <StepList testId="change-venue-list">
          {list.map((v) => (
            <StepRow
              key={v.id}
              testId="change-venue-option"
              label={v.name}
              sub={v.id === detail.venueId ? 'Now' : [v.neighbourhood, v.city_name].filter(Boolean).join(', ') || undefined}
              pressed={v.id === picked}
              end={v.id === picked ? <Check aria-hidden="true" className="h-[20px] w-[20px] shrink-0 text-[var(--gold)]" /> : <span />}
              onClick={() => setPicked(v.id)}
            />
          ))}
          {list.length === 0 && <p className="px-3 py-3 text-[14px] text-[var(--mut)]">No venue matches</p>}
        </StepList>
      )}
      <SaveButton ready={ready} reason="Pick a different venue" busy={busy} error={error} onSave={() => void save()} />
    </div>
  );
}
