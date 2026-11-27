import { useState } from 'react';
import type { EventWorkspace } from '../../events/eventModel';
import {
  FESTIVAL_PAYMENT_HELP, PAYMENT_HELP, PAYMENT_LABEL, parsePayment, paymentChoices, paymentCommand, togglePayment,
  type PaymentMethod,
} from '../../events/paymentModel';
import type { OwnerCommand } from '../../shared/seriesCommands';
import { V2Sheet } from './V2Sheet';

export const HOWPAY_TITLE = 'How dancers pay';
export const HOWPAY_EVERY_NIGHT = 'Every night of this event.';
export const HOWPAY_NONE = 'Pick at least one.';
export const HOWPAY_FAILED = 'Not saved. Try again.';

/** How dancers pay, series-wide (event_series_p5.payment_methods). An untouched Save sends nothing. */
export function HowToPaySheet({ ws, send, onClose }: {
  ws: EventWorkspace;
  /** Resolves true when the command was saved. */
  send: (commands: OwnerCommand[], version: number | null) => Promise<unknown>;
  onClose: () => void;
}) {
  const choices = paymentChoices(ws);
  const [picked, setPicked] = useState<PaymentMethod[]>(() => parsePayment(ws.series.payment_methods));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const weekly = ws.series.format !== 'one_off';
  const save = async () => {
    const shown = choices.filter((m) => picked.includes(m));
    if (!shown.length) { setErr(HOWPAY_NONE); return; }
    const cmd = paymentCommand(ws, picked);
    if (!cmd) { onClose(); return; }
    setBusy(true);
    setErr(null);
    try {
      const res = await send([cmd], ws.series.version);
      if (res === false) throw new Error('not_saved');
      onClose();
    } catch {
      setErr(HOWPAY_FAILED);
    } finally {
      setBusy(false);
    }
  };
  return (
    <V2Sheet open title={HOWPAY_TITLE} onClose={onClose}>
      <div className="grp" data-testid="howpay-sheet">
        <p className="txt">{choices.length === 1 ? FESTIVAL_PAYMENT_HELP : PAYMENT_HELP}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {choices.map((m) => (
            <button key={m} type="button" className={`btn ${picked.includes(m) ? 'pri' : 'sec'}`} data-testid="howpay-chip" aria-pressed={picked.includes(m)}
              style={{ minHeight: 44 }} onClick={() => { setErr(null); setPicked(togglePayment(picked, m)); }}>{PAYMENT_LABEL[m]}</button>
          ))}
        </div>
        {weekly ? <p className="hint">{HOWPAY_EVERY_NIGHT}</p> : null}
        {err ? <p className="err" role="alert" data-testid="howpay-err">{err}</p> : null}
        <button type="button" className="btn pri" data-testid="howpay-save" disabled={busy} aria-busy={busy} onClick={() => void save()}>{busy ? 'Saving\u2026' : 'Save'}</button>
      </div>
    </V2Sheet>
  );
}
