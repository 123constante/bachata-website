import { useState } from 'react';
import { V2Sheet } from './V2Sheet';
import { PeopleGroup } from './PeopleGroup';
import { V2 } from './copy';
import {
  ADD_NONE_LEFT, LAST_ORGANISER_REASON, addablePages, addOrganiser, organisersCommand, organisersOff, removeOff, removeOrganiser, type MyPage,
} from '../../events/organisersModel';
import { useSeriesRole } from '../../events/programmeSeriesApi';
import type { OwnerCommand } from '../../shared/seriesCommands';

const E = V2.every;
const NONE = new Set<string>();

/**
 * SH-ORG: who runs the event. Add is a select of the viewer's OWN live pages (AW1: a page you do not run cannot be
 * linked), not free text. Read-only reasons show as the hint. Unchanged = closes with no save.
 */
export function OrgSheet({ stored, names, seriesId, lifecycle, onSave, onClose }: {
  stored: string[]; names: Record<string, string>; seriesId: string; lifecycle: string;
  onSave: (command: OwnerCommand, ids: string[]) => void | Promise<unknown>; onClose: () => void;
}) {
  const { role, myPages: home } = useSeriesRole(seriesId);
  const myPages = home as unknown as MyPage[];
  const canEdit = role === 'owner' || role === 'manager';
  const [ids, setIds] = useState<string[]>(stored);
  const [choice, setChoice] = useState('');
  const off = organisersOff({ lifecycle, canEdit });
  const offer = addablePages(myPages, ids);
  const known = (id: string) => names[id] ?? myPages.find((p) => p.id === id)?.name ?? E.orgFallback;
  const lastOff = !off && removeOff(ids);
  const people = ids.map((id) => ({ id, name: known(id), canRemove: !off && !removeOff(ids) }));
  const add = () => { if (choice) { setIds((c) => addOrganiser(c, choice)); setChoice(''); } };
  const done = () => {
    const command = off ? null : organisersCommand(stored, ids);
    if (!command) { onClose(); return; }
    void onSave(command, ids);
  };
  return (
    <V2Sheet open title={E.organisers} onClose={onClose}>
      <PeopleGroup label={E.orgGroup} people={people} role={null} onIds={NONE} hint={off ?? (lastOff ? LAST_ORGANISER_REASON : undefined)} onAdd={() => undefined} onRemove={(id) => setIds((c) => removeOrganiser(c, id))} />
      {!off && (offer.length === 0 ? <p className="hint" data-testid="org-add-empty">{ADD_NONE_LEFT}</p> : (
        <div className="pickrow">
          <select className="fld" aria-label={E.orgPageLabel} value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="">{E.orgChoose}</option>
            {offer.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button type="button" className="btn sec addb" disabled={!choice} onClick={add}>{E.orgAdd}</button>
        </div>
      ))}
      <button type="button" className="btn pri" data-testid="org-done" onClick={done}>{E.orgDone}</button>
    </V2Sheet>
  );
}
