import { useState, type ReactNode } from 'react';
import { V2 } from './copy';
import { penceOf } from '../../tickets/ticketModel';
import { untilToInstant } from './EarlyBirds';
import type { PaymentMethod } from '../../events/paymentModel';

const G = V2.waysInGuide;

export type GuideStep = 'q1' | 'q2' | 'q3' | 'connect';

export interface GuideAnswers {
  /** "Online, by card" has no stored code (it is Stripe tickets), so it is its own answer. */
  online: boolean;
  /** door / ticket_link / free only */
  methods: PaymentMethod[];
  price: string;
  qty: string;
  early: boolean | null;
  earlyPrice: string;
  until: string;
}

export interface GuideResult { methods: PaymentMethod[]; ticket?: { pence: number; qty: number }; early?: { pence: number; until: string } }

const EMPTY: GuideAnswers = { online: false, methods: [], price: '', qty: '50', early: null, earlyPrice: '', until: '' };

/** The questions that will be asked, in order, for these answers. */
export function guideSteps(a: Pick<GuideAnswers, 'online'>, stripe: boolean): GuideStep[] {
  if (!a.online) return ['q1'];
  return stripe ? ['q1', 'q2', 'q3'] : ['q1', 'connect'];
}

/** Which screen comes next after `from` (null when the guide is finished). */
export function guideStep(answers: Pick<GuideAnswers, 'online'>, festival: boolean, stripe: boolean, from: GuideStep | null = null): GuideStep | null {
  void festival; // a festival only changes which Q1 cards exist; the order is the same
  const steps = guideSteps(answers, stripe);
  if (from === null) return steps[0];
  const i = steps.indexOf(from);
  return i >= 0 && i + 1 < steps.length ? steps[i + 1] : null;
}

const DAY = 86_400_000;
const shift = (ymd: string, by: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + by * DAY).toISOString().slice(0, 10);

/** 7 days before the first date, never before today. */
export const defaultUntil = (firstDate: string | null, today: string): string => {
  if (!firstDate) return today;
  const d = shift(firstDate, -7);
  return d < today ? today : d;
};

