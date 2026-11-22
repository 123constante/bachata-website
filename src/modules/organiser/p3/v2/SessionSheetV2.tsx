import { useState } from 'react';
import {
  LEVEL_KEYS, LEVEL_LABEL, SESSION_TYPES, isEditableRole, levelsApplyTo, removePerson,
  type DraftPerson, type DraftSession, type PeopleRole,
} from '../../shared/programmeModel';
import { addRoleFor, onSessionIds, pickPerson, typeLabel } from '../../dates/dateModel';
import { PeopleGroup, type GroupPerson } from './PeopleGroup';
import { V2Sheet } from './V2Sheet';
import { V2 } from './copy';

const LEVELS = LEVEL_KEYS.filter((k) => k !== 'open_level');
const GROUP_LABEL: Record<PeopleRole, string> = { teaching: 'Teachers', djing: 'DJs' };

export interface SessionSheetProps {
  /** null = a new session. */
  row: DraftSession | null;
  /** Sessions on this screen (Remove is disabled at 1 or fewer). */
  count: number;
  ctx: 'night' | 'usual';
  /** "Thursday 26 November" for a night, "Thursday" for the usual week. */
  dayLabel: string;
  onDone: (row: DraftSession) => void;
  onRemove: (row: DraftSession) => void;
  onClose: () => void;
}

export interface Group {
  label: string;
  /** null = show only: no picker, no Add. */
  role: PeopleRole | null;
  /** Which stored roles belong in this group. */
  match: (role: string | null) => boolean;
  /** Chips carry an x only when the group is editable. */
  editable: boolean;
  hint?: string;
}

/** The people groups a session draws: Class/Masterclass Teachers, Party DJs (+ old Dancers), Performance Dancers (show only). */
export function groupsFor(type: string | null, people: DraftPerson[] = []): Group[] {
  const role = addRoleFor(type);
  const others = (r: string | null) => !isEditableRole(r);
  if (role) {
    const g: Group = { label: GROUP_LABEL[role], role, match: (r) => r === role, editable: true };
    const oldDancers = type === 'party' && people.some((p) => !p.removed && others(p.role));
    return oldDancers ? [g, { label: 'Dancers', role: null, match: others, editable: false, hint: V2.session.partyDancers }] : [g];
  }
  if (type === 'performance') return [{ label: 'Dancers', role: null, match: others, editable: false, hint: V2.session.teamAdds }];
  return [];
}

/** What a type change would remove: people in groups the new type no longer has, plus the levels. Pure; nothing is removed here. */
export function lostOnTypeChange(row: Pick<DraftSession, 'people' | 'levels'>, type: string | null): string[] {
  const role = addRoleFor(type);
  const lost = (row.people ?? []).filter((p) => !p.removed && isEditableRole(p.role) && p.role !== role).map((p) => p.name);
  const lv = levelsApplyTo(type) ? [] : row.levels.filter((l) => l !== 'open_level');
  if (lv.length > 0) lost.push(`${lv.map((l) => LEVEL_LABEL[l as keyof typeof LEVEL_LABEL] ?? l).join(', ')} level`);
  return lost;
}

/** The sheet's time check: empty, equal, or an end before the start from 06:00 on is a problem; before 06:00 is a night past midnight. */
export function timesProblem(start: string, end: string): boolean {
  if (!start || !end || start === end) return true;
  return end < start && end >= '06:00';
}

