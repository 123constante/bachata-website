import { useState } from 'react';
import { Chip } from '../ui';
import { EventConflict, EventStepShell, SendButton, StepError, useEventSend } from '@/modules/organiser/flows/event';
import { ORG_PATHS } from '../shell';
import type { EventWorkspace } from './eventModel';
import { isOn, musicChips, musicChanged, musicCommand, toggleStyle } from './musicModel';

/** /details?edit=music (SW1): the music styles as chips. One Save, one series.upsert; an untouched Save sends nothing. */
export function MusicEdit({ ws }: { ws: EventWorkspace }) {
  const seriesId = ws.series.id;
  const { sendThenDone, busy, conflict, error } = useEventSend(seriesId);
  const [picked, setPicked] = useState<string[]>(ws.musicStyles);
  const changed = musicChanged(ws, picked);
  const save = () => {
    const command = musicCommand(ws, picked);
    if (command) void sendThenDone(ws.series.version, command, { title: 'Saved', message: 'Saved' });
  };
  return (
    <EventStepShell seriesId={seriesId} title="Music" back={ORG_PATHS.eventDetails(seriesId)}>
      {conflict ? <EventConflict seriesId={seriesId} /> : (
        <>
          <p className="text-[14px] text-[var(--mut)]">Pick every style dancers will hear. Tap again to take one off.</p>
          <div className="flex flex-wrap gap-[8px]" role="group" aria-label="Music styles" data-testid="org-music-chips">
            {musicChips(ws.musicStyles).map((s) => (
              <Chip key={s} selected={isOn(s, picked)} onToggle={() => setPicked((p) => toggleStyle(p, s))} testId="org-music-chip">{s}</Chip>
            ))}
          </div>
          <SendButton label="Save" testId="org-detail-save" reason={changed ? null : 'Nothing changed yet'} busy={busy} onSend={save} />
          <StepError text={error} />
        </>
      )}
    </EventStepShell>
  );
}
