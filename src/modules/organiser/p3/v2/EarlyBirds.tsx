import { formatPence, isoToLondonInput, londonInputToIso, penceOf, poundsText } from '../../tickets/ticketModel';
import { MAX_STEPS, type PriceStep } from '../../tickets/priceSteps';
import { V2 } from './copy';

const T = V2.ticketSheet;

export interface Bird { price: string; until: string }

const DAY = 86_400_000;
const shiftDay = (ymd: string, by: number): string => new Date(Date.parse(`${ymd}T00:00:00Z`) + by * DAY).toISOString().slice(0, 10);

/** "Until Tuesday" means the new price starts the next morning, London time. */
export const untilToInstant = (until: string): string | null => (/^\d{4}-\d{2}-\d{2}$/.test(until) ? londonInputToIso(`${shiftDay(until, 1)}T00:00`) : null);
export const instantToUntil = (iso: string): string => shiftDay(isoToLondonInput(iso).slice(0, 10), -1);

/**
 * Stored shape -> sheet shape. A type keeps a BASE price and up to 3 later steps; the sheet shows the price
 * everyone ends up paying plus one early bird row per earlier price (the last step's price is the main price).
 */
export function formOfStored(basePence: number, steps: readonly PriceStep[]): { price: string; birds: Bird[] } {
  if (!steps.length) return { price: basePence ? poundsText(basePence) : '', birds: [] };
  const prices = [basePence, ...steps.map((s) => s.pricePence)];
  return {
    price: poundsText(prices[prices.length - 1]),
    birds: steps.map((s, i) => ({ price: poundsText(prices[i]), until: instantToUntil(s.effectiveFrom) })),
  };
}

export interface Wanted { basePence: number; steps: { at: string; pence: number }[] }

/** Sheet shape -> the base price and steps to store, or an error line the person can act on. */
export function wantedOf(free: boolean, price: string, birds: readonly Bird[]): Wanted | { error: string } {
  if (free) return { basePence: 0, steps: [] };
  const main = penceOf(price);
  if (main === null || main <= 0) return { error: T.priceBad };
  if (!birds.length) return { basePence: main, steps: [] };
  if (birds.length > MAX_STEPS) return { error: T.birdMax };
  const rows = birds.map((b) => ({ pence: penceOf(b.price), at: untilToInstant(b.until), until: b.until }));
  if (rows.some((r) => r.pence === null || r.pence <= 0 || !r.at)) return { error: T.birdBad };
  const sorted = [...rows].sort((a, b) => a.until.localeCompare(b.until));
  const prices = [...sorted.map((r) => r.pence as number), main];
  return { basePence: prices[0], steps: sorted.map((r, i) => ({ at: r.at as string, pence: prices[i + 1] })) };
}

/** Prototype rule: an early price at or above the main price. */
export const birdsLookWrong = (price: string, birds: readonly Bird[]): boolean => {
  const main = Number(price);
  return birds.some((b) => Number(b.price) >= main);
};

export function EarlyBirds(p: { price: string; birds: Bird[]; oneOff: boolean; disabled?: boolean; onChange: (b: Bird[]) => void }) {
  const mainPence = penceOf(p.price);
  const main = mainPence !== null ? formatPence(mainPence) : T.theMainPrice;
  const set = (i: number, patch: Partial<Bird>) => p.onChange(p.birds.map((b, k) => (k === i ? { ...b, ...patch } : b)));
  return (
    <div className="grp" data-testid="eb">
      <div className="flab">{T.birdsLabel}</div>
      {p.birds.map((b, i) => (
        <div key={i} data-testid={`eb-row-${i}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 44px', gap: 8, alignItems: 'end' }}>
          <div className="grp">
            <label className="flab" htmlFor={`e-price-${i}`}>{T.birdPrice}</label>
            <input id={`e-price-${i}`} data-testid={`e-price-${i}`} className="fld" type="number" min="0" step="0.5" inputMode="decimal" value={b.price} disabled={p.disabled} onChange={(e) => set(i, { price: e.target.value })} />
          </div>
          <div className="grp">
            <label className="flab" htmlFor={`e-until-${i}`}>{T.birdUntil}</label>
            <input id={`e-until-${i}`} data-testid={`e-until-${i}`} className="fld" type="date" value={b.until} disabled={p.disabled} onChange={(e) => set(i, { until: e.target.value })} />
          </div>
          <button type="button" data-testid={`eb-del-${i}`} aria-label={T.birdRemove} disabled={p.disabled} onClick={() => p.onChange(p.birds.filter((_, k) => k !== i))}
            style={{ width: 44, height: 44, minHeight: 44, border: '1px solid #CFCFCF', borderRadius: 8, background: '#FFF', fontSize: 20, lineHeight: 1 }}>&times;</button>
        </div>
      ))}
      <p className="hint" data-testid="eb-hint">{p.birds.length ? T.thenPrice(main) : T.oneFixed}</p>
      {p.birds.length && birdsLookWrong(p.price, p.birds) ? <p className="warn" data-testid="eb-warn">{T.birdWarn(main)}</p> : null}
      <button type="button" className="btn sec" data-testid="eb-add" disabled={p.disabled || p.birds.length >= MAX_STEPS}
        onClick={() => p.onChange([...p.birds, { price: String(Math.max(1, (Number(p.price) || 3) - 2)), until: '' }])}>{T.birdAdd}</button>
      {p.birds.length >= MAX_STEPS ? <p className="hint">{T.birdMax}</p> : null}
      {p.oneOff ? null : <p className="hint" data-testid="eb-same">{T.birdSameDate}</p>}
    </div>
  );
}
