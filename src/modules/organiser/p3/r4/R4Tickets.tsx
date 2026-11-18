import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { flags } from '@/lib/featureFlags';
import { setTicketStatus, ticketKeys } from '../../tickets/ticketsApi';
import { canRefund, formatPence, totalsOf } from '../../tickets/ticketModel';
import { fetchDoorNight } from '../dash/pastNights';
import { useSeriesTypes, useSummary } from '../tickets/data';
import { StackSheet } from '../tickets/StackSheet';
import { TicketsEntry } from '../tickets/TicketsEntry';
import { P3_PATHS } from '../shell/paths';
import { useEventChoice, type EventChoice } from '../v2/V2Shell';
import { R4Chevron } from './R4Shell';
import { R4LookContext } from './r4Look';
import { r4TicketsOf, type R4TicketsModel } from './r4TicketsModel';

type Sheet = null | 'money' | 'all';

/** The board's "Change night" box: a real select over the page's events, styled as the board draws it. */
function NightPick({ c }: { c: EventChoice }) {
  const ev = c.event;
  if (!ev) return null;
  const day = ev.next ? new Date(`${ev.next.date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }) : 'No date yet';
  return (
    <label className="r4-nightpick" data-testid="r4-tix-pick">
      <span className="r4-row-body">
        <span className="r4-row-t">{ev.name.trim() || 'No name yet'}</span>
        <span className="r4-row-line">{day.replace(',', '')}</span>
      </span>
      <span className="r4-mut"><R4Chevron dir="down" /></span>
      <select aria-label={`Change night, now showing ${ev.name}`} value={c.eventId ?? ''} onChange={(e) => c.choose(e.target.value)}>
        {c.rows.map((r) => <option key={r.id} value={r.id}>{r.name.trim() || 'No name yet'}</option>)}
      </select>
    </label>
  );
}

function Empty({ c, m }: { c: EventChoice; m: R4TicketsModel }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="r4-stack" data-testid="r4-tix-empty">
      <NightPick c={c} />
      <div className="r4-title-block">
        <h1 className="r4-h1">No tickets yet</h1>
        <p className="r4-lead">Add your first ticket and it goes on sale on the event page.</p>
      </div>
      <button type="button" className="r4-btn r4-btn-42" disabled={!!m.addWhy} onClick={() => setOpen(true)} data-testid="r4-tix-add">+ Add a ticket</button>
      {m.addWhy && <p className="r4-hint" data-testid="r4-tix-add-why">{m.addWhy}</p>}
      {open && (
        <StackSheet title="Tickets" onClose={() => setOpen(false)} testId="r4-tix-sheet-all" full>
          <TicketsEntry seriesId={c.event!.id} />
        </StackSheet>
      )}
    </section>
  );
}

function Failed({ retry }: { retry: () => void }) {
  return (
    <div className="r4-card r4-tile" role="alert" data-testid="r4-tix-error">
      <h2 className="r4-h3">We could not load tickets</h2>
      <p className="r4-sub">Nothing was changed. Your live nights are still on the calendar for dancers.</p>
      <button type="button" className="r4-btn r4-btn-42 r4-btn-quiet r4-btn-34" onClick={retry} data-testid="r4-tix-retry">Try again</button>
    </div>
  );
}

function Body({ c }: { c: EventChoice }) {
  const row = c.event!;
  const org = c.page!;
  const role = org.role ?? null;
  const owner = canRefund(role as Parameters<typeof canRefund>[0]);
  const types = useSeriesTypes(org.id, row.id, owner);
  const summary = useSummary(org.id, owner);
  const nightOn = !!row.next && row.next.status !== 'cancelled' && row.lifecycle !== 'draft';
  const door = useQuery({ queryKey: ['r4-door', row.id], queryFn: () => fetchDoorNight(row.id, null), enabled: nightOn, retry: false });
  const sales = summary.data?.ok ? summary.data.types.filter((t) => t.seriesId === row.id) : null;
  const m = r4TicketsOf({
    row, role,
    types: types.isSuccess ? types.data : null,
    sales,
    moneyVisible: summary.data?.ok === true && summary.data.moneyVisible === true,
    doorSold: door.data?.result === 'ok' ? door.data.totalCount : null,
    error: types.isError || summary.isError,
  });
  const [sheet, setSheet] = useState<Sheet>(null);
  const [opening, setOpening] = useState(false);
  const [openMsg, setOpenMsg] = useState<string | null>(null);
  const qc = useQueryClient();
  const retry = () => { void types.refetch(); void summary.refetch(); };
  const openNow = async () => {
    const next = m.batch?.open;
    if (!next || opening) return;
    setOpening(true);
    setOpenMsg(null);
    try {
      const out = await setTicketStatus(next.id, 'on_sale');
      if (!out.ok) setOpenMsg('We couldn\u2019t open it. Try again in a moment.');
      else await Promise.all([
        qc.invalidateQueries({ queryKey: ticketKeys.types(org.id, row.id) }),
        qc.invalidateQueries({ queryKey: ticketKeys.summary(org.id) }),
      ]);
    } catch {
      setOpenMsg('We couldn\u2019t open it. Try again in a moment.');
    } finally {
      setOpening(false);
    }
  };

  if (m.state === 'error') return <div className="r4-stack"><NightPick c={c} /><Failed retry={retry} /></div>;
  if (m.state === 'loading') return <div className="r4-stack" data-testid="r4-tix-loading"><NightPick c={c} /><div className="r4-skel" /><div className="r4-skel" /></div>;
  if (m.state === 'empty') return <Empty c={c} m={m} />;
  const totals = sales ? totalsOf(sales) : null;
  return (
    <div className="r4-stack r4-stack-32" data-testid="r4-tix" data-id={row.id}>
      <div className="r4-title-block">
        <div className="r4-title-row">
          <h1 className="r4-h1">{m.title}</h1>
          {m.pill && <span className={`r4-pill r4-pill-${m.pill.tone}`} data-testid="r4-tix-pill">{m.pill.word}</span>}
        </div>
        {m.when && <p className="r4-sub" data-testid="r4-tix-when">{m.when}</p>}
      </div>
      {c.rows.length > 1 && <NightPick c={c} />}
      {m.big && (
        <div className="r4-section r4-gap-12" data-testid="r4-tix-big">
          <div className="r4-big">{m.big.sold}{m.big.of !== null && <span className="r4-big-of"> of {m.big.of} sold</span>}{m.big.of === null && <span className="r4-big-of"> sold</span>}</div>
          {m.big.pct !== null && (
            <div className="r4-bar" role="img" aria-label={m.big.label} data-testid="r4-tix-bar"><div style={{ width: `${m.big.pct}%` }} /></div>
          )}
        </div>
      )}
      <div className="r4-section">
        <button type="button" className="r4-btn r4-btn-42" disabled aria-describedby="r4-tix-msg-why" data-testid="r4-tix-message">Message everyone who bought</button>
        <p id="r4-tix-msg-why" className="r4-hint">{m.messageWhy}</p>
      </div>
      <div className="r4-card r4-list" data-testid="r4-tix-rows">
        <div>
          <Link to={P3_PATHS.eventPrices(row.id)} className="r4-row" data-testid="r4-tix-batches">
            <span className="r4-row-t">Price and batches</span>
            <span className="r4-mut"><R4Chevron /></span>
          </Link>
          {m.batch && (
            <div className="r4-row-sub" data-testid="r4-tix-batch-line">
              <p className="r4-hint r4-grow">{m.batch.openWhy ?? m.batch.line}</p>
              {m.batch.open && (
                <button type="button" className="r4-btn r4-btn-quiet r4-btn-34 r4-btn-fit" disabled={!!m.batch.openWhy || opening} onClick={() => void openNow()} data-testid="r4-tix-open-now">{opening ? 'Opening\u2026' : 'Open now'}</button>
              )}
            </div>
          )}
          {openMsg && <p role="alert" className="r4-err r4-pad">{openMsg}</p>}
        </div>
        <button type="button" className="r4-row r4-row-btn r4-line-top" onClick={() => setSheet('all')} data-testid="r4-tix-who">
          <span className="r4-row-t">Who bought</span>
          {m.who && <span className="r4-row-end">{m.who}</span>}
          <span className="r4-mut"><R4Chevron /></span>
        </button>
        {m.money && (
          <button type="button" className="r4-row r4-row-btn r4-line-top" onClick={() => setSheet('money')} data-testid="r4-tix-money">
            <span className="r4-row-t">Money and payouts</span>
            <span className="r4-row-end">{m.money}</span>
            <span className="r4-mut"><R4Chevron /></span>
          </button>
        )}
      </div>
      {!m.money && <p className="r4-hint">You see counts. The owner sees the money.</p>}
      {sheet === 'money' && totals && (
        <StackSheet title="Money and payouts" onClose={() => setSheet(null)} testId="r4-tix-sheet-money">
          <ul className="r4-plain-list">
            <li>Taken: <strong>{formatPence(totals.grossPence)}</strong></li>
            <li>Refunded: <strong>{formatPence(totals.refundedPence)}</strong></li>
            <li>Booking fees: <strong>{formatPence(totals.bookingFeesPence)}</strong></li>
          </ul>
          <p className="r4-hint">Payout date and amount: coming soon.</p>
        </StackSheet>
      )}
      {sheet === 'all' && (
        // Straight onto the orders (Refund lives on each order); closing it comes back here.
        <TicketsEntry seriesId={row.id} startOn="orders" onOrdersClose={() => setSheet(null)} />
      )}
    </div>
  );
}

/** Boards R4Tickets / R4EmptyTickets (flag organiserR4): one night in focus. Without ticketing, the V2 tab's own words stand. */
export function R4Tickets() {
  const c = useEventChoice();
  if (c.loading) return <div className="r4-stack" data-testid="r4-tix-loading"><div className="r4-skel" /><div className="r4-skel" /></div>;
  if (c.error) return <Failed retry={c.retry} />;
  if (c.noPage || !c.event || !c.page) {
    return (
      <div className="r4-card r4-tile" data-testid="r4-tix-noevent">
        <p className="r4-sub">{c.noPage ? 'You don\u2019t have an organiser page yet.' : 'This page has no events yet. Add a night to sell tickets for it.'}</p>
        <Link className="r4-btn r4-btn-42 r4-btn-link" to={c.noPage ? P3_PATHS.start : P3_PATHS.create}>{c.noPage ? 'Find or create a page' : 'Add a night'}</Link>
      </div>
    );
  }
  if (!flags.organiserTicketing) {
    return <div className="r4-card r4-tile" data-testid="r4-tix-off"><p className="r4-sub">Selling tickets is not switched on for your page yet.</p></div>;
  }
  return <R4LookContext.Provider value><Body key={c.event.id} c={c} /></R4LookContext.Provider>;
}
