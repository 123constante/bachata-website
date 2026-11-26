import { useState } from 'react';
import { useInRouterContext, useNavigate } from 'react-router-dom';
import type { EventWorkspace } from '../../events/eventModel';
import { useSendOnce } from '../../shared/runCommands';
import { eventBlockers, goLiveLabel } from '../../shared/goLiveKeys';
import { goLiveFixHref, useGoLiveCheck } from '../../shared/goLiveCheck';
import { londonTodayKey } from '@/lib/londonDate';
import { eventPageOf } from '../data/eventPage';
import type { SendOnce } from '../screens/CancelEventSheet';
import { StatusSheet, type Send } from '../screens/StatusSheet';
import { useToast } from '../screens/Toast';
import { goLiveFixOn, v2FixFor, type V2FixTarget } from './goLiveFixV2';
import { HowToPaySheet } from './HowToPaySheet';

export const DRAFT_PILL = 'Draft';
export const DRAFT_NOTE = 'Not live yet. Dancers can\u2019t see this event.';
export const COVER_REASON = 'Add a cover photo in Name and details.';
export const PUT_LIVE = 'Put it live';

/** Only a draft gets the new behaviour; every other state renders as it always did. */
export const isDraftEvent = (ws: EventWorkspace): boolean => ws.series.lifecycle_status === 'draft';

/** The first thing still missing, in the server's order, in words that say where to fix it. */
export function firstGoLiveReason(items: readonly { code: string; section: string }[]): string | null {
  const first = eventBlockers(items)[0];
  if (!first) return null;
  return first.code === 'cover' || first.code === 'no_flyer' ? COVER_REASON : goLiveLabel(first.code);
}

export function DraftNote() {
  return <p role="note" data-testid="draft-note" style={{ margin: '8px 0', padding: '10px 12px', background: '#FFF1E8', border: '1px solid #F5D5C3', borderRadius: 8, color: '#9A3412', fontSize: 14 }}>{DRAFT_NOTE}</p>;
}

/** The reason line as a button: opens the fix for the first blocker. Inside a Router only (it may navigate). */
function FixLine({ reason, section, target, seriesId, onFix, onPay }: { reason: string; section: string; target: V2FixTarget; seriesId: string; onFix?: (t: V2FixTarget) => void; onPay: () => void }) {
  const navigate = useNavigate();
  const tap = () => {
    if (target === 'pay') { onPay(); return; }
    if (onFix) { onFix(target); return; }
    const to = goLiveFixHref(section, seriesId);
    if (to) navigate(to);
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '6px 0 0' }}>
      <p data-testid="golive-reason" style={{ margin: 0, fontSize: 13, color: '#464646' }}>
        <button type="button" data-testid="golive-fix" onClick={tap} className="v2-fixline" style={{ minHeight: 44, padding: 0, background: 'none', border: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }}>{reason}</button>
      </p>
      <span aria-hidden="true" style={{ fontSize: 13, color: '#464646' }}>{'\u203A'}</span>
    </div>
  );
}

/** Sticky "Put it live" on a draft: greyed with the first reason until series_go_live_check_v1 says ready; opens the old screen's StatusSheet. */
export function GoLiveBar({ ws, onFix }: { ws: EventWorkspace; onFix?: (target: V2FixTarget) => void }) {
  const id = ws.series.id;
  const check = useGoLiveCheck(id, isDraftEvent(ws));
  const toast = useToast(id, ws.series.version);
  const once = useSendOnce(id);
  const [open, setOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const inRouter = useInRouterContext();
  if (!isDraftEvent(ws)) return null;
  const today = londonTodayKey();
  const send: Send = (commands, version) => toast.run(commands, version);
  const sendOnce: SendOnce = (command, key) => once(command, ws.series.version, key);
  const ready = check.data?.ready === true;
  const reason = ready ? null
    : check.isError ? 'Could not check what is left. Try again.'
    : check.data ? (firstGoLiveReason(check.data.eventMissing) ?? 'Finish your profile before it can go live.')
    : 'Checking what is left\u2026';
  const first = check.data && !ready ? eventBlockers(check.data.eventMissing)[0] : undefined;
  const target = first ? v2FixFor(first.code) : null;
  const fixable = goLiveFixOn() && !!first && !!target && inRouter;
  return (
    <>
      <div data-testid="golive-bar" style={{ position: 'sticky', bottom: 'calc(var(--tabbar-h, 64px) + env(safe-area-inset-bottom, 0px))', zIndex: 5, background: '#FFFFFF', borderTop: '1px solid #E9E9E9', padding: '8px 12px' }}>
        <button type="button" className="v2-btn" data-testid="golive-btn" disabled={!ready} onClick={() => setOpen(true)} style={ready ? undefined : { background: '#E5E5E5', color: '#696969' }}>{PUT_LIVE}</button>
        {reason && (fixable
          ? <FixLine reason={reason} section={first!.section} target={target!} seriesId={id} onFix={onFix} onPay={() => setPaying(true)} />
          : <p data-testid="golive-reason" style={{ margin: '6px 0 0', fontSize: 13, color: '#464646' }}>{reason}</p>)}
      </div>
      {toast.node}
      {paying && <HowToPaySheet ws={ws} send={send} onClose={() => setPaying(false)} />}
      {open && (
        <StatusSheet ws={ws} today={today} status={eventPageOf(ws, today).status} send={send} sendOnce={sendOnce} onClose={() => setOpen(false)}
          onDone={(d) => { setOpen(false); toast.show(d); }} />
      )}
    </>
  );
}
