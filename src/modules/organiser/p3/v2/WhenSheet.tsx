import { useState } from 'react';
import { LEVEL_LABEL, buildPayload, notEditableCopy, validateProgramme, type DraftSession } from '../../shared/programmeModel';
import { moveDateCommand } from '../../shared/seriesCommands';
import { fullDate } from '../../shared/dateWords';
import type { WorkspaceDate } from '../../shared/seriesModel';
import { typeLabel } from '../../dates/dateModel';
import { draftsOf, useDateProgramme } from '../data/sessions';
import { SessionSheetV2 } from './SessionSheetV2';
import { V2Sheet } from './V2Sheet';
import { V2 } from './copy';
import { nightSessionsOff, type WriteStep } from './editorModel';
import { flags } from '@/lib/featureFlags';
import { FWD, buildForward, forwardLabel, laterNights, teachersChanged } from './forwardTeachers';

const W = V2.whenSheet;

/** Saves through the shell's saveNow (which shows the toast and Undo). */
export type OnSave = (
  steps: WriteStep[], before: (Record<string, unknown> | null)[], label: string, opts?: { noUndo?: boolean },
) => Promise<{ ok: boolean; error: string | null }>;

const hm = (t: string) => t.slice(0, 5);

/** "Class · Carlos & Ana · Beginner": type, names, levels; empty parts left out. */
export function rowLine(r: DraftSession): string {
  const names = (r.people ?? []).filter((p) => !p.removed).map((p) => p.name.trim()).filter(Boolean).join(' & ');
  const levels = r.levels.map((l) => LEVEL_LABEL[l as keyof typeof LEVEL_LABEL] ?? l).join(', ');
  return [typeLabel(r.type), names, levels].filter(Boolean).join(' · ');
}

const visible = (rows: DraftSession[]) => rows.filter((r) => !r.removed).sort((a, b) => a.start.localeCompare(b.start));

/** The shared list: one row per class or party, sorted by start, removed ones hidden. */
export function SessionRows({ rows, onOpen }: { rows: DraftSession[]; onOpen: (r: DraftSession) => void }) {
  return (
    <div className="card" data-testid="when-rows">
      {visible(rows).map((r) => (
        <button key={r.key} type="button" className="row" data-testid="when-row" onClick={() => onOpen(r)}>
          <span>
            <b>{r.title.trim() || typeLabel(r.type)}</b>
            <span className="hint" style={{ display: 'block', margin: 0 }}>{rowLine(r)}</span>
          </span>
          <span className="v">{r.end ? V2.timeRange(hm(r.start), hm(r.end)) : hm(r.start)} &rsaquo;</span>
        </button>
      ))}
    </div>
  );
}

