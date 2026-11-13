import { formatPence, isoToLondonInput, londonInputToIso, penceOf, poundsText, strOrNull, num } from './ticketModel';

/**
 * T3 (docs/briefs/design-ticketing-organisers.md s.2c, s.2d, s.3c): the organiser's price steps.
 * A ticket type keeps its BASE price; up to 3 later steps change it from an instant. Pure: the
 * screen (p3/tickets/PriceSteps.tsx) and the tests read this one mapping. The server decides
 * whether a step is live (`is_live`); the client never compares a step with its own clock.
 */

export const MAX_STEPS = 3;

export interface PriceStep {
  id: string;
  /** timestamptz from the server. */
  effectiveFrom: string;
  pricePence: number;
  /** effective_from <= now() on the server: frozen, cannot be moved or removed. */
  isLive: boolean;
}

/** One row of ticket_types_manage_v1. */
export interface ManagedType {
  id: string;
  basePricePence: number;
  effectivePricePence: number;
  hasOrders: boolean;
  hasPriceSteps: boolean;
  steps: PriceStep[];
}

export interface ManageResult {
  ok: boolean;
  reason: string | null;
  types: ManagedType[];
}

export const parseManage = (data: unknown): ManageResult => {
  const d = (data ?? {}) as { ok?: unknown; reason?: unknown; ticket_types?: unknown };
  if (d.ok !== true) return { ok: false, reason: typeof d.reason === 'string' ? d.reason : 'unknown', types: [] };
  const rows = Array.isArray(d.ticket_types) ? (d.ticket_types as Record<string, unknown>[]) : [];
  return {
    ok: true,
    reason: null,
    types: rows.map((r) => {
      const steps = (Array.isArray(r.steps) ? (r.steps as Record<string, unknown>[]) : [])
        .map((s) => ({ id: String(s.id), effectiveFrom: strOrNull(s.effective_from) ?? '', pricePence: num(s.price_pence), isLive: s.is_live === true }))
        .filter((s) => s.effectiveFrom !== '')
        .sort((a, b) => new Date(a.effectiveFrom).getTime() - new Date(b.effectiveFrom).getTime());
      return {
        id: String(r.id),
        basePricePence: num(r.base_price_pence),
        effectivePricePence: num(r.effective_price_pence),
        hasOrders: r.has_orders === true,
        hasPriceSteps: r.has_price_steps === true || steps.length > 0,
        steps,
      };
    }),
  };
};

// ---- Copy (one place; the screen and the tests both read it) -----------------------------

export const STEPS_TITLE = 'Price changes';
export const STEPS_EMPTY =
  'No price changes yet. Add one to raise or drop the price from a date and time you choose, for example when an early-bird price ends.';
export const STEPS_FULL = '3 price changes is the most. Remove one to add another.';
export const STEPS_FREE = 'Free tickets cannot have price changes. Give this ticket a price and save it first.';
export const STEPS_ORDERS_NOTE = 'Existing buyers keep the price they paid.';
export const RESERVE_NOT_READY_TEXT = 'Price changes open once the new checkout is live.';
export const FREE_WITH_STEPS = 'Remove the price changes first; a ticket with price changes cannot be free.';
export const TIME_DOES_NOT_EXIST = 'This time does not exist in the UK, the clocks go forward. Pick another time.';
export const STEP_LIVE_NOTE = 'This price is in use now, so it cannot be moved or removed.';
export const STEPS_UNSAVED = 'Save this ticket first, then add price changes.';

const STEP_REASON: Record<string, string> = {
  reserve_not_ready: RESERVE_NOT_READY_TEXT,
  too_many_steps: STEPS_FULL,
  not_paid_ticket: STEPS_FREE,
  time_does_not_exist: TIME_DOES_NOT_EXIST,
  step_in_past: 'That time has passed, or this price change has already started. Pick a later time.',
  out_of_order: 'Another price change starts at that exact time. Pick a different time.',
  same_price: 'The price is already that at that time. Pick a different price.',
  invalid_price: 'Enter a price from £0.01 to £10,000.',
  invalid_payload: 'Pick a date and time and enter a price.',
  not_found: 'This ticket or price change is no longer there. Reload the page.',
  has_price_steps: FREE_WITH_STEPS,
};

