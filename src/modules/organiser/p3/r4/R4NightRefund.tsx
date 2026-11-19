import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { fetchNightRefundSummary, refundKeys, refundNight, refundOneOrder, type RefundOrderRow } from '../door/refundData';
import { Sheet } from '../screens/Sheet';
import { REFUND_COPY, nightDoneText, refundBlockOf } from './r4RefundModel';

type Ask = { kind: 'all'; orders: number; pence: number } | { kind: 'one'; order: RefundOrderRow };

/** Board R4 cancel refund (flag organiserCancelRefund): the block under a cancelled night's numbers. Owner / admin only (server). */
export function R4NightRefund({ seriesId, occurrenceId }: { seriesId: string; occurrenceId: string }) {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: refundKeys.night(user?.id, seriesId, occurrenceId),
    queryFn: () => fetchNightRefundSummary(seriesId, occurrenceId),
    enabled: !!user?.id,
    retry: 1,
  });
  const [ask, setAsk] = useState<Ask | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheetErr, setSheetErr] = useState<string | null>(null);
  const [said, setSaid] = useState<{ text: string; ok: boolean } | null>(null);

  if (q.isError && !q.data) {
    return <p className="r4-err" role="alert" data-testid="r4-refund-error">{REFUND_COPY.error} <button type="button" className="r4-linkbtn" onClick={() => void q.refetch()}>{REFUND_COPY.retry}</button></p>;
  }
  if (!q.data) return q.isPending && user?.id ? <p className="r4-note" data-testid="r4-refund-loading">{REFUND_COPY.loading}</p> : null;
  const b = refundBlockOf(q.data);
  if (!b) return null;
  const summary = q.data.kind === 'ok' ? q.data : null;

  const close = () => { if (!busy) { setAsk(null); setSheetErr(null); } };
  const go = async () => {
    if (!ask) return;
    setBusy(true); setSheetErr(null);
    try {
      if (ask.kind === 'all') {
        const list = summary?.orders ?? [];
        const out = await refundNight(seriesId, occurrenceId, { pence: ask.pence, orders: ask.orders });
        if (out.kind === 'changed') {
          // nothing was sent: read the new totals and ask again with them
          const fresh = await q.refetch();
          const s = fresh.data?.kind === 'ok' ? fresh.data : null;
          if (s && s.nightCancelled && s.ordersToRefund > 0) setAsk({ kind: 'all', orders: s.ordersToRefund, pence: s.penceToRefund });
          else setAsk(null);
          setSheetErr(REFUND_COPY.changed);
          if (!s || s.ordersToRefund === 0) setSaid({ text: REFUND_COPY.changed, ok: false });
          return;
        }
        if (out.kind === 'ok') { setSaid(nightDoneText(out.value, list)); setAsk(null); }
        else setSheetErr(out.kind === 'not_configured' ? REFUND_COPY.notConfigured : REFUND_COPY.failed);
      } else {
        const out = await refundOneOrder(ask.order.orderId);
        if (out.kind === 'ok') { setSaid({ text: REFUND_COPY.doneOne(ask.order.firstName ?? 'No name'), ok: true }); setAsk(null); }
        else setSheetErr(out.kind === 'not_configured' ? REFUND_COPY.notConfigured : REFUND_COPY.failed);
      }
      void q.refetch();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="r4-section" aria-label={REFUND_COPY.title} data-testid="r4-refund">
      <h2 className="r4-label">{REFUND_COPY.title}</h2>
      <div className="r4-card r4-refund-head">
        <p className="r4-row-t" data-testid="r4-refund-line">{b.line}</p>
        {b.allOn && summary && (
          <button type="button" className="r4-btn r4-btn-42" data-testid="r4-refund-all"
            onClick={() => { setSaid(null); setSheetErr(null); setAsk({ kind: 'all', orders: summary.ordersToRefund, pence: summary.penceToRefund }); }}>{REFUND_COPY.all}</button>
        )}
      </div>
      {said && <p className={said.ok ? 'r4-note' : 'r4-err'} role="status" data-testid="r4-refund-said">{said.text}</p>}
      {b.rows.length > 0 && (
        <ul className="r4-card r4-guest-list" data-testid="r4-refund-list">
          {b.rows.map((r) => (
            <li key={r.order.orderId} className="r4-guest-row" data-testid="r4-refund-row">
              <span className="r4-row-body">
                <span className="r4-row-t">{r.name}</span>
                <span className="r4-row-line">{[r.tickets, r.amount].filter(Boolean).join(', ')}</span>
                {r.note && <span className="r4-row-line">{r.note}</span>}
              </span>
              {r.canRefund
                ? <button type="button" className="r4-chip r4-chip-44" data-testid="r4-refund-one" onClick={() => { setSaid(null); setSheetErr(null); setAsk({ kind: 'one', order: r.order }); }}>{REFUND_COPY.one}</button>
                : <span className="r4-mut" data-testid="r4-refund-done">{REFUND_COPY.refunded}</span>}
            </li>
          ))}
        </ul>
      )}
      {ask && (
        <Sheet title={ask.kind === 'all' ? REFUND_COPY.askAll(ask.orders, ask.pence) : REFUND_COPY.askOne(ask.order)} onClose={close} locked={busy}>
          <div className="r4-stack r4-sheet" data-testid="r4-refund-sheet">
            {ask.kind === 'one' && ask.order.mixedNights && <p className="r4-sub">{REFUND_COPY.askOneMixed}</p>}
            {sheetErr && <p className="r4-err" role="alert" data-testid="r4-refund-sheet-error">{sheetErr}</p>}
            <button type="button" className="r4-btn r4-btn-danger" disabled={busy} onClick={() => void go()} data-testid="r4-refund-go">{REFUND_COPY.go}</button>
            <button type="button" className="r4-btn r4-btn-quiet" disabled={busy} onClick={close} data-testid="r4-refund-keep">{REFUND_COPY.keep}</button>
          </div>
        </Sheet>
      )}
    </section>
  );
}
