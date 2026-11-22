import type { CSSProperties, ReactNode } from 'react';
import { V2 } from './copy';

const E = V2.every;
export type LifeState = 'Live' | 'Paused' | 'Ended' | 'Cancelled';
const RED = '#B42318';
const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 52, padding: '8px 16px', background: 'none', border: 0, borderTop: '1px solid #E9E9E9', textAlign: 'left', font: 'inherit', cursor: 'pointer' };

function Slim({ id, title, sub, red, onTap, first, stat }: { id: string; title: string; sub?: ReactNode; red?: boolean; onTap?: () => void; first?: boolean; stat?: boolean }) {
  const body = (
    <>
      <span style={{ flex: 1, minWidth: 0, display: 'block' }}>
        <b style={{ display: 'block', fontWeight: 600, color: red ? RED : undefined }}>{title}</b>
        {sub ? <span style={{ display: 'block', fontSize: 13, color: '#696969' }}>{sub}</span> : null}
      </span>
      {!stat ? <span aria-hidden="true">&rsaquo;</span> : null}
    </>
  );
  const st = first ? { ...row, borderTop: 0 } : row;
  return (
    <div data-testid={`end-${id}`}>
      {!stat ? <button type="button" style={st} onClick={onTap}>{body}</button> : <div style={{ ...st, cursor: 'default' }}>{body}</div>}
    </div>
  );
}

/** E-18..E-25: "Pause, end or cancel" group on the Every tab (weekly). `onCancel` absent = the row shows but does nothing. */
export function EndCard({ status, endDate, reason, onLive, onPause, onEnd, onCancel }: {
  status: LifeState; endDate: string | null; reason: string | null;
  onLive: () => void; onPause: () => void; onEnd: () => void; onCancel?: () => void;
}) {
  const rows: { id: string; node: (first: boolean) => ReactNode }[] = [];
  if (status !== 'Live') rows.push({ id: 'live', node: (f) => <Slim first={f} id="live" title={E.liveAgain} sub={E.liveAgainSub(status)} onTap={onLive} /> });
  if (status === 'Live' || status === 'Ended') rows.push({ id: 'pause', node: (f) => <Slim first={f} id="pause" title={E.pauseRow} sub={E.pauseRowSub} onTap={onPause} /> });
  if (status === 'Live' || status === 'Paused') {
    rows.push({ id: 'end', node: (f) => <Slim first={f} id="end" title={E.endRow} sub={endDate && status === 'Live' ? E.endSubDate(endDate) : E.endSubNone} onTap={onEnd} /> });
  }
  if (status === 'Cancelled') rows.push({ id: 'cancelled', node: (f) => <Slim first={f} id="cancelled" red stat title={E.cancelledRow} sub={reason ? E.cancelledReason(reason) : undefined} /> });
  else rows.push({ id: 'cancel', node: (f) => <Slim first={f} id="cancel" red title={E.cancelRow} sub={E.cancelRowSub} onTap={onCancel} /> });
  return (
    <div className="grp" data-testid="every-end">
      <div className="lab hd">{E.endHead}</div>
      <div className="card"><div className="fb-list">{rows.map((r, i) => <div key={r.id}>{r.node(i === 0)}</div>)}</div></div>
    </div>
  );
}
