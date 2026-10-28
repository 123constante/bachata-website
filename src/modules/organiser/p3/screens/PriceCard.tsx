import { CURRENCIES, type Currency, type PriceRow } from '../../events/seriesExtras';
import { L } from '../model/labels';

/** One price of a list: the Prices screen (W3a) and a date's own price (W3b-2). */
export function PriceCard({ row, i, off, onChange, onRemove }: { row: PriceRow; i: number; off: boolean; onChange: (r: PriceRow) => void; onRemove: () => void }) {
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
