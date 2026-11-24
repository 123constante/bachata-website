import { useState } from 'react';
import type { EventWorkspace } from '../../events/eventModel';
import { useSendOnce } from '../../shared/runCommands';
import { eventBlockers, goLiveLabel } from '../../shared/goLiveKeys';
import { useGoLiveCheck } from '../../shared/goLiveCheck';
import { londonTodayKey } from '@/lib/londonDate';
import { eventPageOf } from '../data/eventPage';
import type { SendOnce } from '../screens/CancelEventSheet';
import { StatusSheet, type Send } from '../screens/StatusSheet';
import { useToast } from '../screens/Toast';

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

/** Sticky "Put it live" on a draft: greyed with the first reason until series_go_live_check_v1 says ready; opens the old screen's StatusSheet. */
export function GoLiveBar({ ws }: { ws: EventWorkspace }) {
  const id = ws.series.id;
  const check = useGoLiveCheck(id, isDraftEvent(ws));
  const toast = useToast(id, ws.series.version);
  const once = useSendOnce(id);
  const [open, setOpen] = useState(false);
  if (!isDraftEvent(ws)) return null;
  const today = londonTodayKey();
  const send: Send = (commands, version) => toast.run(commands, version);
  const sendOnce: SendOnce = (command, key) => once(command, ws.series.version, key);
  const ready = check.data?.ready === true;
  const reason = ready ? null
    : check.isError ? 'Could not check what is left. Try again.'
    : check.data ? (firstGoLiveReason(check.data.eventMissing) ?? 'Finish your profile before it can go live.')
    : 'Checking what is left\u2026';
  return (
    <>
      <div data-testid="golive-bar" style={{ position: 'sticky', bottom: 'calc(var(--tabbar-h, 64px) + env(safe-area-inset-bottom, 0px))', zIndex: 5, background: '#FFFFFF', borderTop: '1px solid #E9E9E9', padding: '8px 12px' }}>
        <button type="button" className="v2-btn" data-testid="golive-btn" disabled={!ready} onClick={() => setOpen(true)} style={ready ? undefined : { background: '#E5E5E5', color: '#696969' }}>{PUT_LIVE}</button>
        {reason && <p data-testid="golive-reason" style={{ margin: '6px 0 0', fontSize: 13, color: '#464646' }}>{reason}</p>}
      </div>
      {toast.node}
      {open && (
        <StatusSheet ws={ws} today={today} status={eventPageOf(ws, today).status} send={send} sendOnce={sendOnce} onClose={() => setOpen(false)}
          onDone={(d) => { setOpen(false); toast.show(d); }} />
      )}
    </>
  );
}