/** SH-SES: add, change or remove one class or party. Controlled: it hands the finished row back and saves nothing. */
export function SessionSheetV2({ row, count, ctx: _ctx, dayLabel: _dayLabel, onDone, onRemove, onClose }: SessionSheetProps) {
  const [d, setD] = useState<DraftSession>(() => row ?? { key: 'new', original: null, type: 'class', title: '', start: '', end: '', levels: [], removed: false, people: [] });
  const [tried, setTried] = useState(false);
  const isNew = !row;
  const locked = !!d.original; // a stored session keeps its stored type (setSessionType rule)
  const title = isNew ? V2.session.addTitle : d.title || typeLabel(d.type);
  const people = d.people ?? [];
  const lost = lostOnTypeChange(d, d.type);
  const err = tried && timesProblem(d.start, d.end);

  const setType = (t: string) => { if (!locked) setD((r) => ({ ...r, type: t })); };
  const toggle = (l: string) => setD((r) => ({ ...r, levels: r.levels.includes(l) ? r.levels.filter((x) => x !== l) : [...r.levels, l] }));
  const done = () => {
    if (timesProblem(d.start, d.end)) { setTried(true); return; }
    let out = d;
    const role = addRoleFor(d.type);
    for (let i = (out.people ?? []).length - 1; i >= 0; i -= 1) {
      const p = (out.people ?? [])[i];
      if (!p.removed && isEditableRole(p.role) && p.role !== role) out = removePerson(out, i);
    }
    out = { ...out, title: d.title.trim() || typeLabel(d.type), levels: levelsApplyTo(d.type) ? d.levels : [] };
    onDone(out);
  };

  return (
    <V2Sheet open title={title} onClose={onClose}>
      <label className="flab" htmlFor="ses-title">{V2.session.titleLabel}</label>
      <input id="ses-title" className="fld" type="text" value={d.title} placeholder={V2.session.titlePh} onChange={(e) => setD((r) => ({ ...r, title: e.target.value }))} />
      <div className="flab">{V2.session.type}</div>
      <div className="chipsw">
        {SESSION_TYPES.map((t) => (
          <button type="button" key={t} className={`tchip${d.type === t ? ' on' : ''}`} aria-pressed={d.type === t} disabled={locked && d.type !== t} onClick={() => setType(t)}>{typeLabel(t)}</button>
        ))}
      </div>
      <div className="two">
        <div>
          <label className="flab" htmlFor="ses-start">{V2.session.starts}</label>
          <input id="ses-start" className="fld" type="time" value={d.start} onChange={(e) => setD((r) => ({ ...r, start: e.target.value }))} />
        </div>
        <div>
          <label className="flab" htmlFor="ses-end">{V2.session.ends}</label>
          <input id="ses-end" className="fld" type="time" value={d.end} onChange={(e) => setD((r) => ({ ...r, end: e.target.value }))} />
        </div>
      </div>
      {err && <p className="err" role="alert">{V2.session.endsBefore}</p>}
      {levelsApplyTo(d.type) && (
        <>
          <div className="flab">{V2.session.level}</div>
          <div className="chipsw">
            {LEVELS.map((l) => (
              <button type="button" key={l} className={`tchip${d.levels.includes(l) ? ' on' : ''}`} aria-pressed={d.levels.includes(l)} onClick={() => toggle(l)}>{LEVEL_LABEL[l]}</button>
            ))}
          </div>
        </>
      )}
      {groupsFor(d.type, people).map((g) => {
        const shown: GroupPerson[] = [];
        const idx = new Map<string, number>();
        people.forEach((p, i) => {
          if (p.removed || !g.match(p.role)) return;
          idx.set(p.id, i);
          shown.push({ id: p.id, name: p.name, canRemove: g.editable && isEditableRole(p.role) });
        });
        return (
          <PeopleGroup
            key={g.label}
            label={g.label}
            people={shown}
            role={g.role}
            hint={g.hint}
            onIds={onSessionIds(d)}
            onAdd={(p) => setD((r) => pickPerson(r, p))}
            onRemove={(id) => setD((r) => { const i = (r.people ?? []).findIndex((p) => p.id === id); return i < 0 ? r : removePerson(r, i); })}
          />
        );
      })}
      {lost.length > 0 && <p className="warn">{V2.session.willRemove(lost.join(', '))}</p>}
      <button type="button" className="btn pri" onClick={done}>{V2.session.done}</button>
      {row && (
        <>
          <button type="button" className="btn dan" disabled={count <= 1} onClick={() => onRemove(d)}>{V2.session.removeThis}</button>
          {count <= 1 && <p className="hint">{V2.session.needOne}</p>}
        </>
      )}
    </V2Sheet>
  );
}
