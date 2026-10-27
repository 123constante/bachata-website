import { PAYMENT_LABEL, togglePayment } from '../../events/paymentModel';
import { CURRENCIES, newPriceRow, type Currency, type PriceRow } from '../../events/seriesExtras';
import { eventLock } from '../../shared/eventState';
import type { EventWorkspace } from '../../events/eventModel';
import { L } from '../model';
import {
  isFree, payChoices, pricesBlocker, pricesDraftOf, pricesLockOf, pricesPlan, pricesSpecs, setFree, storedPriceCount,
} from '../data/prices';
import { trayLines } from '../model/saveModel';
import { P3_PATHS } from '../shell/paths';
import { EditTray, GuardedBack, useBackToEvent, useEditForm, useSaveRun } from './EditTray';
import { WorkspaceGate } from './EventPage';

function PriceCard({ row, i, off, onChange, onRemove }: { row: PriceRow; i: number; off: boolean; onChange: (r: PriceRow) => void; onRemove: () => void }) {
  return (
    <div className="p3-card p3-tight p3-stack-s" data-testid="p3-price-row">
      <div className="p3-pair">
        <div className="p3-stack-s">
          <label className="p3-field" htmlFor={`p3-prn-${i}`}>{L.pricesName}</label>
          <input id={`p3-prn-${i}`} className="p3-in" value={row.name} disabled={off} placeholder={L.pricesNamePlaceholder}
            onChange={(e) => onChange({ ...row, name: e.target.value })} data-testid="p3-price-name" />
        </div>
        <div className="p3-stack-s">
          <label className="p3-field" htmlFor={`p3-prp-${i}`}>{L.pricesAmount}</label>
          <input id={`p3-prp-${i}`} className="p3-in" inputMode="decimal" value={row.price} disabled={off} placeholder="15"
            onChange={(e) => onChange({ ...row, price: e.target.value })} data-testid="p3-price-amount" />
        </div>
      </div>
      <label className="p3-field" htmlFor={`p3-prc-${i}`}>{L.pricesCurrency}</label>
      <select id={`p3-prc-${i}`} className="p3-in" value={row.currency} disabled={off}
        onChange={(e) => onChange({ ...row, currency: e.target.value as Currency })} data-testid="p3-price-currency">
        {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <button type="button" className="p3-link p3-danger-t" disabled={off} onClick={onRemove} data-testid="p3-price-remove">{L.pricesRemove}</button>
    </div>
  );
}

function Prices({ ws }: { ws: EventWorkspace }) {
  const form = useEditForm(ws, pricesDraftOf, pricesSpecs(ws));
  const save = useSaveRun(ws.series.id);
  const back = useBackToEvent(ws.series.id, form.dirty);
  const closed = eventLock(ws.series.lifecycle_status);
  const rowsLock = pricesLockOf(ws);
  const { draft, set } = form;
  const free = isFree(draft);
  const off = !!closed || save.busy;
  const choices = payChoices(ws);
  const blocker = pricesBlocker(ws, form.base, draft);
  const plan = pricesPlan(ws, form.base, draft);
  const lines = trayLines(form.lines, plan, blocker);
  const setRow = (i: number, r: PriceRow) => set({ rows: draft.rows.map((x, j) => (j === i ? r : x)) });

  const onSave = async () => {
    const res = await save.run(plan, form.version, form.landed);
    if (res.ok) { form.saved(res.version); back(L.pricesSaved); }
  };

  return (
    <div className="p3-stack p3-edit" data-testid="p3-prices">
      <GuardedBack to={P3_PATHS.event(ws.series.id)}>{L.back}</GuardedBack>
      <p className="p3-row-s">{ws.series.name}</p>
      <h2 className="p3-name">{L.prices}</h2>
      <p className="p3-mut">{L.pricesIntro}</p>
      {closed && <p className="p3-warn" data-testid="p3-prices-lock">{closed}</p>}
      {choices.length > 1 && (
        <div className="p3-card p3-tight">
          <label className="p3-check" data-testid="p3-free">
            <input type="checkbox" role="switch" checked={free} disabled={off} onChange={(e) => set(setFree(draft, e.target.checked))} data-testid="p3-free-switch" />
            <span className="p3-grow"><span className="p3-row-t">{L.pricesFree}</span><br /><span className="p3-row-s">{L.pricesFreeSub}</span></span>
          </label>
        </div>
      )}
      {!free && (
        rowsLock ? (
          <div className="p3-warn" data-testid="p3-prices-rows-lock">
            <p className="p3-plain">{L.pricesLockedCount(storedPriceCount(ws))}</p>
            <p className="p3-plain">{rowsLock}</p>
          </div>
        ) : (
          <div className="p3-stack-s" data-testid="p3-price-rows">
            {draft.rows.length === 0 && <p className="p3-note" data-testid="p3-prices-empty">{L.pricesNone}</p>}
            {draft.rows.map((r, i) => (
              <PriceCard key={r.id} row={r} i={i} off={off} onChange={(x) => setRow(i, x)} onRemove={() => set({ rows: draft.rows.filter((_, j) => j !== i) })} />
            ))}
            <button type="button" className="p3-btn p3-btn-line" disabled={off} onClick={() => set({ rows: [...draft.rows, newPriceRow()] })} data-testid="p3-price-add">{L.pricesAdd}</button>
          </div>
        )
      )}
      <span className="p3-field">{L.payHow}</span>
      <p className="p3-note">{choices.length === 1 ? L.payFestival : L.payHelp}</p>
      <div className="p3-chips" role="group" aria-label={L.payHow} data-testid="p3-pay">
        {choices.map((m) => (
          <button key={m} type="button" aria-pressed={draft.methods.includes(m)} disabled={off}
            onClick={() => set({ methods: togglePayment(draft.methods, m) })} data-testid="p3-pay-chip">{PAYMENT_LABEL[m]}</button>
        ))}
      </div>
      <EditTray lines={lines} elsewhere={form.elsewhere} problem={blocker} lock={closed} busy={save.busy} error={save.error}
        onSave={() => void onSave()} onUndo={() => { form.undo(); save.clearError(); }} onRestart={() => { form.restart(); save.forget(); }} />
    </div>
  );
}

/** C3 "Prices" (P3 W3a): the price list, "It's free" and how to pay, one save for all dates. */
export function PricesScreen() {
  return <WorkspaceGate>{(ws) => <Prices key={ws.series.id} ws={ws} />}</WorkspaceGate>;
}
