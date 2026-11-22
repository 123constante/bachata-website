import { fullDate } from '../../shared/dateWords';
import type { WorkspaceDate } from '../../shared/seriesModel';
import { V2 } from './copy';
import { DATE_TAG_WORD, dateTagOf } from './editorModel';
import { V2Sheet } from './V2Sheet';

export const DATES_SHEET_ROWS = 12;

/** Sheet "All dates": the first 12 coming nights (the read holds at most the newest 100). */
export function DatesSheet({ open, dates, seriesStatus, onPick, onClose }: {
  open: boolean; dates: readonly WorkspaceDate[]; seriesStatus: string; onPick: (id: string) => void; onClose: () => void;
}) {
  return (
    <V2Sheet open={open} title={V2.allDates} onClose={onClose}>
      <p className="hint">{V2.allDatesHint}</p>
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