/** SH-WHEN: this night's date (one-off only) and its classes and party. Saves at once through onSave. */
export function WhenSheet({ date, oneOff, today, onSave, onClose, laterDates }: {
  date: WorkspaceDate; laterDates?: WorkspaceDate[]; oneOff: boolean; today: string; onSave: OnSave; onClose: () => void;
}) {
  const why = nightSessionsOff(date, today, false);
  const prog = useDateProgramme(why ? null : date.id);
  const readOnly = prog.data && !prog.data.editable ? notEditableCopy(prog.data.notEditableReason) : null;
  const blocked = why ?? readOnly;
  const original = prog.data ? draftsOf(prog.data) : [];
  const shown = visible(original);
  const long = fullDate(date.occurrence_date);
  const [editing, setEditing] = useState<{ row: DraftSession | null } | null>(null);
  const [dateVal, setDateVal] = useState(date.occurrence_date);
  const [dateErr, setDateErr] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [ask, setAsk] = useState<{ next: DraftSession[]; edited: DraftSession; later: WorkspaceDate[] } | null>(null);
  const [askBusy, setAskBusy] = useState(false);

  const save = async (next: DraftSession[]): Promise<boolean> => {
    if (!prog.data) return false;
    const bad = validateProgramme(next).rows[0];
    if (bad) { setProblem(bad.message); return false; }
    const step: WriteStep = { part: V2.nightSessions, target: 'programme', id: date.id, version: prog.data.version, command: null, payload: buildPayload(next), order: 2 };
    const r = await onSave([step], [{ payload: buildPayload(original) }], V2.session.savedNight(long));
    setProblem(r.ok ? null : r.error);
    return r.ok;
  };
  const onDone = (row: DraftSession) => {
    const was = editing?.row;
    setEditing(null);
    if (flags.organiserTeachersForward && !oneOff && was && laterDates && teachersChanged(was, row)) {
      const later = laterNights(laterDates, date, today);
      if (later.length > 0) { setAsk({ next: original.map((r) => (r.key === was.key ? row : r)), edited: row, later }); return; }
    }
    void save(editing?.row ? original.map((r) => (r.key === editing.row?.key ? row : r)) : [...original, row]);
  };
  const saveForward = async () => {
    if (!ask || !prog.data) return;
    const bad = validateProgramme(ask.next).rows[0];
    if (bad) { setAsk(null); setProblem(bad.message); return; }
    setAskBusy(true);
    const fwd = await buildForward(ask.edited, ask.later);
    const step: WriteStep = { part: V2.nightSessions, target: 'programme', id: date.id, version: prog.data.version, command: null, payload: buildPayload(ask.next), order: 2 };
    const r = await onSave([step, ...fwd.steps], [{ payload: buildPayload(original) }, ...fwd.before], forwardLabel(1 + fwd.changed, fwd.skipped));
    setAskBusy(false);
    setProblem(r.ok ? null : r.error);
    setAsk(null);
  };
  const justThis = () => { const next = ask?.next; setAsk(null); if (next) void save(next); };
  const onRemove = (row: DraftSession) => {
    setEditing(null);
    if (!row.original) return;
    // row 48: Remove closes the session sheet AND this sheet back to the tab (toast + Undo come from onSave)
    void save(original.map((r) => (r.key === row.key ? { ...r, removed: true } : r))).then((ok) => { if (ok) onClose(); });
  };
  const saveDate = async () => {
    if (!dateVal) { setDateErr(true); return; }
    setDateErr(false);
    if (dateVal === date.occurrence_date) { onClose(); return; }
    const step: WriteStep = { part: W.date, target: 'occurrence', id: date.id, version: date.version, command: moveDateCommand(dateVal), order: 1 };
    const r = await onSave([step], [{ to_date: date.occurrence_date }], W.saved);
    if (r.ok) onClose(); else setProblem(r.error);
  };

  return (
    <V2Sheet open title={V2.when} onClose={onClose}>
      {oneOff ? (
        <div className="grp">
          <label className="flab" htmlFor="w-date">{W.date}</label>
          <input id="w-date" type="date" className="fld" value={dateVal} onChange={(e) => setDateVal(e.target.value)} />
          {dateErr && <p className="err" role="alert">{W.addDate}</p>}
          <button type="button" className="btn sec" onClick={() => void saveDate()}>{W.saveDate}</button>
        </div>
      ) : <p className="txt" data-testid="when-long"><b>{long}</b></p>}
      {blocked ? <p className="hint" data-testid="when-why">{blocked}</p> : (
        <div className="grp">
          <div className="flab">{W.tapToChange}</div>
          {prog.isPending && <p className="hint">{W.loading}</p>}
          {prog.data && <SessionRows rows={original} onOpen={(r) => setEditing({ row: r })} />}
          <button type="button" className="btn sec" disabled={!prog.data} onClick={() => setEditing({ row: null })}>{W.add}</button>
          <p className="hint">{W.foot}</p>
        </div>
      )}
      {problem && <p className="err" role="alert" data-testid="when-problem">{problem}</p>}
      {editing && (
        <SessionSheetV2 row={editing.row} count={shown.length} ctx="night" dayLabel={long}
          onDone={onDone} onRemove={onRemove} onClose={() => setEditing(null)} />
      )}
      {ask && (
        <V2Sheet open title={FWD.title} onClose={() => setAsk(null)}>
          <div className="grp">
            <button type="button" className="btn sec" style={{ minHeight: 48 }} disabled={askBusy} onClick={justThis}>{FWD.justThis}</button>
            <button type="button" className="btn pri" style={{ minHeight: 48 }} disabled={askBusy} onClick={() => void saveForward()}>{askBusy ? FWD.saving : FWD.allLater}</button>
            <p className="hint">{FWD.laterCount(ask.later.length)}</p>
          </div>
        </V2Sheet>
      )}
    </V2Sheet>
  );
}

/** SH-PROG: "Classes and party", the usual night. Controlled; saving is slice 10's. */
export function ProgSheet({ rows, oneOff, onOpenSession, onClose }: {
  rows: DraftSession[]; oneOff: boolean; onOpenSession: (row: DraftSession | null) => void; onClose: () => void;
}) {
  return (
    <V2Sheet open title={W.progTitle} onClose={onClose}>
      <p className="hint">{oneOff ? W.progHintOneOff : W.progHintWeekly}</p>
      <SessionRows rows={rows} onOpen={onOpenSession} />
      <button type="button" className="btn sec" onClick={() => onOpenSession(null)}>{W.add}</button>
      <button type="button" className="btn pri" onClick={onClose}>{W.done}</button>
    </V2Sheet>
  );
}
