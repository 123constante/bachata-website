import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { londonTodayKey } from '@/lib/londonDate';
import type { EventWorkspace } from '../../events/eventModel';
import { L, addDateWhy } from '../model';
import { partialOf } from '../data/eventPage';
import { allDatesOf, emptyDatesCopy, olderDatesNote, seriesFactsOf, tagClass, type DateEntry, type DateFilter } from '../data/dates';
import { useOlderDates, withOlder } from '../data/olderDates';
import { P3_PATHS } from '../shell/paths';
import { DateSheets, type DateOpen } from './DateSheet';
import { WorkspaceGate } from './EventPage';
import { RetryButton } from './parts';
import { useToast } from './Toast';

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

const LOAD_OLDER = 'Load older dates';

function AllDates({ ws: ws0 }: { ws: EventWorkspace }) {
  const today = londonTodayKey();
  const [filter, setFilter] = useState<DateFilter>('coming');
  const [open, setOpen] = useState<DateOpen>(null);
  const toast = useToast(ws0.series.id, ws0.series.version);
  const close = useCallback(() => setOpen(null), [setOpen]);
  // F-27: older dates load when the person taps for them; the sheets then see every date
  const [wantOlder, setWantOlder] = useState(false);
  const older = useOlderDates(ws0, wantOlder);
  const ws = older.data ? withOlder(ws0, older.data) : ws0;
  const view = allDatesOf(ws, today, filter);
  const addWhy = addDateWhy(seriesFactsOf(ws, today));
  // an older read sends no next_before: it can only say so (partialOf), not page
  // F6: when the page guard stopped the walk, tapping again does nothing, so no button
  const stopped = !!older.data && !older.data.complete;
  const canPage = ws.hasMore && !!ws0.nextBefore && !stopped;
  // F1: after a failed older read the button is not on screen, so the note must not name it
  const partial = canPage && !older.isError ? olderDatesNote(ws, LOAD_OLDER) : partialOf(ws);
  const name = ws.series.name.trim() || L.noName;
  return (
    <div className="p3-stack" data-testid="p3-all-dates-screen">
      <Link className="p3-link" to={P3_PATHS.event(ws.series.id)}>&larr; {name}</Link>
      <h2 className="p3-name">{L.allDates}</h2>
      <div className="p3-seg" role="group" aria-label={L.allDates} data-testid="p3-date-filters">
        {L.dateFilters.map(([k, label]) => (
          <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} data-testid={`p3-filter-${k}`}>
            {label} <span className="p3-num">{view.counts[k]}{view.atLeast.includes(k) ? '+' : ''}</span>
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
          <div className="p3-state" data-testid="p3-dates-empty"><p>{emptyDatesCopy(ws, today, filter)}</p></div>
        )}
      </div>
      {older.isError && !older.isFetching ? (
        <div className="p3-state" data-testid="p3-older-error">
          <p>Older dates didn&rsquo;t load. Check your connection, then try again.</p>
          <RetryButton onClick={() => void older.refetch()} />
        </div>
      ) : canPage && (
        <button type="button" className="p3-btn p3-btn-line" disabled={older.isFetching} onClick={() => setWantOlder(true)} data-testid="p3-load-older">
          {older.isFetching ? <>Loading older dates&hellip;</> : LOAD_OLDER}
        </button>
      )}
      <button type="button" className="p3-btn" disabled={!!addWhy} onClick={() => setOpen({ kind: 'add' })} data-testid="p3-add-date">{L.addDate}</button>
      {addWhy && <p className="p3-note" data-testid="p3-add-why">{addWhy}</p>}
      <DateSheets ws={ws} today={today} open={open} onClose={close} onDone={(d) => { setOpen(null); toast.show(d); }} />
      {toast.node}
    </div>
  );
}

/** C3 All dates (W2b): every date, filtered; past the newest 100 a tap loads the older ones (F-27). */
export function AllDatesScreen() {
  return <WorkspaceGate>{(ws) => <AllDates ws={ws} />}</WorkspaceGate>;
}
