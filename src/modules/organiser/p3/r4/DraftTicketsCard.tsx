import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { londonTodayKey } from '@/lib/londonDate';
import { ticketKeys } from '../../tickets/ticketsApi';
import { useEventWorkspace } from '../../events/eventsApi';
import { useSendOnce } from '../../shared/runCommands';
import { eventPageOf } from '../data/eventPage';
import type { SendOnce } from '../screens/CancelEventSheet';
import { StatusSheet, type Send } from '../screens/StatusSheet';
import { useToast } from '../screens/Toast';
import { PUT_LIVE } from '../v2/GoLiveBar';

export const DRAFT_HEADING = 'This event is a draft.';
export const DRAFT_LINE = 'Tickets can\u2019t be added until it is live.';

/** Opens the existing go-live StatusSheet (same sheet the All dates screen uses) for one event. */
function PutLive({ seriesId, orgId }: { seriesId: string; orgId: string | undefined }) {
  const ws = useEventWorkspace(seriesId);
  const version = ws.data?.series.version ?? 0;
  const toast = useToast(seriesId, version);
  const once = useSendOnce(seriesId);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const data = ws.data;
  const send: Send = (commands, v) => toast.run(commands, v);
  const sendOnce: SendOnce = (command, key) => once(command, version, key);
  return (
    <>
      <button type="button" className="r4-btn r4-btn-42" disabled={!data} onClick={() => setOpen(true)} data-testid="r4-tix-put-live">{PUT_LIVE}</button>
      {toast.node}
      {open && data && (
        <StatusSheet ws={data} today={londonTodayKey()} status={eventPageOf(data, londonTodayKey()).status} send={send} sendOnce={sendOnce} onClose={() => setOpen(false)}
          onDone={(d) => {
            setOpen(false);
            toast.show(d);
            // The Tickets tab reads home + ticket types: refresh so "Add a ticket" enables.
            if (orgId) void qc.invalidateQueries({ queryKey: ticketKeys.types(orgId, seriesId) });
          }} />
      )}
    </>
  );
}

/** Amber note under the greyed "Add a ticket" on a draft event (a manager or owner can put it live). */
export function DraftTicketsCard({ seriesId, orgId }: { seriesId: string; orgId: string | undefined }) {
  return (
    <div role="note" className="r4-stack" data-testid="r4-tix-draft-card" style={{ padding: '10px 12px', background: '#FFF1E8', border: '1px solid #F5D5C3', borderRadius: 8, color: '#9A3412', fontSize: 14 }}>
      <p style={{ margin: 0 }}><strong>{DRAFT_HEADING}</strong> {DRAFT_LINE}</p>
      <PutLive seriesId={seriesId} orgId={orgId} />
    </div>
  );
}
