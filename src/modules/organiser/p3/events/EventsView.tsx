import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { P3_PATHS } from '../shell/paths';
import { Sheet } from '../screens/Sheet';
import { STATUS_WORD, type EventsModel, type Filter, type Night, type NeedsEntry } from './eventsModel';

const TAP = { minHeight: 44, minWidth: 44 } as const;
const TAG_CLASS: Record<Night['status'], string> = { live: 'live', draft: 'draft', hidden: 'hidden', cancelled: 'cancel', past: 'finished' };

export function StatusTag({ status }: { status: Night['status'] }) {
  return <span className={`p3-tag p3-tag-${TAG_CLASS[status]}`} data-testid="ev-status">{STATUS_WORD[status]}</span>;
}

/** The ONE button a Needs-you item has, or the sentence that says why there is none (view only). */
function NeedsItem({ n, pageId, onClose }: { n: NeedsEntry; pageId: string | null; onClose: () => void }) {
  const to = n.action === 'new' ? P3_PATHS.createFor(pageId) : n.action === 'dates' && n.seriesId ? P3_PATHS.eventDates(n.seriesId) : n.seriesId ? P3_PATHS.event(n.seriesId) : null;
  return (
    <li className="p3-card p3-inset" data-testid="ev-need" data-key={n.key}>
      <strong className="p3-row-t">{n.title}</strong>
      <p className="p3-note">{n.detail}</p>
      {n.action && n.actionLabel && to && (
        <Link className="p3-btn p3-btn-line p3-btn-link" style={TAP} to={to} onClick={onClose} data-testid="ev-need-action">{n.actionLabel}</Link>
      )}
      {n.note && <p className="p3-note" data-testid="ev-need-note">{n.note}</p>}
    </li>
  );
}

function NightRow({ n, onOpen }: { n: Night; onOpen: (n: Night) => void }) {
  return (
    <li>
      <button type="button" className="p3-row p3-row-link" style={{ minHeight: 56, width: '100%', textAlign: 'left' }} onClick={() => onOpen(n)} data-testid="ev-night" data-status={n.status}>
        <span className="p3-grow" style={{ minWidth: 0 }}>
          <span className="p3-row-s" style={{ display: 'block' }} data-testid="ev-night-day">{n.dayLabel}</span>
          <span className="p3-row-t" style={{ display: 'block', overflowWrap: 'anywhere', textDecoration: n.status === 'cancelled' ? 'line-through' : undefined }} data-testid="ev-night-name">{n.name}</span>
          <span className="p3-row-s" style={{ display: 'block' }} data-testid="ev-night-sub">{n.sub}</span>
        </span>
        <StatusTag status={n.status} />
      </button>
      {n.moreDates > 0 && (
        <Link className="p3-link" style={{ display: 'flex', alignItems: 'center', ...TAP, paddingLeft: 12 }} to={P3_PATHS.eventDates(n.seriesId)} data-testid="ev-more-dates">
          See {n.moreDates} more {n.moreDates === 1 ? 'date' : 'dates'} of {n.name}
        </Link>
      )}
    </li>
  );
}

