import { useState } from 'react';
import { V2Sheet } from './V2Sheet';
import { V2 } from './copy';
import { fullDate, WEEKDAY_NAMES } from '../../shared/dateWords';
import { endWithinCap } from '../../events/dateCap';
import { weekdayOfKey } from '@/lib/londonDate';

const E = V2.every;

/** A night that has its own changes and would stop existing under the new repeat. */
export interface LostNight { id: string; date: string; word: string }

/** SH-REPEAT: "Repeats" sheet (day + last date), then "Change repeat?" when own-change nights would be removed. */
export function RepeatSheetV2({ day, endedOn, startDate, today, lostFor, onSave, onClose }: {
  day: number; endedOn: string | null; startDate: string; today: string;
  /** The own-change nights the new pattern would remove (sorted). */
  lostFor: (day: number, end: string | null) => LostNight[];
  onSave: (day: number, end: string | null) => void | Promise<unknown>; onClose: () => void;
}) {
  const [d, setD] = useState(day);
  const [end, setEnd] = useState(endedOn ?? '');
  const [lost, setLost] = useState<LostNight[] | null>(null);
  const endVal = end || null;
  const problem = !endVal ? null
    : weekdayOfKey(endVal) !== d ? V2.lastDateWeekday(WEEKDAY_NAMES[d])
    : endVal < today ? V2.lastDatePast
    : !endWithinCap({ today, startDate }, endVal) ? E.repeatCap
    : null;
  const done = () => {
    if (problem) return;
    if (d === day && endVal === endedOn) { onClose(); return; }
    const l = lostFor(d, endVal);
    if (l.length === 0) { void onSave(d, endVal); return; }
    setLost(l);
  };
  if (lost) {
    return (
      <V2Sheet open title={E.changeRepeatTitle} onClose={onClose}>
        <div className="grp">
          <p className="txt">{E.changeRepeatText}</p>
          <div className="card"><div className="fb-list">
            {lost.map((n) => (
              <div className="trow" key={n.id} data-testid="lost-row"><b>{fullDate(n.date, today)}</b><span>{n.word}</span></div>
            ))}
          </div></div>
          <button type="button" className="btn dan solid" data-testid="repeat-change" onClick={() => void onSave(d, endVal)}>{E.changeRepeatGo}</button>
          <button type="button" className="btn sec" data-testid="repeat-keep" onClick={onClose}>{E.changeRepeatKeep}</button>
        </div>
      </V2Sheet>
    );
  }
  return (
    <V2Sheet open title={E.repeats} onClose={onClose}>
      <div className="grp">
        <label className="fld"><span className="lab">{E.repeatEvery}</span>
          <select aria-label={E.repeatEvery} value={d} onChange={(e) => setD(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 0].map((n) => <option key={n} value={n}>{WEEKDAY_NAMES[n]}</option>)}
          </select>
        </label>
        <label className="fld"><span className="lab">{E.repeatLast}</span>
          <input type="date" aria-label={E.repeatLast} value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
        {problem && <p className="txt" role="alert" data-testid="repeat-error">{problem}</p>}
        <button type="button" className="btn pri" data-testid="repeat-done" disabled={!!problem} onClick={done}>{E.repeatDone}</button>
      </div>
    </V2Sheet>
  );
}
