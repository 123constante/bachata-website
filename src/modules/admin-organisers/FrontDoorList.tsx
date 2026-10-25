import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { CHIPS, FRONT_DOOR_LIST_KEY, fetchFrontDoorList, sendOrganiserInvite, setRunByUs, type Chip, type FrontDoorRow } from './frontDoorApi';
import {
  CHIP_HELP, CHIP_LABEL, LIST_EMPTY, LIST_LOAD_ERROR, NETWORK_ERROR_TEXT, chipCounts, filterRows,
  inviteStateText, runByUsControl, runByUsMessage, sendControl, sendMessage,
} from './frontDoorListModel';
import { BTN, BTN_PRIMARY, organiserHref, switchLabel } from './frontDoorUi';

function Row({ row }: { row: FrontDoorRow }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const busy = useRef(false);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: FRONT_DOOR_LIST_KEY });
  const send = useMutation({
    mutationFn: () => sendOrganiserInvite(row.organiserId),
    onSuccess: (r) => { setNote(sendMessage(r)); refresh(); },
    onError: () => setNote({ ok: false, text: NETWORK_ERROR_TEXT }),
    onSettled: () => { busy.current = false; },
  });
  const toggle = useMutation({
    mutationFn: (v: boolean) => setRunByUs(row.organiserId, v),
    onSuccess: (r) => { setNote(runByUsMessage(r)); refresh(); },
    onError: () => setNote({ ok: false, text: NETWORK_ERROR_TEXT }),
    onSettled: () => { busy.current = false; },
  });
  const sc = sendControl(row);
  const rb = runByUsControl(row);
  const state = inviteStateText(row);
  const sendReason = `reason-send-${row.organiserId}`;
  const rbReason = `reason-rbu-${row.organiserId}`;
  const pending = send.isPending || toggle.isPending;
  return (
    <li className="space-y-2 p-3" data-testid="fd-row" data-chip={row.chip}>
      <div className="flex items-start justify-between gap-2">
        <a href={organiserHref(row.organiserId)} className="flex min-h-[44px] min-w-0 flex-1 items-center text-sm font-medium underline-offset-2 hover:underline">
          {/* the text is its own flex item so a long unbroken name can shrink and wrap (#1033 walk) */}
          <span className="min-w-0 break-words">{row.name}</span>
        </a>
        <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-xs font-medium" data-testid="fd-chip">{CHIP_LABEL[row.chip]}</span>
      </div>
      {state && <p className="text-xs text-muted-foreground" data-testid="fd-invite-state">{state}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button" className={BTN_PRIMARY} data-testid="fd-send"
          disabled={sc.disabledReason !== null || pending}
          aria-describedby={sc.disabledReason ? sendReason : undefined}
          onClick={() => { if (busy.current) return; busy.current = true; setNote(null); send.mutate(); }}
        >{send.isPending ? 'Sending…' : sc.label}</button>
        <label className={switchLabel(rb.disabledReason !== null)}>
          <input
            type="checkbox" role="switch" className="h-6 w-6" checked={rb.on} data-testid="fd-run-by-us"
            disabled={rb.disabledReason !== null || pending}
            aria-describedby={rb.disabledReason ? rbReason : undefined}
            onChange={(e) => { if (busy.current) return; busy.current = true; setNote(null); toggle.mutate(e.target.checked); }}
          />
          Run by us
        </label>
      </div>
      {sc.disabledReason && <p id={sendReason} className="text-xs text-muted-foreground" data-testid="fd-send-reason">{sc.disabledReason}</p>}
      {rb.disabledReason && <p id={rbReason} className="text-xs text-muted-foreground" data-testid="fd-rbu-reason">{rb.disabledReason}</p>}
      {note && <p role={note.ok ? 'status' : 'alert'} className={`text-sm ${note.ok ? '' : 'text-destructive'}`} data-testid="fd-note">{note.text}</p>}
    </li>
  );
}

export function FrontDoorList({ onAdd }: { onAdd: () => void }) {
  const [chip, setChip] = useState<Chip | 'all'>('all');
  const list = useQuery({ queryKey: FRONT_DOOR_LIST_KEY, queryFn: fetchFrontDoorList, staleTime: 30_000 });
  const rows = list.data ?? [];
  const counts = chipCounts(rows);
  const shown = filterRows(rows, chip);
  const chipBtn = (c: Chip | 'all', label: string, n: number) => (
    <button key={c} type="button" aria-pressed={chip === c} onClick={() => setChip(c)} data-testid={`fd-filter-${c}`}
      className={`min-h-[44px] rounded-full border px-3 text-sm ${chip === c ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'}`}>
      {label} {n}
    </button>
  );
  if (list.isPending) return <div className="space-y-2" data-testid="fd-loading">{[0, 1, 2].map((k) => <Skeleton key={k} className="h-20 w-full rounded-lg" />)}</div>;
  if (list.isError) {
    return (
      <div role="alert" className="space-y-2 rounded-lg border border-border p-3" data-testid="fd-load-error">
        <p className="text-sm">{LIST_LOAD_ERROR}</p>
        <button type="button" className={BTN} onClick={() => void list.refetch()}>Try again</button>
      </div>
    );
  }
  return (
    <div className="space-y-3" data-testid="fd-list">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by group">
        {chipBtn('all', 'All', rows.length)}
        {CHIPS.map((c) => chipBtn(c, CHIP_LABEL[c], counts[c]))}
      </div>
      {chip !== 'all' && <p className="text-xs text-muted-foreground" data-testid="fd-chip-help">{CHIP_HELP[chip]}</p>}
      {shown.length === 0 ? (
        <div className="space-y-2 rounded-lg border border-border p-3" data-testid="fd-empty">
          <p className="text-sm text-muted-foreground">{rows.length === 0 ? LIST_EMPTY.all : LIST_EMPTY.filtered}</p>
          <button type="button" className={BTN} onClick={onAdd}>Add an organiser</button>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">{shown.map((r) => <Row key={r.organiserId} row={r} />)}</ul>
      )}
    </div>
  );
}
