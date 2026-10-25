import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { NEEDS_YOU_KEY, fetchNeedsYou, resolveClaim, type Decision, type NeedsItem } from './frontDoorApi';
import {
  NEEDS_EMPTY, NEEDS_LOAD_ERROR, REASON_HELP, REASON_LABEL, canResolve, groupItems, resolveMessage,
} from './needsYouModel';
import { NETWORK_ERROR_TEXT } from './frontDoorListModel';
import { BTN, BTN_PRIMARY, organiserHref } from './frontDoorUi';

function Item({ item }: { item: NeedsItem }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const busy = useRef(false);
  const resolve = useMutation({
    mutationFn: (d: Decision) => resolveClaim(item.id, d),
    onSuccess: (r) => { setNote(resolveMessage(r)); void queryClient.invalidateQueries({ queryKey: NEEDS_YOU_KEY }); },
    onError: () => setNote({ ok: false, text: NETWORK_ERROR_TEXT }),
    onSettled: () => { busy.current = false; },
  });
  const go = (d: Decision) => { if (busy.current) return; busy.current = true; setNote(null); resolve.mutate(d); };
  return (
    <li className="space-y-2 p-3" data-testid="needs-item" data-reason={item.reason}>
      <p className="break-words text-sm font-medium">{item.label}</p>
      {item.detail && <p className="break-words text-sm text-muted-foreground" data-testid="needs-detail">{item.detail}</p>}
      <div className="flex flex-wrap gap-2">
        {canResolve(item) && (
          <>
            <button type="button" className={BTN_PRIMARY} disabled={resolve.isPending} onClick={() => go('approve_full')} data-testid="needs-approve">Approve</button>
            <button type="button" className={BTN} disabled={resolve.isPending} onClick={() => go('decline')} data-testid="needs-decline">Decline</button>
          </>
        )}
        {item.organiserId && <a className={BTN} href={organiserHref(item.organiserId)} data-testid="needs-open">Open the page</a>}
      </div>
      {note && <p role={note.ok ? 'status' : 'alert'} className={`text-sm ${note.ok ? '' : 'text-destructive'}`} data-testid="needs-note">{note.text}</p>}
    </li>
  );
}

export function NeedsYou({ onAdd }: { onAdd: () => void }) {
  const q = useQuery({ queryKey: NEEDS_YOU_KEY, queryFn: fetchNeedsYou, staleTime: 30_000 });
  if (q.isPending) return <div className="space-y-2" data-testid="needs-loading">{[0, 1, 2].map((k) => <Skeleton key={k} className="h-16 w-full rounded-lg" />)}</div>;
  if (q.isError) {
    return (
      <div role="alert" className="space-y-2 rounded-lg border border-border p-3" data-testid="needs-load-error">
        <p className="text-sm">{NEEDS_LOAD_ERROR}</p>
        <button type="button" className={BTN} onClick={() => void q.refetch()}>Try again</button>
      </div>
    );
  }
  const items = q.data ?? [];
  if (items.length === 0) {
    return (
      <div className="space-y-2 rounded-lg border border-border p-3" data-testid="needs-empty">
        <p className="text-sm font-semibold">{NEEDS_EMPTY.title}</p>
        <p className="text-sm text-muted-foreground">{NEEDS_EMPTY.body}</p>
        <button type="button" className={BTN_PRIMARY} onClick={onAdd}>Add an organiser</button>
      </div>
    );
  }
  return (
    <div className="space-y-3" data-testid="needs-list">
      {groupItems(items).map((g) => (
        <section key={g.reason} className="space-y-1" data-testid={`needs-group-${g.reason}`}>
          <h2 className="text-sm font-semibold">{REASON_LABEL[g.reason]} ({g.items.length})</h2>
          <p className="text-xs text-muted-foreground">{REASON_HELP[g.reason]}</p>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">{g.items.map((i) => <Item key={i.id} item={i} />)}</ul>
        </section>
      ))}
    </div>
  );
}
