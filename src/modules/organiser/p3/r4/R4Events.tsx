import { useMemo, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { confirmationOf, HomeNotices, useNoPageRedirect } from './r4Notices';
import { P3_PATHS } from '../shell/paths';
import { useEventChoice } from './EventChoice';
import { R4Chevron } from './R4Shell';
import { r4EventsOf, type R4EventRow } from './r4EventsModel';

function EventRow({ row }: { row: R4EventRow }) {
  return (
    <Link to={P3_PATHS.event(row.id)} className="r4-row r4-row-tall" data-testid="r4-event-row" data-id={row.id}>
      <span className="r4-row-body">
        <span className="r4-row-t">{row.name}</span>
        {row.when && <span className="r4-row-line">{row.when}</span>}
        {row.extra && <span className="r4-row-line">{row.extra}</span>}
      </span>
      <span className={`r4-pill r4-pill-${row.pill.tone}`}>{row.pill.word}</span>
      <span className="r4-mut"><R4Chevron /></span>
    </Link>
  );
}

function Section({ title, rows, testId }: { title: string; rows: R4EventRow[]; testId: string }) {
  if (rows.length === 0) return null;
  return (
    <section className="r4-section" data-testid={testId} aria-label={title}>
      <h2 className="r4-label r4-h2">{title}</h2>
      <div className="r4-card r4-list">{rows.map((r) => <EventRow key={r.id} row={r} />)}</div>
    </section>
  );
}

/** Board R4Events (flag organiserR4): Add a night, This week, Later, Past nights. Rows read home_v1 only. */
export function R4Events() {
  const r = useNoPageRedirect();
  const c = useEventChoice();
  const confirmation = confirmationOf(useLocation().state);
  const [showPast, setShowPast] = useState(false);
  const m = useMemo(() => r4EventsOf(c.rows, c.today), [c.rows, c.today]);

  if (r.to) return <Navigate to={r.to} replace />;
  if (r.loading || c.loading) return <div className="r4-stack" data-testid="r4-events-loading" aria-busy="true"><div className="r4-skel" /><div className="r4-skel" /></div>;

  return (
    <div className="r4-stack" data-testid="r4-events">
      <HomeNotices confirmation={confirmation} />
      <h1 className="r4-h1">Events</h1>
      <Link to={P3_PATHS.createFor(c.page?.id)} className="r4-btn r4-btn-link" data-testid="r4-events-add">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
        Add a night
      </Link>
      {m.empty && <p className="r4-sub" data-testid="r4-events-empty">No events on this page yet. Add a night and it shows here.</p>}
      {!m.empty && m.week.length === 0 && m.later.length === 0 && (
        <p className="r4-sub" data-testid="r4-events-none-coming">Nothing coming up. Add a night, or open a past one to run it again.</p>
      )}
      <Section title="This week" rows={m.week} testId="r4-events-week" />
      <Section title="Later" rows={m.later} testId="r4-events-later" />
      {m.past.length > 0 && (
        <div className="r4-section">
          <div className="r4-card r4-list">
            <button type="button" className="r4-row r4-row-btn" aria-expanded={showPast} onClick={() => setShowPast((v) => !v)} data-testid="r4-events-past-toggle">
              <span className="r4-row-t">Past nights</span>
              <span className="r4-row-end">{m.past.length}</span>
              <span className="r4-mut"><R4Chevron dir={showPast ? 'down' : 'right'} /></span>
            </button>
          </div>
          {showPast && <Section title="Past" rows={m.past} testId="r4-events-past" />}
        </div>
      )}
    </div>
  );
}
