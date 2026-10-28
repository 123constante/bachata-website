import { upsertCommand, type OwnerCommand } from '../../shared/seriesCommands';
import type { EventWorkspace } from '../../events/eventModel';
import {
  PAYMENT_LABEL, parsePayment, paymentChoices, paymentCommand, toSend, togglePayment, type PaymentMethod,
} from '../../events/paymentModel';
import { priceLabel, priceRows, pricesCommand, pricesLock, pricesProblem, passCount, toPass, type PriceRow } from '../../events/seriesExtras';
import { L } from '../model/labels';
import { changedKeys, type FieldSpec } from '../model/saveModel';

/**
 * "Prices" (P3 W3a, C3 `prices`): the price list and how dancers pay, with the shared save
 * model. The rules are the old ones, called, never copied: the price list's lock, problems and
 * builder (events/seriesExtras), the payment codes and their builder (events/paymentModel).
 * "It's free" is the `free` payment code. Nothing here sends.
 */
export interface PricesDraft {
  /** Payment codes in screen order ('free' included). */
  methods: PaymentMethod[];
  rows: PriceRow[];
}

export function pricesDraftOf(ws: EventWorkspace): PricesDraft {
  return { methods: parsePayment(ws.series.payment_methods), rows: pricesLock(ws) ? [] : priceRows(ws) };
}

export const isFree = (d: PricesDraft) => d.methods.includes('free');

/** "It's free" on or off: the `free` code, the other picks kept. */
export const setFree = (d: PricesDraft, on: boolean): PricesDraft =>
  isFree(d) === on ? d : { ...d, methods: togglePayment(d.methods, 'free') };

/** How to pay without `free` (the switch carries it); a festival offers its ticket link only. */
export const payChoices = (ws: EventWorkspace): PaymentMethod[] => paymentChoices(ws).filter((m) => m !== 'free');

/** Rows compared as the builder sends them: a trailing space or 15 typed as 15.0 is no change (PR #1082 r1 #2). */
const sameRows = (a: unknown, b: unknown) => JSON.stringify((a as PriceRow[]).map(toPass)) === JSON.stringify((b as PriceRow[]).map(toPass));

/**
 * The fields, compared the way the builders send them. How to pay is compared as sent for THIS
 * event (a festival sends its ticket link only, so a stored door code is never a change).
 */
export const pricesSpecs = (ws: EventWorkspace): ReadonlyArray<FieldSpec<PricesDraft>> => [
  { key: 'methods', line: (d) => `${L.payHow}: ${d.methods.map((m) => PAYMENT_LABEL[m]).join(', ') || L.detailsNone}`, same: (a, b) => toSend(ws, a as PaymentMethod[]) === toSend(ws, b as PaymentMethod[]) },
  { key: 'rows', line: (d) => `${L.prices}: ${d.rows.length ? d.rows.map((r) => `${r.name.trim() || L.noName} ${priceLabel(r)}`).join(' \u00b7 ') : L.detailsNone}`, same: sameRows },
];

/** Why the price rows cannot be edited here (a list the team set up), or null. */
export const pricesLockOf = (ws: EventWorkspace): string | null => pricesLock(ws);

/** The stored list's size, for the locked note. */
export const storedPriceCount = passCount;

/** The problem the Save button names: only a changed price list is held to the price rules. */
export function pricesBlocker(ws: EventWorkspace, base: PricesDraft, draft: PricesDraft): string | null {
  return changedKeys(pricesSpecs(ws), base, draft).includes('rows') ? pricesProblem(draft.rows) : null;
}

/**
 * ONE series.upsert with `name` and only what changed: the price list whole (when it changed
 * and may be edited), the payment codes (when they changed). [] when nothing changed. Each part
 * comes from the old builder, so its rules (the owner pass shape, a festival's ticket link
 * only) hold here too.
 */
export function pricesPlan(ws: EventWorkspace, base: PricesDraft, draft: PricesDraft): OwnerCommand[] {
  const changed = new Set(changedKeys(pricesSpecs(ws), base, draft));
  if (!changed.size || pricesBlocker(ws, base, draft)) return [];
  const rows = changed.has('rows') && !pricesLock(ws) ? pricesCommand(ws, draft.rows) : null;
  const pay = changed.has('methods') ? paymentCommand(ws, draft.methods) : null;
  if (!rows && !pay) return [];
  return [upsertCommand({ ...(rows?.payload ?? {}), ...(pay?.payload ?? {}), name: ws.series.name })];
}
