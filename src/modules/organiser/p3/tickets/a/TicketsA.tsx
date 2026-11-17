import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { setTicketStatus, ticketKeys } from '../../../tickets/ticketsApi';
import { canManage, canRefund, formatCount, formatPence, leftOf, priceLabel, totalsOf, STATUS_LABEL, type Order } from '../../../tickets/ticketModel';
import { organiserOfSeries, useP3Home, useSeriesOrders, useSeriesTypes, useSummary } from '../data';
import { doorKeys, fetchDoorList } from '../../door/data';
import { TicketsEntry } from '../TicketsEntry';
import { StackSheet } from '../StackSheet';
import { shownOrders } from '../model';
import { P3_PATHS } from '../../shell/paths';
import { CLOCK_CAPTION, ticketsClock, type TicketsClock } from './clockState';

type Sheet = null | 'money' | 'who' | 'batches' | 'sell' | 'edit';

const BTN = { minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' } as const;
const META = { fontFamily: "'Source Code Pro', monospace", fontSize: 12, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#696969' } as const;
const ROW = { minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 16px', background: '#fff', border: 0, borderTop: '1px solid #E9E9E9', width: '100%', font: 'inherit', fontSize: 15, fontWeight: 500, color: '#030303', textAlign: 'left' } as const;

function Soon({ children }: { children: string }) {
  return <p style={{ margin: 0, fontSize: 13, color: '#696969' }} data-testid="tixa-soon">{children} Coming soon.</p>;
}

/** Tickets screen option A (flag organiserTicketsA): one big number that follows the clock of the chosen night. */
export function TicketsA({ seriesId, now = Date.now() }: { seriesId: string; now?: number }) {
  const home = useP3Home();
  const found = organiserOfSeries(home.data, seriesId);
  if (home.isPending) return <p className="p3-note" data-testid="tixa-loading">Loading&hellip;</p>;
  if (!found) return null;
  return <Body orgId={found.org.id} role={found.org.role} seriesId={seriesId} startIso={found.series.next_dates?.[0]?.materialised_start_utc ?? null} now={now} />;
}

function Body({ orgId, role, seriesId, startIso, now }: { orgId: string; role: string; seriesId: string; startIso: string | null; now: number }) {
  const [sheet, setSheet] = useState<Sheet>(null);
  const clock: TicketsClock = ticketsClock(startIso, now);
  const owner = canRefund(role);
  const types = useSeriesTypes(orgId, seriesId, owner);
  const summary = useSummary(orgId, owner);
  const showMoney = owner && summary.data?.moneyVisible === true;
  const list = types.data ?? [];
  const orders = useSeriesOrders(orgId, seriesId, list.map((t) => t.id), types.isSuccess && (summary.isSuccess || summary.isError), showMoney);
  const door = useQuery({ queryKey: doorKeys.list(orgId, seriesId), queryFn: () => fetchDoorList(seriesId), enabled: clock !== 'before', staleTime: 15_000 });
  const rows = summary.data?.ok ? summary.data.types.filter((t) => t.seriesId === seriesId) : [];
  const totals = totalsOf(rows);
  const came = door.data?.result === 'ok' ? door.data.inCount : null;
  const total = door.data?.result === 'ok' ? door.data.totalCount : null;
  const big = clock === 'before' ? totals.ticketsSold : came;
  const left = list.reduce((n, t) => n + leftOf(t), 0);
  const buyers: Order[] = shownOrders(orders.data ?? []);
  const close = () => setSheet(null);
  const qc = useQueryClient();
  const [opening, setOpening] = useState(false);
  const [openMsg, setOpenMsg] = useState<string | null>(null);
  const nextBatch = list.find((t) => t.status === 'draft' || t.status === 'paused') ?? null;
  const canOpen = canManage(role) && nextBatch !== null;
  const openNow = async () => {
    if (!nextBatch || opening) return;
    setOpening(true);
    setOpenMsg(null);
    try {
      const out = await setTicketStatus(nextBatch.id, 'on_sale');
      if (!out.ok) setOpenMsg('We couldn\u2019t open it. Try again in a moment.');
      else {
        await Promise.all([
          qc.invalidateQueries({ queryKey: ticketKeys.types(orgId, seriesId) }),
          qc.invalidateQueries({ queryKey: ticketKeys.summary(orgId) }),
        ]);
      }
    } catch {
      setOpenMsg('We couldn\u2019t open it. Try again in a moment.');
    } finally {
      setOpening(false);
    }
  };

  if (types.isError || summary.isError) {
    return <p className="p3-note" role="alert" data-testid="tixa-error">We couldn&rsquo;t load your tickets. Check your connection, then try again.</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} data-testid="tixa" data-clock={clock}>
      <section style={{ background: '#fff', border: '1px solid #E9E9E9', borderRadius: 11, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={META}>{clock === 'before' ? 'Before the night' : clock === 'door' ? 'Tonight' : 'After the night'}</span>
        <span style={{ fontSize: 56, lineHeight: 1.1, fontWeight: 600, letterSpacing: '-0.025em' }} data-testid="tixa-big">{big === null ? (types.isPending ? '\u2026' : '\u2014') : formatCount(big)}</span>
        <span style={{ fontSize: 15, color: '#464646' }}>
          {CLOCK_CAPTION[clock]}
          {clock === 'before' && types.isSuccess ? ` \u00b7 ${formatCount(left)} left` : ''}
          {clock !== 'before' && total !== null ? ` of ${formatCount(total)}` : ''}
        </span>
      </section>
      {clock === 'door' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Link to={P3_PATHS.eventDoor(seriesId)} style={{ ...BTN, background: '#C2410C', color: '#FFFAF7', borderRadius: 10, fontSize: 15, fontWeight: 500, textDecoration: 'none' }} data-testid="tixa-door">Open the door</Link>
          <button type="button" style={{ ...BTN, background: '#fff', borderRadius: 10, border: 0, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.10)', fontSize: 15, fontWeight: 500 }} onClick={() => setSheet('sell')} data-testid="tixa-sell">Sell at the door</button>
        </div>
      )}
      {clock === 'after' && (
        <section style={{ background: '#fff', border: '1px solid #E9E9E9', borderRadius: 11, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Soon>Message the people who did not come.</Soon>
        </section>
      )}
      <div style={{ background: '#fff', border: '1px solid #E9E9E9', borderRadius: 11, overflow: 'hidden' }}>
        {showMoney && <button type="button" style={{ ...ROW, borderTop: 0 }} onClick={() => setSheet('money')} data-testid="tixa-open-money">Money<span style={{ color: '#696969' }}>{formatPence(totals.grossPence - totals.refundedPence)}</span></button>}
        <button type="button" style={{ ...ROW, borderTop: showMoney ? ROW.borderTop : 0 }} onClick={() => setSheet('who')} data-testid="tixa-open-who">Who bought<span style={{ color: '#696969' }}>{formatCount(totals.ordersPaid)}</span></button>
        <button type="button" style={ROW} onClick={() => setSheet('batches')} data-testid="tixa-open-batches">Batches<span style={{ color: '#696969' }}>{formatCount(list.length)}</span></button>
      </div>
      {!showMoney && <p style={{ margin: 0, fontSize: 13, color: '#696969' }}>You see counts. The owner sees the money.</p>}

      {sheet === 'money' && (
        <StackSheet title="Money" onClose={close} testId="tixa-sheet-money">
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <li>Taken: <strong style={{ fontWeight: 600 }}>{formatPence(totals.grossPence)}</strong></li>
            <li>Refunded: <strong style={{ fontWeight: 600 }}>{formatPence(totals.refundedPence)}</strong></li>
            <li>Booking fees: <strong style={{ fontWeight: 600 }}>{formatPence(totals.bookingFeesPence)}</strong></li>
          </ul>
          <Soon>Payout date and amount.</Soon>
        </StackSheet>
      )}
      {sheet === 'who' && (
        <StackSheet title="Who bought" onClose={close} testId="tixa-sheet-who">
          {buyers.length === 0 ? <p className="p3-note">Nobody has bought yet. Tickets show here as they sell.</p> : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {buyers.slice(0, 3).map((o) => (
                <li key={o.id} style={{ minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #E9E9E9' }}>
                  <span style={{ fontSize: 15, fontWeight: 500 }}>{o.buyerName?.trim() || 'A buyer'}</span>
                  <span style={{ fontSize: 13, color: '#696969' }}>{o.quantity} ticket{o.quantity === 1 ? '' : 's'}</span>
                </li>
              ))}
            </ul>
          )}
          <button type="button" style={{ ...BTN, background: '#fff', borderRadius: 10, border: 0, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.10)', fontSize: 15, fontWeight: 500 }} onClick={() => setSheet('edit')} data-testid="tixa-see-all">See all {formatCount(buyers.length)}{owner ? ' and refund' : ''}</button>
          <Soon>Message buyers.</Soon>
        </StackSheet>
      )}
      {sheet === 'batches' && (
        <StackSheet title="Batches" onClose={close} testId="tixa-sheet-batches">
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {list.map((t) => (
              <li key={t.id} style={{ minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTop: '1px solid #E9E9E9' }}>
                <span><span style={{ display: 'block', fontSize: 15, fontWeight: 500 }}>{t.name}</span><span style={{ fontSize: 13, color: '#696969' }}>{priceLabel(t.pricePence)} &middot; {formatCount(leftOf(t))} left</span></span>
                <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.07em', textTransform: 'uppercase', border: '1px solid #D9D9D9', borderRadius: 999, padding: '3px 7px' }}>{STATUS_LABEL[t.status]}</span>
              </li>
            ))}
          </ul>
          <button type="button" style={{ ...BTN, background: '#fff', borderRadius: 10, border: 0, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.10)', fontSize: 15, fontWeight: 500 }} onClick={() => setSheet('edit')} data-testid="tixa-change-price">Change a price</button>
          <p style={{ margin: 0, fontSize: 13, color: '#696969' }}>A new price only counts for tickets sold from now on.</p>
          <p style={{ margin: 0, fontSize: 13, color: '#464646' }} data-testid="tixa-opens-by-itself">The next batch opens by itself when the one before it sells out. <span style={{ color: '#696969' }}>Coming soon.</span></p>
          {nextBatch ? (
            <button type="button" disabled={!canOpen || opening} style={{ ...BTN, background: '#fff', borderRadius: 10, border: 0, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.10)', fontSize: 15, fontWeight: 500, opacity: canOpen && !opening ? 1 : 0.5 }} onClick={() => void openNow()} data-testid="tixa-open-now">{opening ? 'Opening\u2026' : `Open ${nextBatch.name} now`}</button>
          ) : null}
          {openMsg ? <p role="alert" style={{ margin: 0, fontSize: 13, color: '#464646' }}>{openMsg}</p> : null}
        </StackSheet>
      )}
      {sheet === 'sell' && (
        <StackSheet title="Sell at the door" onClose={close} testId="tixa-sheet-sell">
          <p style={{ margin: 0, fontSize: 15 }}>Cash only. They are marked as in straight away.</p>
          <button type="button" disabled style={{ ...BTN, opacity: 0.5, background: '#C2410C', color: '#FFFAF7', borderRadius: 10, border: 0, fontSize: 15, fontWeight: 500 }} data-testid="tixa-took-cash">Took cash</button>
          <Soon>Selling at the door.</Soon>
        </StackSheet>
      )}
      {sheet === 'edit' && (
        <StackSheet title="Tickets" onClose={() => setSheet(null)} testId="tixa-sheet-edit" full>
          <TicketsEntry seriesId={seriesId} />
        </StackSheet>
      )}
    </div>
  );
}