const labelStyle = { display: 'block', fontSize: 15, fontWeight: 600, color: '#030303', margin: '18px 0 6px' } as const;
const boxStyle = { display: 'flex', alignItems: 'center', gap: 6, minHeight: 56, padding: '0 14px', border: '1.5px solid #CFCFCF', borderRadius: 10, background: '#FFF', boxSizing: 'border-box' } as const;
const inputStyle = { flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', fontSize: 20, fontWeight: 700, color: '#030303', padding: '12px 0' } as const;
const subStyle = { fontSize: 15, color: '#464646', margin: '4px 0 8px' } as const;
const barBtn = { background: 'none', border: 0, padding: '10px 4px', minHeight: 44, fontSize: 16, fontWeight: 600, color: '#C2410C', cursor: 'pointer' } as const;

function Field({ id, label, pound, children }: { id: string; label: string; pound?: boolean; children: ReactNode }) {
  return (
    <div>
      <label style={labelStyle} htmlFor={id}>{label}</label>
      <div style={boxStyle}>{pound ? <span aria-hidden="true" style={{ fontSize: 20, fontWeight: 700, color: '#464646' }}>&pound;</span> : null}{children}</div>
    </div>
  );
}

const rowStyle = { width: '100%', minHeight: 56, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: '1.5px solid #CFCFCF', borderRadius: 10, background: '#FFF' } as const;

function Card({ id, label, sub, on, role = 'checkbox', onTap }: { id: string; label: string; sub?: string; on: boolean; role?: 'checkbox' | 'radio'; onTap: () => void }) {
  return (
    <button type="button" role={role} aria-checked={on} data-testid={id} style={{ ...rowStyle, borderColor: on ? '#C2410C' : '#CFCFCF' }} onClick={onTap}>
      <span aria-hidden="true" style={{ width: 22, height: 22, flex: 'none', borderRadius: 6, border: '2px solid #464646', background: on ? '#C2410C' : '#FFF', color: '#FFF', textAlign: 'center', lineHeight: '18px', fontSize: 15 }}>{on ? '✓' : ''}</span>
      <span style={{ display: 'flex', flexDirection: 'column', fontSize: 16 }}><b>{label}</b>{sub ? <span className="s" style={{ fontSize: 14, color: '#464646' }}>{sub}</span> : null}</span>
    </button>
  );
}

export interface WaysInGuideProps {
  oneOff: boolean;
  festival: boolean;
  stripe: boolean;
  /** first date of the event, YYYY-MM-DD, or null */
  firstDate: string | null;
  /** today, YYYY-MM-DD (a prop so every state renders the same in tests) */
  today: string;
  initial?: Partial<GuideAnswers>;
  onDone: (r: GuideResult) => void;
  /** gets the answers so far, so the door / link / free choice is saved before the Stripe redirect */
  onConnect: (r: GuideResult) => void;
  onClose: () => void;
}

/** The first-setup guide for Ways in (flag waysInRebuild). Pure view: one question per screen. */
export function WaysInGuideView(p: WaysInGuideProps) {
  const [a, setA] = useState<GuideAnswers>(() => ({ ...EMPTY, ...p.initial, until: p.initial?.until ?? defaultUntil(p.firstDate, p.today) }));
  const [step, setStep] = useState<GuideStep>('q1');
  const [tried, setTried] = useState(false);
  const set = (patch: Partial<GuideAnswers>) => setA((x) => ({ ...x, ...patch }));
  const steps = guideSteps(a, p.stripe);
  const at = steps.indexOf(step);

  const toggleMethod = (m: PaymentMethod) => {
    if (m === 'free') return set({ methods: a.methods.includes('free') ? [] : ['free'], online: false });
    const rest = a.methods.filter((x) => x !== 'free');
    set({ methods: rest.includes(m) ? rest.filter((x) => x !== m) : [...rest, m] });
  };
  const toggleOnline = () => set({ online: !a.online, methods: a.methods.filter((x) => x !== 'free') });
  const free = a.methods.includes('free');
  const picked = a.online || a.methods.length > 0;

  const result = (withTicket: boolean): GuideResult => {
    const r: GuideResult = { methods: a.methods };
    if (withTicket) {
      r.ticket = { pence: penceOf(a.price) as number, qty: Number(a.qty) };
      if (a.early) r.early = { pence: penceOf(a.earlyPrice) as number, until: untilToInstant(a.until) as string };
    }
    return r;
  };

  const go = (from: GuideStep) => {
    setTried(false);
    const n = guideStep(a, p.festival, p.stripe, from);
    if (n) setStep(n); else p.onDone(result(false));
  };

  const mainPence = penceOf(a.price);
  const earlyPence = penceOf(a.earlyPrice);
  const priceErr = mainPence === null || mainPence <= 0 ? G.priceBad : null;
  const qtyErr = !/^[1-9]\d{0,5}$/.test(a.qty.trim()) ? G.qtyBad : null;
  const earlyErr = a.early !== true ? null
    : earlyPence === null || earlyPence <= 0 ? G.earlyMissing
    : mainPence !== null && earlyPence >= mainPence ? G.earlyBad : null;
  const untilErr = a.early === true && (!a.until || (p.firstDate && a.until > p.firstDate)) ? G.untilBad : null;
  const q2Err = priceErr ?? qtyErr;

  const backTo: GuideStep | null = step === 'q2' ? 'q1' : step === 'q3' ? 'q2' : step === 'connect' ? 'q1' : null;
  const showNextHint = step === 'q1' && a.online && p.stripe;

  return (
    <div className="ev2 ev2-page v2-page" data-testid="ways-in-guide">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 }}>
        {backTo ? <button type="button" style={barBtn} data-testid="wg-back" onClick={() => { setTried(false); setStep(backTo); }}>&larr; {G.back}</button> : <span />}
        <button type="button" style={barBtn} data-testid="wg-close" onClick={p.onClose}>{G.close}</button>
      </div>
      <div data-testid="wg-dots" style={{ display: 'flex', gap: 6, margin: '4px 0 14px' }}>
        {steps.map((s, i) => <span key={s} data-testid="wg-dot" data-on={i <= at} style={{ flex: 1, height: 6, borderRadius: 3, background: i <= at ? '#C2410C' : '#CFCFCF' }} />)}
      </div>
      {step === 'q1' ? (
        <>
          <h1 className="ttl" data-testid="wg-title">{G.q1Title}</h1>
          <div className="sub" data-testid="wg-sub" style={subStyle}>{G.q1Sub}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Card id="wg-online" label={G.online} sub={G.onlineSub} on={a.online} onTap={toggleOnline} />
            {p.festival ? null : <Card id="wg-door" label={G.door} on={a.methods.includes('door')} onTap={() => toggleMethod('door')} />}
            <Card id="wg-link" label={G.link} on={a.methods.includes('ticket_link')} onTap={() => toggleMethod('ticket_link')} />
            {p.festival ? null : <Card id="wg-free" label={G.free} on={free} onTap={() => toggleMethod('free')} />}
          </div>
          <button type="button" className="btn pri big" data-testid="wg-next" disabled={!picked} onClick={() => go('q1')} style={{ marginTop: 18 }}>{G.next}</button>
          {showNextHint ? <p data-testid="wg-next-hint" style={{ ...subStyle, marginTop: 12 }}>{G.q1NextHint}</p> : null}
        </>
      ) : null}
      {step === 'q2' ? (
        <>
          <h1 className="ttl" data-testid="wg-title">{G.q2Title}</h1>
          <div className="sub" style={subStyle}>{G.q2Sub}</div>
          <Field id="wg-price" label={G.price} pound>
            <input id="wg-price" data-testid="wg-price" style={inputStyle} type="text" inputMode="decimal" placeholder="10" value={a.price} onChange={(e) => set({ price: e.target.value })} />
          </Field>
          <Field id="wg-qty" label={p.oneOff ? G.qtyOne : G.qtyNight}>
            <input id="wg-qty" data-testid="wg-qty" style={inputStyle} type="number" min="1" inputMode="numeric" value={a.qty} onChange={(e) => set({ qty: e.target.value })} />
          </Field>
          {tried && q2Err ? <p className="err" role="alert" data-testid="wg-err">{q2Err}</p> : null}
          <button type="button" className="btn pri big" data-testid="wg-next" style={{ marginTop: 18 }} onClick={() => { if (q2Err) setTried(true); else go('q2'); }}>{G.next}</button>
        </>
      ) : null}
      {step === 'q3' ? (
        <>
          <h1 className="ttl" data-testid="wg-title">{G.q3Title}</h1>
          <div className="sub" style={subStyle}>{G.q3Sub}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Card id="wg-early-yes" role="radio" label={G.yes} on={a.early === true} onTap={() => set({ early: true })} />
            <Card id="wg-early-no" role="radio" label={G.no} on={a.early === false} onTap={() => set({ early: false })} />
          </div>
          {a.early === true ? (
            <>
              <Field id="wg-early-price" label={G.earlyPrice} pound>
                <input id="wg-early-price" data-testid="wg-early-price" style={inputStyle} type="text" inputMode="decimal" value={a.earlyPrice} onChange={(e) => set({ earlyPrice: e.target.value })} />
              </Field>
              <Field id="wg-until" label={G.until}>
                <input id="wg-until" data-testid="wg-until" style={inputStyle} type="date" value={a.until} min={p.today} onChange={(e) => set({ until: e.target.value })} />
              </Field>
            </>
          ) : null}
          {tried && (earlyErr ?? untilErr) ? <p className="err" role="alert" data-testid="wg-err">{earlyErr ?? untilErr}</p> : null}
          <button type="button" className="btn pri big" data-testid="wg-finish" style={{ marginTop: 18 }} disabled={a.early === null} onClick={() => { if (earlyErr || untilErr) setTried(true); else p.onDone(result(true)); }}>{G.done}</button>
        </>
      ) : null}
      {step === 'connect' ? (
        <>
          <h1 className="ttl" data-testid="wg-title">{G.connectTitle}</h1>
          <button type="button" className="btn pri big" data-testid="wg-connect" style={{ marginTop: 18 }} onClick={() => p.onConnect(result(false))}>{G.connect}</button>
          <button type="button" className="btn sec" data-testid="wg-later" style={{ marginTop: 10 }} onClick={() => p.onDone(result(false))}>{G.later}</button>
        </>
      ) : null}
    </div>
  );
}
