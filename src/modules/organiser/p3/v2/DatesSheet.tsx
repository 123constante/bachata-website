import { useState } from 'react';
import { fullDate } from '../../shared/dateWords';
import type { WorkspaceDate } from '../../shared/seriesModel';
import { V2 } from './copy';
import { DATE_TAG_WORD, dateTagOf } from './editorModel';
import { V2Sheet } from './V2Sheet';

export const DATES_SHEET_ROWS = 12;

/** Sheet "All dates": the first 12 coming nights (the read holds at most the newest 100). */
export function DatesSheet({ open, dates, seriesStatus, onPick, onClose, onAdd, minDate }: {
  open: boolean; dates: readonly WorkspaceDate[]; seriesStatus: string; onPick: (id: string) => void; onClose: () => void;
  /** Adds one date (series.add_date). Only offered while there are no upcoming dates. */
  onAdd?: (date: string) => Promise<{ ok: boolean; error: string | null }>; minDate?: string;
}) {
  const [val, setVal] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const empty = dates.length === 0;
  const add = async () => {
    if (!onAdd || !val) return;
    const r = await onAdd(val);
    if (r.ok) { setVal(''); setProblem(null); onClose(); } else setProblem(r.error);
  };
  return (
    <V2Sheet open={open} title={V2.allDates} onClose={onClose}>
      {empty ? <p className="hint" data-testid="dates-empty">{V2.noUpcomingDates}</p> : <p className="hint">{V2.allDatesHint}</p>}
      {empty && onAdd && (
        <div className="grp">
          <label className="flab" htmlFor="dates-add">{V2.addADate}</label>
          <input id="dates-add" type="date" className="fld" min={minDate} value={val} onChange={(e) => setVal(e.target.value)} data-testid="dates-add-input" />
          <button type="button" className="btn sec" disabled={!val} data-testid="dates-add-go" onClick={() => void add()}>{V2.addADate}</button>
          {problem && <p className="err" role="alert" data-testid="dates-add-problem">{problem}</p>}
        </div>
      )}
      <div className="card">
        {dates.slice(0, DATES_SHEET_ROWS).map((d) => {
          const tag = dateTagOf(d, seriesStatus);
          const word = tag === 'cancelled' || tag === 'changed' ? DATE_TAG_WORD[tag] : '';
          return (
            <button key={d.id} type="button" className="row" data-testid="dates-row" onClick={() => onPick(d.id)}>
              <span><b>{fullDate(d.occurrence_date).replace(/ \d{4}$/, '')}</b></span>
              <span className="v">{word}</span>
              <span className="chev">&rsaquo;</span>
            </button>
          );
        })}
      </div>
    </V2Sheet>
  );
}
