import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { flags } from '@/lib/featureFlags';
import { P3_PATHS } from '../shell/paths';
import { useEventChoice } from '../v2/V2Shell';
import { R4Chevron } from './R4Shell';
import { R4_DOOR_INVITE_COPY as C, r4DoorInviteOf } from './r4DoorInviteModel';

/** Board R4DoorInvite (flag organiserR4): the door invite link page for one night. Writes nothing (see the model). */
export function R4DoorInvite() {
  const c = useEventChoice();
  const ev = c.event;
  const m = useMemo(() => r4DoorInviteOf({
    load: c.loading ? 'loading' : c.error ? 'error' : 'ready',
    event: ev ? { id: ev.id, name: ev.name, nextDate: ev.next?.date ?? null } : null,
    many: c.rows.length > 1,
    doorOn: flags.organiserTicketing,
  }), [c.loading, c.error, c.rows.length, ev]);

  return (
    <div className="r4-stack" data-testid="r4-door-invite">
      <div className="r4-title-block">
        <Link to={P3_PATHS.youTeam} className="r4-back" data-testid="r4-door-invite-back">&larr; Team</Link>
        <h1 className="r4-h1" style={{ fontSize: 15, fontWeight: 500, letterSpacing: 0 }}>Door invite link</h1>
      </div>
      {m.load === 'loading' ? (
        <div className="r4-stack" aria-busy="true" data-testid="r4-door-invite-loading"><div className="r4-skel" /></div>
      ) : m.load === 'error' ? (
        <div className="r4-card r4-tile" role="alert" data-testid="r4-door-invite-error">
          <p className="r4-err">We couldn&rsquo;t load your nights. Nothing was changed.</p>
          <button type="button" className="r4-btn r4-btn-42 r4-btn-quiet" onClick={c.retry}>Try again</button>
        </div>
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 15 }} data-testid="r4-door-invite-intro">{C.intro}</p>
          {m.pick && (
            <label className="r4-nightpick" data-testid="r4-door-invite-pick">
              <span className="r4-row-body"><span className="r4-row-t">{m.pick}</span></span>
              {m.pickable && (
                <>
                  <span className="r4-mut"><R4Chevron dir="down" /></span>
                  <select aria-label={`Change night, now showing ${m.pick}`} value={c.eventId ?? ''} onChange={(e) => c.choose(e.target.value)}>
                    {c.rows.map((r) => <option key={r.id} value={r.id}>{r.name.trim() || 'No name yet'}</option>)}
                  </select>
                </>
              )}
            </label>
          )}
          <div className="r4-field">
            <button type="button" className="r4-btn r4-btn-42" disabled aria-describedby="r4-door-invite-why" data-testid="r4-door-invite-copy">{C.copy}</button>
            <p id="r4-door-invite-why" className="r4-hint" data-testid="r4-door-invite-why">{m.copyWhy}</p>
          </div>
          {m.facts.length > 0 && (
            <div data-testid="r4-door-invite-facts">
              {m.facts.map((f) => <p key={f} className="r4-note" style={{ margin: '4px 0 0' }}>{f}</p>)}
            </div>
          )}
          {m.previewFor && (
            <div className="r4-card">
              <Link to={P3_PATHS.eventDoor(m.previewFor)} className="r4-row" data-testid="r4-door-invite-preview">
                <span className="r4-row-t">{C.preview}</span>
                <span className="r4-mut"><R4Chevron /></span>
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