/** The words for a step writer's refusal; anything unknown is the shared "try again". */
export const stepReasonMessage = (reason: string | null | undefined): string =>
  (reason && STEP_REASON[reason]) || 'That did not work. Try again in a moment.';

// ---- Time (s.2c): London wall clock in the field, true instants on the wire --------------

const LONDON_LABEL = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZoneName: 'short',
});

/** "Sunday, 28 March 2027, 02:30 BST", always in Europe/London whatever the phone's zone. */
export const londonLabel = (iso: string): string => LONDON_LABEL.format(new Date(iso)).replace(/ at /, ', ');

/** The copy under each step (brief, exact). */
export const appliesLine = (iso: string): string => `This new price applies to every night of this ticket from ${londonLabel(iso)}.`;

/** A London wall-clock value that the clocks skip (spring forward): it never happens. */
export const timeDoesNotExist = (value: string): boolean => {
  const iso = londonInputToIso(value);
  return !!iso && isoToLondonInput(iso) !== value;
};

/** A wall-clock time that happens twice (autumn): londonInputToIso resolves it to the LATER instant (GMT). */
export const isAmbiguousTime = (value: string): boolean => {
  const iso = londonInputToIso(value);
  if (!iso || timeDoesNotExist(value)) return false;
  return isoToLondonInput(new Date(new Date(iso).getTime() - 3_600_000).toISOString()) === value;
};

/** The note under the field for an ambiguous time (s.2c). */
export const ambiguousNote = (value: string): string => `${value.slice(11, 16)} GMT (after the clocks go back)`;

// ---- The form, its checks and the one command it sends -----------------------------------

export interface StepForm {
  /** 'YYYY-MM-DDTHH:mm' London. */
  at: string;
  /** Pounds text. */
  price: string;
}

export const stepFormOf = (s: PriceStep | null): StepForm =>
  s ? { at: isoToLondonInput(s.effectiveFrom), price: poundsText(s.pricePence) } : { at: '', price: '' };

export type StepErrors = Partial<Record<keyof StepForm, string>>;

export const validateStep = (f: StepForm): StepErrors => {
  const e: StepErrors = {};
  if (!londonInputToIso(f.at)) e.at = 'Pick a date and time.';
  else if (timeDoesNotExist(f.at)) e.at = TIME_DOES_NOT_EXIST;
  const p = penceOf(f.price);
  if (p === null || p <= 0) e.price = 'Enter a price in pounds, for example 15.00.';
  return e;
};

/** ticket_price_step_set_v1's arguments, exactly. */
export interface StepCommand {
  p_ticket_type_id: string;
  p_step_id: string | null;
  p_effective_from: string;
  p_price_pence: number;
}

/**
 * The write the form asks for, or null when there is nothing to send (an untouched move).
 * A form with errors is the caller's to stop (validateStep) before this is asked.
 */
export const buildStepCommand = (typeId: string, f: StepForm, original: PriceStep | null): StepCommand | null => {
  const iso = londonInputToIso(f.at);
  const pence = penceOf(f.price);
  if (!iso || pence === null) return null;
  if (original && new Date(original.effectiveFrom).getTime() === new Date(iso).getTime() && original.pricePence === pence) return null;
  return { p_ticket_type_id: typeId, p_step_id: original?.id ?? null, p_effective_from: iso, p_price_pence: pence };
};

/** Why "Add a price change" is disabled, or null (the button shows its reason, never a dead tap). */
export const addBlock = (t: Pick<ManagedType, 'basePricePence' | 'steps'>): string | null => {
  if (t.basePricePence <= 0) return STEPS_FREE;
  if (t.steps.length >= MAX_STEPS) return STEPS_FULL;
  return null;
};

/** "Rises to" / "Drops to", against the price in force just before the step. */
export const stepVerb = (steps: readonly PriceStep[], i: number, basePence: number): string => {
  const before = i === 0 ? basePence : steps[i - 1].pricePence;
  return steps[i].pricePence > before ? `Rises to ${formatPence(steps[i].pricePence)}` : `Drops to ${formatPence(steps[i].pricePence)}`;
};
