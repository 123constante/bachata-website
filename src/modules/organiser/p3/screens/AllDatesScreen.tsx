import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { londonTodayKey } from '@/lib/londonDate';
import type { EventWorkspace } from '../../events/eventModel';
import { L, addDateWhy } from '../model';
import { partialOf } from '../data/eventPage';
import { allDatesOf, seriesFactsOf, tagClass, type DateEntry, type DateFilter } from '../data/dates';
import { P3_PATHS } from '../shell/paths';
import { DateSheets, type DateOpen } from './DateSheet';
import { WorkspaceGate } from './EventPage';
import { useToast } from './Toast';

/** What an empty filter says, and what the person can do. */
const EMPTY: Record<DateFilter, string> = {
  coming: 'No dates coming up. Add a date so dancers can find it.',
  past: 'No past dates yet. Dates move here once they have happened.',
  cancelled: 'No cancelled dates. A date you cancel shows here, with its reason.',
  breaks: 'No break weeks. Skip a week from its date when it isn\u2019t running.',
  own: 'No date has its own changes. Open a date to change its place, details or time.',
};

function DateRowButton({ e, onOpen }: { e: DateEntry; onOpen: (e: DateEntry) => void }) {
  const off = e.facts.state !== 'scheduled';
  return (
    <li className="p3-row p3-row-btn" data-testid="p3-date-row" data-state={e.facts.state}>
      <button type="button" className="p3-date-btn" onClick={() => onOpen(e)}>
        <span className={`p3-grow p3-row-t ${off ? 'p3-struck' : ''}`}>{e.label}</span>
        {e.tags.map((t) => <span key={t} className={tagClass(t)}>{t}</span>)}
        <span aria-hidden="true">&rsaquo;</span>
      </button>
    </li>
  );
}

function AllDates({ ws }: { ws: EventWorkspace }) {
  const today = londonTodayKey();
  const [filter, setFilter] = useState<DateFilter>('coming');
  const [open, setOpen] = useState<DateOpen>(null);
  const toast = useToast(ws.series.id, ws.series.version);
  const close = useCallback(() => setOpen(null), [setOpen]);
  const view = allDatesOf(ws, today, filter);
  const addWhy = addDateWhy(seriesFactsOf(ws, today));
  const partial = partialOf(ws);
  const name = ws.series.name.trim() || L.noName;
  return (
    <div className="p3-stack" data-testid="p3-all-dates-screen">
      <Link className="p3-link" to={P3_PATHS.event(ws.series.id)}>&larr; {name}</Link>
      <h2 className="p3-name">{L.allDates}</h2>
      <div className="p3-seg" role="group" aria-label={L.allDates} data-testid="p3-date-filters">
        {L.dateFilters.map(([k, label]) => (
          <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} data-testid={`p3-filter-${k}`}>
            {label} <span className="p3-num">{view.counts[k]}</span>
          </button>
        ))}
      </div>
      {partial && <p className="p3-note" data-testid="p3-partial">{partial}</p>}
      <div className="p3-card p3-tight">
        {view.rows.length ? (
          <ul className="p3-list p3-flush" data-testid="p3-date-list">
            {view.rows.map((e) => (
              <DateRowButton key={e.id ?? `break-${e.date}`} e={e}
                onOpen={(x) => setOpen(x.id ? { kind: 'date', id: x.id } : { kind: 'break', date: x.date })} />
            ))}
          </ul>
        ) : (
          <div className="p3-state" data-testid="p3-dates-empty"><p>{EMPTY[filter]}</p></div>
        )}
      </div>
      <button type="button" className="p3-btn" disabled={!!addWhy} onClick={() => setOpen({ kind: 'add' })} data-testid="p3-add-date">{L.addDate}</button>
      {addWhy && <p className="p3-note" data-testid="p3-add-why">{addWhy}</p>}
      <DateSheets ws={ws} today={today} open={open} onClose={close} onDone={(d) => { setOpen(null); toast.show(d); }} />
      {toast.node}
    </div>
  );
}

/** C3 All dates (W2b): every date the read holds, filtered; "100 of N" said honestly, never paged from a second read. */
export function AllDatesScreen() {
  return <WorkspaceGate>{(ws) => <AllDates ws={ws} />}</WorkspaceGate>;
}
