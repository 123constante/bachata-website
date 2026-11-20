import { useState } from 'react';
import type { EventWorkspace } from '../../events/eventModel';
import { useVenueOptions } from '../../shared/publicVenues';
import { fullDate } from '../../shared/dateWords';
import { londonTodayKey } from '@/lib/londonDate';
import { detailsDraftOf, detailsPlan } from '../data/details';
import { useLeave, type Ask } from '../screens/EditTray';
import { useVenueCity } from '../screens/DetailsScreen';
import { V2 } from './copy';
import { changeList, summaryOf, writePlan, type EventFields } from './editorModel';
import { useEditorDraft } from './editorDraft';
import { UnsavedSheet, useV2Save, useV2Toast } from './SaveBar';

export const fieldsOf = (ws: EventWorkspace): EventFields => ({ name: ws.series.name ?? '', about: ws.series.default_description ?? '', venueId: ws.series.default_venue_id });

/**
 * The one v2 editor state for an event (handover item 7): the shared draft, its change list and write plan
 * (event-wide, then nights, then sessions), the save run, Undo, the toast and the leave ask. The event page
 * and every night screen call this, so one save bar holds every change and saves them all in order.
 */
export function useEditor(ws: EventWorkspace, opts: { uploading?: boolean } = {}) {
  const id = ws.series.id;
  const today = londonTodayKey();
  const { draft, update, clear } = useEditorDraft(id);
  const base = fieldsOf(ws);
  const f: EventFields = { ...base, ...draft.event };
  const dayOf = (occ: string) => { const d = ws.dates.find((x) => x.id === occ); return d ? fullDate(d.occurrence_date, today) : occ; };
  const orderOf = (occ: string) => ws.dates.find((x) => x.id === occ)?.occurrence_date ?? occ;
  const changes = changeList(base, draft, dayOf, orderOf);
  const dirty = changes.length > 0 || !!opts.uploading;
  const venues = useVenueOptions();
  const city = useVenueCity(draft.event.venueId !== undefined && draft.event.venueId !== base.venueId ? f.venueId : null, venues.data);
  const detailsBase = detailsDraftOf(ws);
  const eventCommands = detailsPlan(detailsBase, { ...detailsBase, name: f.name, description: f.about, venueId: f.venueId }, city.id);
  const steps = writePlan(id, eventCommands, draft, ws.dates, dayOf, orderOf);
  const save = useV2Save(id, ws.series.version);
  const toast = useV2Toast();
  const [ask, setAsk] = useState<Ask>(null);
  useLeave(dirty, setAsk);
  const nameProblem = f.name.trim().length === 0 ? 'Add a name.' : null;
  const why = opts.uploading ? 'Wait for the picture to finish uploading.'
    : changes.length && city.problem && draft.event.venueId !== undefined ? city.problem
      : changes.length ? nameProblem : null;

  const undo = () => { const s = summaryOf(changes); clear(); save.forget(); if (s) toast.show(V2.undone(s)); };
  const doSave = async () => { const ok = await save.run(steps); if (ok) { clear(); toast.show(V2.saved); } return ok; };
  const leaveSheet = ask?.kind === 'leave' ? (
    <UnsavedSheet busy={save.busy} onKeep={() => setAsk(null)}
      onThrow={() => { const go = ask.go; clear(); save.forget(); setAsk(null); go(); }}
      onSave={() => { const go = ask.go; void doSave().then((ok) => { setAsk(null); if (ok) go(); }); }} />
  ) : null;
  return { id, today, draft, update, base, f, venues, city, changes, dirty, steps, save, toast, why, undo, doSave, leaveSheet, dayOf };
}
