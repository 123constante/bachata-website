import { useState } from 'react';
import { V2 } from './copy';
import { V2Sheet } from './V2Sheet';

const T = V2.ticketsPay;

/** SH-DOOR: the usual price at the door. `weekdayHint` is the weekly line; null on a one-off. */
export function DoorSheet({ price, day, error, onDone, onClose }: { price: number | null; day: string | null; error?: string | null; onDone: (raw: string) => void; onClose: () => void }) {
  const [raw, setRaw] = useState(price != null ? String(price) : '');
  return (
    <V2Sheet open title={T.doorTitle} onClose={onClose}>
      <div className="grp">
        <label className="flab" htmlFor="d-door">{T.doorField}</label>
        <input id="d-door" className="fld" type="number" min="0" step="0.5" inputMode="decimal" value={raw} onChange={(e) => setRaw(e.target.value)} />
        {day ? <p className="hint" data-testid="door-hint">{T.doorHint(day)}</p> : null}
        {error ? <p className="err" role="alert" data-testid="door-err">{error}</p> : null}
        <button type="button" className="btn pri" data-testid="door-done" onClick={() => onDone(raw)}>{V2.done}</button>
      </div>
    </V2Sheet>
  );
}

/** SH-PAY-04: where dancers buy. An empty link shows "Add a link" and writes nothing. */
export function LinkSheet({ link, error, onDone, onClose }: { link: string; error?: string | null; onDone: (url: string) => void; onClose: () => void }) {
  const [raw, setRaw] = useState(link);
  const [empty, setEmpty] = useState(false);
  const done = () => {
    if (!raw.trim()) { setEmpty(true); return; }
    onDone(raw.trim());
  };
  return (
    <V2Sheet open title={T.linkTitle} onClose={onClose}>
      <div className="grp">
        <label className="flab" htmlFor="f-link-in">{T.linkField}</label>
        <input id="f-link-in" className="fld" type="url" placeholder="https://" value={raw} onChange={(e) => { setRaw(e.target.value); setEmpty(false); }} />
        {empty ? <p className="err" role="alert" data-testid="link-err">{T.linkEmpty}</p> : null}
        {!empty && error ? <p className="err" role="alert" data-testid="link-save-err">{error}</p> : null}
        <button type="button" className="btn pri" data-testid="link-done" onClick={done}>{V2.done}</button>
      </div>
    </V2Sheet>
  );
}

/** SH-PAY-05 / 06: How dancers pay. "Pay at the door" is hidden when the door is already how they pay. */
export function HowPaySheet({ door, hasLink, onDoor, onLink, onClose }: { door: boolean; hasLink: boolean; onDoor: () => void; onLink: () => void; onClose: () => void }) {
  return (
    <V2Sheet open title={T.howTitle} onClose={onClose}>
      <div className="grp">
        <p className="txt">{T.howText}</p>
        {door ? null : <button type="button" className="btn sec" data-testid="how-door" onClick={onDoor}>{T.payDoor}</button>}
        <button type="button" className="btn sec" data-testid="how-link" onClick={onLink}>{hasLink ? T.changeLink : T.addLink}</button>
      </div>
    </V2Sheet>
  );
}

/** SH-PAY-02 / 03: leaving "sell here" once tickets are sold. Buyers keep what they bought. */
export function SwitchPaySheet({ sold, onSwitch, onKeep }: { sold: number; onSwitch: () => void; onKeep: () => void }) {
  return (
    <V2Sheet open title={T.switchTitle} onClose={onKeep}>
      <div className="grp">
        <p className="txt" data-testid="switch-text">{T.switchText(sold)}</p>
        <button type="button" className="btn pri" data-testid="switch-do" onClick={onSwitch}>{T.switchDo}</button>
        <button type="button" className="btn sec" data-testid="switch-keep" onClick={onKeep}>{T.switchKeep}</button>
      </div>
    </V2Sheet>
  );
}