/** The Events list, drawn from the model only. Every control that cannot work is disabled and its reason is on screen. */
export function EventsView({ model, pageId, query, filter, onQuery, onFilter, onClear, onMore, onShowPast, onOpenNight }: {
  model: EventsModel; pageId: string | null; query: string; filter: Filter;
  onQuery: (q: string) => void; onFilter: (f: Filter) => void; onClear: () => void; onMore: () => void; onShowPast: () => void; onOpenNight: (n: Night) => void;
}) {
  const [needsOpen, setNeedsOpen] = useState(false);
  const reason = useId();
  const newBtn = model.newEvent.ok
    ? <Link className="p3-btn p3-btn-link" style={TAP} to={P3_PATHS.createFor(pageId)} data-testid="ev-new">New event</Link>
    : <button type="button" className="p3-btn" style={TAP} disabled aria-describedby={reason} data-testid="ev-new">New event</button>;
  return (
    <div className="p3-stack" data-testid="p3-events-dash">
      <div className="p3-h2-row">
        <h2 className="p3-h2" style={{ margin: 0 }}>Events</h2>
        {newBtn}
      </div>
      {model.banner && <p className="p3-note p3-card p3-inset" id={reason} data-testid="ev-banner">{model.banner}</p>}
      {!model.newEvent.ok && !model.banner && <p className="p3-note" id={reason}>{model.newEvent.why}</p>}
      {model.needsLine && (
        <div style={{ position: 'sticky', top: 0, zIndex: 2, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--card)', borderBottom: '1px solid var(--line)' }} data-testid="ev-needs-strip">
          <span className="p3-row-t" data-testid="ev-needs-line">{model.needsLine}</span>
          <button type="button" className="p3-link" style={TAP} onClick={() => setNeedsOpen(true)} data-testid="ev-needs-see">See</button>
        </div>
      )}
      {needsOpen && (
        <Sheet title={model.needsLine ?? 'Needs you'} onClose={() => setNeedsOpen(false)}>
          <ul className="p3-stack-s" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {model.needs.map((n) => <NeedsItem key={n.key} n={n} pageId={pageId} onClose={() => setNeedsOpen(false)} />)}
          </ul>
        </Sheet>
      )}
      {model.searchable && (
        <div className="p3-stack-s" data-testid="ev-search">
          <label className="p3-row-s" htmlFor="ev-q">Search your nights</label>
          <input id="ev-q" type="search" value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Event name" style={{ minHeight: 44, width: '100%', fontSize: 16 }} data-testid="ev-q" />
          <div role="group" aria-label="Filter by status" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {model.filters.map((f) => (
              <button key={f} type="button" className={`p3-btn ${filter === f ? '' : 'p3-btn-line'}`} style={TAP} aria-pressed={filter === f} onClick={() => onFilter(f)} data-testid={`ev-filter-${f}`}>
                {f === 'all' ? 'All' : STATUS_WORD[f]} {model.counts[f]}
              </button>
            ))}
          </div>
        </div>
      )}
      {model.state === 'empty' && (
        <div className="p3-card p3-state" data-testid="ev-empty">
          <strong>No events yet</strong>
          <p>{model.empty}</p>
          {model.newEvent.ok && <Link className="p3-btn p3-btn-link" style={TAP} to={P3_PATHS.createFor(pageId)} data-testid="ev-empty-new">New event</Link>}
        </div>
      )}
      {model.state === 'nomatch' && (
        <div className="p3-card p3-state" data-testid="ev-nomatch">
          <strong>No match</strong>
          <p>{model.noMatch}</p>
          <button type="button" className="p3-btn p3-btn-line" style={TAP} onClick={onClear} data-testid="ev-clear">Clear search and filters</button>
        </div>
      )}
      {model.nights.length > 0 && (
        <ul className="p3-card p3-list" aria-label="Your nights" style={{ listStyle: 'none', padding: 0, margin: 0 }} data-testid="ev-list">
          {model.nights.map((n) => <NightRow key={n.key} n={n} onOpen={onOpenNight} />)}
        </ul>
      )}
      {model.nights.length > 0 && <p className="p3-note" data-testid="ev-showing">Showing {model.nights.length} of {model.total}</p>}
      {model.more > 0 && <button type="button" className="p3-btn p3-btn-line" style={TAP} onClick={onMore} data-testid="ev-more">Show {model.more} more</button>}
      {model.pastHidden > 0 && <button type="button" className="p3-btn p3-btn-line" style={TAP} onClick={onShowPast} data-testid="ev-past">Show past events ({model.pastHidden})</button>}
    </div>
  );
}

/** The sheet for one night: Open, Cancel (reason when off), Delete draft (drafts only), and the one honest "not built" row. */
export function NightSheet({ night, onClose, onCancel, onDelete, openTo }: {
  night: Night; onClose: () => void; onCancel: () => void; onDelete: () => void; openTo: string;
}) {
  return (
    <Sheet title={`${night.name}, ${night.dayLabel}`} onClose={onClose}>
      <p className="p3-note" data-testid="ev-sheet-status"><StatusTag status={night.status} /> {night.sub}</p>
      <div className="p3-stack-s">
        <Link className="p3-btn p3-btn-link" style={TAP} to={openTo} data-testid="ev-open">{night.canEdit ? 'Open and edit' : 'Open'}</Link>
        <button type="button" className="p3-btn p3-btn-line" style={TAP} disabled={!night.cancel.ok} onClick={onCancel} data-testid="ev-cancel">Cancel this night</button>
        {night.cancel.why && <p className="p3-note" data-testid="ev-cancel-why">{night.cancel.why}</p>}
        {night.canDelete && <button type="button" className="p3-btn p3-btn-line" style={TAP} onClick={onDelete} data-testid="ev-delete">Delete draft</button>}
        <button type="button" className="p3-btn p3-btn-line" style={TAP} disabled data-testid="ev-duplicate">Duplicate</button>
        <p className="p3-note" data-testid="ev-duplicate-why">Duplicate is not available yet. It needs work from the Bachata Calendar team.</p>
      </div>
    </Sheet>
  );
}
