import { useState } from 'react';
import { LEVEL_KEYS, LEVEL_LABEL, SESSION_TYPES, TYPE_LABEL, levelsApplyTo } from '../../shared/programmeModel';
import { addRoleFor, typeLabel } from '../../dates/dateModel';
import { emptyForm, useVenueRooms, type SessForm } from '../data/sessions';
import { PeopleGroup } from '../v2/PeopleGroup';
import { V2Sheet } from '../v2/V2Sheet';
import { V2 } from '../v2/copy';
import { PEOPLE_PER_SESSION_MAX } from './model';
import { prefillTeachers, type TeachPerson } from './lastTeachers';

const LEVELS = LEVEL_KEYS.filter((k) => k !== 'open_level');
const isTeaching = (type: string | null) => addRoleFor(type) === 'teaching';

/**
 * Create look slice 3 (VITE_ENABLE_ORGANISER_CREATE_LOOK): the sessions sheet in the edit page's look
 * (SessionSheetV2's fields, classes and copy). Local copy of the forms: Done hands them back, closing drops the edits.
 */
export function SessionsSheetLook({ forms, venueId, teachers, prefill, onDone, onClose }: {
  forms: SessForm[]; venueId: string | null; teachers: boolean; prefill?: { from: string; people: TeachPerson[][] } | null; onDone: (s: SessForm[]) => void; onClose: () => void;
}) {
  const [init] = useState(() => (prefill ? prefillTeachers(forms, prefill.people) : { forms, filled: false }));
  const [rows, setRows] = useState<SessForm[]>(init.forms);
  const rooms = useVenueRooms(venueId).data ?? [];
  const set = (i: number, patch: Partial<SessForm>) => setRows((r) => r.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const toggle = (xs: string[], x: string) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);
  const done = () => onDone(rows.map((s) => {
    const room = rooms.length > 1 ? rooms.find((x) => x.id === s.roomId) : undefined;
    return { ...s, roomId: room?.id ?? null, roomName: room?.name ?? null };
  }));

  return (
    <V2Sheet open title="Sessions" onClose={onClose}>
      {init.filled && prefill && <p className="hint" data-testid="p3-new-sess-prefill">Teachers from {prefill.from}. Remove anyone who isn&rsquo;t teaching.</p>}
      {!rows.length && <p className="hint" data-testid="p3-new-sess-empty">{V2.session.needOne}</p>}
      {rows.map((s, i) => {
        const people = s.people ?? [];
        const full = people.length >= PEOPLE_PER_SESSION_MAX;
        const bad = !!s.start && !!s.end && (s.start === s.end || (s.end < s.start && s.end >= '06:00'));
        return (
          <div key={i} className="p3-stack-s" style={{ display: 'flex', flexDirection: 'column', gap: 14, ...(i ? { borderTop: '1px solid #E9E9E9', paddingTop: 14 } : {}) }} data-testid="p3-new-sess">
            <label className="flab" htmlFor={`p3-new-st-${i}`}>{V2.session.titleLabel}</label>
            <input id={`p3-new-st-${i}`} className="fld" type="text" value={s.title} maxLength={120} placeholder={V2.session.titlePh} onChange={(e) => set(i, { title: e.target.value })} data-testid="p3-new-sess-title" />
            <div className="flab">{V2.session.type}</div>
            <div className="chipsw">
              {SESSION_TYPES.map((t) => (
                <button type="button" key={t} className={`tchip${s.type === t ? ' on' : ''}`} aria-pressed={s.type === t} data-testid={`p3-new-sess-type-${t}`}
                  onClick={() => set(i, { type: t, title: s.title.trim() === (TYPE_LABEL[s.type ?? ''] ?? '') ? TYPE_LABEL[t] : s.title, levels: levelsApplyTo(t) ? s.levels : [], ...(isTeaching(t) ? {} : { people: [] }) })}>{typeLabel(t)}</button>
              ))}
            </div>
            <div className="two">
              <div>
                <label className="flab" htmlFor={`p3-new-ss-${i}`}>{V2.session.starts}</label>
                <input id={`p3-new-ss-${i}`} className="fld" type="time" value={s.start} onChange={(e) => set(i, { start: e.target.value })} data-testid="p3-new-sess-start" />
              </div>
              <div>
                <label className="flab" htmlFor={`p3-new-se-${i}`}>{V2.session.ends}</label>
                <input id={`p3-new-se-${i}`} className="fld" type="time" value={s.end} onChange={(e) => set(i, { end: e.target.value })} data-testid="p3-new-sess-end" />
              </div>
            </div>
            {bad && <p className="err" role="alert">{V2.session.endsBefore}</p>}
            {rooms.length > 1 && (
              <>
                <div className="flab">Room</div>
                <div className="chipsw" role="group" aria-label="Room" data-testid="p3-new-sess-rooms">
                  {rooms.map((r) => (
                    <button type="button" key={r.id} className={`tchip${s.roomId === r.id ? ' on' : ''}`} aria-pressed={s.roomId === r.id}
                      onClick={() => set(i, { roomId: s.roomId === r.id ? null : r.id })}>{r.name}</button>
                  ))}
                </div>
              </>
            )}
            {levelsApplyTo(s.type) && (
              <>
                <div className="flab">{V2.session.level}</div>
                <div className="chipsw">
                  {LEVELS.map((l) => (
                    <button type="button" key={l} className={`tchip${s.levels.includes(l) ? ' on' : ''}`} aria-pressed={s.levels.includes(l)} onClick={() => set(i, { levels: toggle(s.levels, l) })}>{LEVEL_LABEL[l]}</button>
                  ))}
                </div>
              </>
            )}
            {teachers && isTeaching(s.type) && (
              <PeopleGroup
                label="Teachers"
                people={people.map((p) => ({ id: p.profileId, name: p.name, canRemove: true }))}
                role={full ? null : 'teaching'}
                hint={full ? `Up to ${PEOPLE_PER_SESSION_MAX} people on a session.` : undefined}
                onIds={new Set(people.map((p) => p.profileId))}
                onAdd={(p) => set(i, { people: [...people, { profileId: p.id, name: p.name, role: 'teaching' }] })}
                onRemove={(id) => set(i, { people: people.filter((p) => p.profileId !== id) })}
              />
            )}
            <button type="button" className="btn dan" onClick={() => setRows((r) => r.filter((_, j) => j !== i))} data-testid="p3-new-sess-remove">{V2.session.removeThis}</button>
          </div>
        );
      })}
      <button type="button" className="btn sec" onClick={() => setRows((r) => [...r, { ...emptyForm('party'), title: TYPE_LABEL.party }])} data-testid="p3-new-sess-add">Add another</button>
      <button type="button" className="btn pri" onClick={done} data-testid="p3-new-sess-done">{V2.session.done}</button>
    </V2Sheet>
  );
}
