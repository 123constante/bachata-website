import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EventConflict, EventStepShell, SendButton, StepError, useEventSend } from '@/modules/organiser/flows/event';
import { ORG_PATHS } from '../shell';
import { Card, FIELD_CLASS, GhostButton } from '../ui';
import type { EventWorkspace } from './eventModel';
import {
  CURRENCIES, END_CONSEQUENCE, MAX_PASSES, endCommand, endProblem, newPriceRow, priceLabel, priceRows, pricesCommand, pricesProblem, usualEnd,
  type Currency, type PriceRow,
} from './seriesExtras';

/** C14: the usual end, ONE series.upsert default_duration_minutes; the screen says what it does to listed dates. */
export function EndEdit({ ws }: { ws: EventWorkspace }) {
  const seriesId = ws.series.id;
  const { sendThenDone, busy, conflict, error } = useEventSend(seriesId);
  const [typed, setTyped] = useState(() => usualEnd(ws));
  const start = ws.series.default_local_start_time?.slice(0, 5) ?? null;
  const changed = typed.trim() !== usualEnd(ws);
  const problem = changed ? endProblem(ws, typed) : null;
  const save = () => {
    const command = endCommand(ws, typed);
    if (command) void sendThenDone(ws.series.version, command, { title: 'Saved', message: 'Saved' });
  };
  return (
    <EventStepShell seriesId={seriesId} title="Ends" back={ORG_PATHS.eventDetails(seriesId)}>
      {conflict ? <EventConflict seriesId={seriesId} /> : (
        <>
          {start && <p className="text-[14px] text-[var(--mut)]">{`Starts at ${start}. An end before the start is the next morning.`}</p>}
          <input id="org-detail-input" type="text" inputMode="numeric" placeholder="23:00" maxLength={5} value={typed} aria-label="Ends"
            data-testid="org-detail-input" onChange={(e) => setTyped(e.target.value)} className={cn(FIELD_CLASS, 'h-[48px]')} />
          {problem && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="org-detail-problem">{problem}</p>}
          <p className="text-[14px] text-[var(--fg)]" data-testid="org-ends-consequence">{END_CONSEQUENCE}</p>
          <SendButton label="Save" testId="org-detail-save" reason={!changed ? 'Nothing changed yet' : problem} busy={busy} onSend={save} />
          <StepError text={error} />
        </>
      )}
    </EventStepShell>
  );
}

const SMALL = 'h-[48px] min-w-0';

/**
 * C09b: the price list (name, price, currency), ONE series.upsert default_passes
 * with the owner keys only. "How many" is not offered: a quantity is a key an
 * organiser may not write on prod (_owner_passes_problem_p5).
 */
export function PricesEdit({ ws }: { ws: EventWorkspace }) {
  const seriesId = ws.series.id;
  const { sendThenDone, busy, conflict, error } = useEventSend(seriesId);
  const [rows, setRows] = useState<PriceRow[]>(() => priceRows(ws));
  const command = pricesCommand(ws, rows);
  const problem = pricesProblem(rows);
  const set = (id: string, p: Partial<PriceRow>) => setRows((list) => list.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const currency = (rows[0]?.currency ?? 'GBP') as Currency;
  return (
    <EventStepShell seriesId={seriesId} title="Prices" back={ORG_PATHS.eventDetails(seriesId)}>
      {conflict ? <EventConflict seriesId={seriesId} /> : (
        <>
          {rows.length === 0 && (
            <p className="text-[14px] text-[var(--mut)]" data-testid="org-prices-empty">No prices yet. Add a price so dancers know what entry costs.</p>
          )}
          {rows.length > 0 && (
            <Card>
              {rows.map((r) => (
                <div key={r.id} className="flex flex-col gap-2 p-3" data-testid="org-price-row">
                  <div className="flex items-center gap-2">
                    <input type="text" value={r.name} maxLength={120} placeholder="Entry" aria-label="Price name" data-testid="org-price-name"
                      onChange={(e) => set(r.id, { name: e.target.value })} className={cn(FIELD_CLASS, SMALL, 'flex-1')} />
                    <button type="button" aria-label={`Remove ${r.name || 'this price'}`} data-testid="org-price-remove"
                      onClick={() => setRows((list) => list.filter((x) => x.id !== r.id))}
                      className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full text-[var(--mut)]">
                      <X aria-hidden="true" className="h-[16px] w-[16px]" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="text" inputMode="decimal" value={r.price} placeholder="12.50" aria-label={`Price for ${r.name || 'this entry'}`} data-testid="org-price-amount"
                      onChange={(e) => set(r.id, { price: e.target.value })} className={cn(FIELD_CLASS, SMALL, 'flex-1')} />
                    <select value={r.currency} aria-label="Currency" data-testid="org-price-currency" onChange={(e) => set(r.id, { currency: e.target.value as Currency })}
                      className={cn(FIELD_CLASS, SMALL, 'w-[96px]')}>
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <p className="text-[13px] text-[var(--mut)]">{`Dancers see: ${r.name.trim() || 'Entry'}, ${priceLabel(r)}`}</p>
                </div>
              ))}
            </Card>
          )}
          {rows.length < MAX_PASSES ? (
            <GhostButton testId="org-prices-add" onClick={() => setRows((list) => [...list, newPriceRow(currency)])}>
              <Plus aria-hidden="true" className="h-[18px] w-[18px]" /> Add a price
            </GhostButton>
          ) : <p className="text-[13px] text-[var(--mut)]">{`Up to ${MAX_PASSES} prices.`}</p>}
          {problem && rows.length > 0 && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="org-detail-problem">{problem}</p>}
          <SendButton label="Save" testId="org-detail-save" reason={problem ?? (command ? null : 'Nothing changed yet')} busy={busy}
            onSend={() => { if (command) void sendThenDone(ws.series.version, command, { title: 'Saved', message: 'Prices saved' }); }} />
          <StepError text={error} />
        </>
      )}
    </EventStepShell>
  );
}
