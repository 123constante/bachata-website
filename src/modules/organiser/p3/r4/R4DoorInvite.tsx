import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { flags } from '@/lib/featureFlags';
import { P3_PATHS } from '../shell/paths';
import { useEventWorkspace } from '@/modules/organiser/shared/runCommands';
import { mintDoorInvite } from '../door/join/doorJoinApi';
import { DOOR_PATHS } from '../door/join/doorJoinModel';
import { useEventChoice } from '../v2/V2Shell';
import { R4Chevron } from './R4Shell';
import { R4_DOOR_INVITE_COPY as C, r4DoorInviteOf, type R4DoorInviteIn } from './r4DoorInviteModel';

async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

/** Board R4DoorInvite (flag organiserR4): the door invite link page for one night. Mints a link only when Copy is tapped. */
export function R4DoorInvite({ mint: mintFn = mintDoorInvite }: { mint?: typeof mintDoorInvite } = {}) {
  const c = useEventChoice();
  const ev = c.event;
  const nextDate = ev?.next?.date ?? null;
  // The night's occurrence id: the event's own dates (the workspace read the night screens already use).
  const ws = useEventWorkspace(ev && nextDate ? ev.id : undefined);
  const occurrenceId = ws.data?.dates.find((d) => d.occurrence_date === nextDate)?.id ?? null;
  const [mint, setMint] = useState<NonNullable<R4DoorInviteIn['mint']>>('idle');
  const [copied, setCopied] = useState<boolean | null>(null);
  // A link belongs to one night: choosing another event forgets it.
  useEffect(() => { setMint('idle'); setCopied(null); }, [ev?.id]);
  const m = useMemo(() => r4DoorInviteOf({
    load: c.loading ? 'loading' : c.error ? 'error' : 'ready',
    event: ev ? { id: ev.id, name: ev.name, nextDate } : null,
    many: c.rows.length > 1,
    doorOn: flags.organiserTicketing,
    occurrenceId,
    mint,
    origin: window.location.origin,
  }), [c.loading, c.error, c.rows.length, ev, nextDate, occurrenceId, mint]);

  const onCopy = useCallback(async () => {
    if (!ev || !occurrenceId) return;
    setMint('running');
    setCopied(null);
    let a: Awaited<ReturnType<typeof mintFn>>;
    try { a = await mintFn(ev.id, occurrenceId); } catch { setMint('failed'); return; }
    setMint(a);
    if (a.result === 'ok' && a.token) setCopied(await copyText(`${window.location.origin}${DOOR_PATHS.join(a.token)}`));
  }, [ev, occurrenceId, mintFn]);

  const onShare = useCallback(async () => {
    if (!m.link) return;
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (typeof nav.share === 'function') {
      try { await nav.share({ title: C.copy, text: C.shareText, url: m.link.url }); return; } catch (e) {
        if ((e as { name?: string })?.name === 'AbortError') return;
      }
    }
    setCopied(await copyText(m.link.url));
  }, [m.link]);

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
            <button type="button" className="r4-btn r4-btn-42" disabled={!m.canCopy} aria-describedby={m.copyWhy ? 'r4-door-invite-why' : undefined} onClick={() => void onCopy()} data-testid="r4-door-invite-copy">{m.busy ? C.copying : C.copy}</button>
            {m.copyWhy && <p id="r4-door-invite-why" className="r4-hint" role={typeof mint === 'object' || mint === 'failed' ? 'alert' : undefined} data-testid="r4-door-invite-why">{m.copyWhy}</p>}
          </div>
          {m.link && (
            <div className="r4-card r4-tile" data-testid="r4-door-invite-link">
              <p className="r4-hint" style={{ fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.4 }}>{C.linkLabel}</p>
              <p style={{ margin: '4px 0 0', fontSize: 13, wordBreak: 'break-all', userSelect: 'all' }} data-testid="r4-door-invite-url">{m.link.url}</p>
              {m.link.ends && <p className="r4-note" data-testid="r4-door-invite-ends">Access ends {m.link.ends}.</p>}
              <p className="r4-note">{C.oneUse}</p>
              {copied !== null && <p className="r4-note" role="status" style={{ color: copied ? '#C2410C' : undefined }} data-testid="r4-door-invite-copied">{copied ? C.copied : C.copyFailed}</p>}
              <button type="button" className="r4-btn r4-btn-42 r4-btn-quiet" style={{ marginTop: 8 }} onClick={() => void onShare()} data-testid="r4-door-invite-share">{C.share}</button>
            </div>
          )}
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
