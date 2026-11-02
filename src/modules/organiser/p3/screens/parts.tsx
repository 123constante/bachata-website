import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { GoingTotalStat } from '@/modules/going/GoingTotalStat';
import { useMyOrganiserGoingTotal } from '@/modules/going/useMyOrganiserGoingTotal';

import type { P3Row } from '../data/home';
import { P3_PATHS } from '../shell/paths';



/** The kind chip (C3 deviation #71: one per row, never a group heading). */
export function KindChip({ row }: { row: P3Row }) {
  return <span className="p3-chip" data-testid="p3-kind">{row.kindWord}</span>;
}

export function StatusTag({ row }: { row: P3Row }) {
  return (
    <span className={`p3-tag p3-tag-${row.status.key}`} data-testid="p3-status">
      {row.status.key === 'live' && <span className="p3-dot" aria-hidden="true" />}
      {row.status.label}
    </span>
  );
}

/** The cover, or the "No photo yet" box when there is none or it fails to load. */
export function Thumb({ row }: { row: P3Row }) {
  // keyed by the URL, so a new cover (another event, a refetch) gets its own try
  const [broken, setBroken] = useState<string | null>(null);
  return row.cover && row.cover !== broken ? (
    <img className="p3-thumb" src={row.cover} alt="" loading="lazy" onError={() => setBroken(row.cover)} />
  ) : (
    <span className="p3-thumb p3-thumb-none" role="img" aria-label="No photo yet" />
  );
}

/** One event: photo, name, when and where, kind chip and status. Opens the event page (W2a). */
export function EventRow({ row }: { row: P3Row }) {
  return (
    <li className="p3-row" data-testid="p3-row" data-id={row.id}>
      <Link className="p3-row-link" to={P3_PATHS.event(row.id)}>
        <Thumb row={row} />
        <div className="p3-grow">
          <div className="p3-row-t">{row.name}</div>
          <div className="p3-row-s">{row.sub}</div>
          <div className="p3-row-tags">
            <KindChip row={row} />
            <StatusTag row={row} />
          </div>
        </div>
      </Link>
    </li>
  );
}

export function EventList({ rows, label }: { rows: readonly P3Row[]; label: string }) {
  return (
    <ul className="p3-card p3-list" aria-label={label}>
      {rows.map((r) => <EventRow key={r.id} row={r} />)}
    </ul>
  );
}

/** A loading, empty or error state: what happened, and what the person CAN do. */
export function StateCard({ title, children, testId }: { title: string; children: ReactNode; testId: string }) {
  return (
    <div className="p3-card p3-state" data-testid={testId} role={testId.endsWith('error') ? 'alert' : undefined}>
      <strong>{title}</strong>
      {children}
    </div>
  );
}

/** A P3 link in running copy (p3-shell-exits: none points at the R1 area any more). */
export function P3Link({ to, children, testId }: { to: string; children: ReactNode; testId?: string }) {
  return <Link className="p3-link" to={to} data-testid={testId}>{children}</Link>;
}

/** New event: P3's own flow (p3/new), kind first. */
export function AddEventLink({ children = 'Add an event' }: { children?: ReactNode }) {
  return <P3Link to={P3_PATHS.create} testId="p3-add-event">{children}</P3Link>;
}

export function RetryButton({ onClick }: { onClick: () => void }) {
  return <button type="button" className="p3-btn p3-btn-line" onClick={onClick}>Try again</button>;
}

/**
 * The going total: the going module's own GoingTotalStat (its words, 0 as "No one going
 * yet", its error + Try again and "may be out of date"), fed by the same hook as R1 Stats.
 * The going switch is OFF on main, so this renders nothing until it is turned on.
 */
export function GoingTile() {
  const going = useMyOrganiserGoingTotal();
  if (going.view.state === 'off') return null;
  return (
    <div className="p3-card p3-stat" data-testid="p3-going">
      <GoingTotalStat {...going} />
    </div>
  );
}
