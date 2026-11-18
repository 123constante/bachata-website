import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BUYER_ONBOARDING_ENABLED } from '@/lib/buyerOnboardingFlag';
import { fetchPublicTicketTypes, postTicketCheckout, publicTicketKeys } from './ticketCheckoutApi';
import {
  CANCELLED_PARAM, MAX_PER_ORDER, PREVIEW_ORIGIN_REASON, TERMS_REASON, THANKS_PATH, availability, checkoutOriginOk, formatPence, maxQuantity, reasonCopy, typesForNight,
} from './ticketCheckoutModel';
import { PRICE_CONFIRM_LABEL, parsePriceChanged, priceChangedText, stepReasonCopy } from './priceSteps';
import { PRIVACY_PARAGRAPH, PRIVACY_POLICY_LINE, TERMS_CHECKBOX_LABEL, TERMS_OF_SALE } from './legalCopy';
import { saveOrderId } from './orderStorage';
import { CodeBoxes } from './CodeBoxes';
import {
  CANCELLED_NOTE, CODE_LENGTH, ORDER_CAP_NOTE, RESEND_SECONDS, TRUST_LINE_BOLD, TRUST_LINE_REST, basketKey, basketTotals, buildPickerBody,
  cleanBasket, countLabel, dateOnly, heldFrom, isEmail, loadBasket, perLine, roomFor, saveBasket, sendCodeError, verifyCodeError,
  type Basket, type PickerHeld,
} from './pickerModel';

/**
 * Ticket picker B1 (flag ticketPickerB1; docs/briefs/ticket-buyer-picker.md). A white checkout:
 * pick, Continue, email card, 6-digit code card, "Opening secure payment", Stripe.
 * Promo is a STUB: the box and its states exist, no code is ever accepted (no backend yet).
 */
export interface TicketPickerB1Props {
  seriesId: string;
  occurrenceId: string | null;
  title: string;
  dateLine: string | null;
  venueLine?: string | null;
  onClose: () => void;
  now?: Date;
}

type Stage = 'pick' | 'email' | 'code' | 'open';

const INK = '#17211c', SUB = '#5f6e66', LINE = '#e3e9e6', BRAND = '#14604a', BAD = '#b3261e';
const buzz = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* no vibration here */ } };

function Trust() {
  return (
    <div className="mt-[10px] flex items-center justify-center gap-2 text-[12px]" style={{ color: SUB }}>
      <Lock aria-hidden="true" width={14} height={14} />
      <span><b style={{ color: INK, fontWeight: 600 }}>{TRUST_LINE_BOLD}</b> {TRUST_LINE_REST}</span>
    </div>
  );
}

const NOT_YOU_FAILED = 'We could not sign you out. Try again.';

export function TicketPickerB1({ seriesId, occurrenceId, title, dateLine, venueLine, onClose, now: nowProp }: TicketPickerB1Props) {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const now = useMemo(() => nowProp ?? new Date(), [nowProp]);
  const { data } = useQuery({
    queryKey: publicTicketKeys.types(seriesId, occurrenceId),
    queryFn: () => fetchPublicTicketTypes(seriesId, occurrenceId),
    staleTime: 30_000,
  });
  const types = useMemo(() => typesForNight(data ?? [], occurrenceId).filter((t) => availability(t, now).kind !== 'needs_night'), [data, occurrenceId, now]);
  const [basket, setBasket] = useState<Basket>(() => loadBasket(seriesId, occurrenceId));
  const [stage, setStage] = useState<Stage>('pick');
  const [email, setEmail] = useState('');
  const [emailBad, setEmailBad] = useState(false);
  const [digits, setDigits] = useState<string[]>(() => Array(CODE_LENGTH).fill(''));
  const [codeErr, setCodeErr] = useState('');
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sendErr, setSendErr] = useState('');
  const [secs, setSecs] = useState(0);
  const [promo, setPromo] = useState('');
  const [promoMsg, setPromoMsg] = useState('');
  const [promoChecking, setPromoChecking] = useState(false);
  const [refusal, setRefusal] = useState('');
  const [held, setHeld] = useState<PickerHeld | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const knownEmail = user?.email ?? verifiedEmail;
  const [notYouBusy, setNotYouBusy] = useState(false);
  const [notYouErr, setNotYouErr] = useState('');
  // The error belongs to one signed-in address: a different (or no) address means it is stale.
  useEffect(() => { setNotYouErr(''); }, [knownEmail]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [cancelled] = useState(() => new URLSearchParams(location.search).get(CANCELLED_PARAM) === 'cancelled');
  const inFlight = useRef(false);
  const boxes = useRef<Array<HTMLInputElement | null>>([]);

  const clean = useMemo(() => cleanBasket(basket, types, now), [basket, types, now]);
  const sum = basketTotals(clean, types);
  // A price_changed holds only for the basket it was priced for.
  const heldNow = held && held.key === basketKey(clean) ? held : null;
  const payPence = heldNow ? heldNow.totalPence : sum.totalPence;
  const priceNote = heldNow ? priceChangedText(heldNow.totalPence) : '';
  const atCap = sum.count >= MAX_PER_ORDER;
  // Before any field: a preview can never complete checkout (same guard as the classic page).
  const blocked = sum.count === 0 ? null : !checkoutOriginOk(window.location.origin) ? PREVIEW_ORIGIN_REASON : !termsAccepted ? TERMS_REASON : null;
  const continueOff = sum.count === 0 || blocked !== null;
  useEffect(() => { saveBasket(seriesId, occurrenceId, clean); }, [seriesId, occurrenceId, clean]);

  // The phone's Back closes the page, as the classic page does.
  useEffect(() => {
    window.history.pushState({ eventTickets: true }, '');
    const onPop = () => onClose();
    window.addEventListener('popstate', onPop);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('popstate', onPop); document.body.style.overflow = prev; };
  }, [onClose]);

  useEffect(() => {
    if (secs <= 0) return;
    const id = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secs]);

  // Back from Stripe can restore this page from the bfcache mid-handoff.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) { inFlight.current = false; setStage('pick'); } };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  const step = (id: string, d: number) => {
    const t = types.find((x) => x.id === id);
    if (!t) return;
    setRefusal(''); setHeld(null); // any basket change spends a held price_changed
    const n = clean[id] ?? 0;
    setBasket({ ...clean, [id]: Math.max(0, d > 0 ? n + Math.min(d, roomFor(t, clean, now)) : n + d) });
  };

  async function startPayment(buyerEmail: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setStage('open');
    const body = buildPickerBody({ basket: clean, types, email: buyerEmail, occurrenceId, origin: window.location.origin, pathname: location.pathname, search: location.search, held: heldNow });
    setRefusal(''); setHeld(null);
    const r = await postTicketCheckout(body);
    if (r.kind === 'redirect') { saveOrderId(r.orderId); window.location.assign(r.url); return; }
    inFlight.current = false;
    if (r.kind === 'free') { saveOrderId(r.orderId); window.location.assign(`${THANKS_PATH}?o=${encodeURIComponent(r.orderId)}&free=1`); return; }
    setStage('pick');
    const reread = () => { void queryClient.invalidateQueries({ queryKey: publicTicketKeys.types(seriesId, occurrenceId) }); };
    // Nothing was charged: re-price the basket from the reply and wait for the buyer's confirm tap.
    if (r.reason === 'price_changed') {
      const pc = parsePriceChanged(r.raw);
      if (pc) setHeld(heldFrom(pc, clean, types));
      else setRefusal(reasonCopy('price_changed_unreadable').text);
      reread();
      return;
    }
    const copy = stepReasonCopy(r.reason, null) ?? reasonCopy(r.reason, r.message);
    // The picker has no night list: a night refusal points at the Back control that IS on screen.
    setRefusal(copy.way === 'pick_night' ? 'Tickets for this night cannot be booked now. Go Back to pick another night.' : copy.text);
    // A refusal about stock or status means the list on screen is stale: re-read it.
    if (copy.way === 'pick_another' || copy.way === 'pick_night') reread();
  }

  function onContinue() {
    if (continueOff) return;
    if (knownEmail) { void startPayment(knownEmail); return; }
    setEmailBad(false); setSendErr(''); setStage('email');
  }

  // "Not you?": sign out on this device, keep the basket (it lives in storage, not the session),
  // then the email + code card runs for the new address.
  // A failed sign-out leaves the old account signed in: say so plainly and stay put.
  async function notYou() {
    if (notYouBusy) return;
    setNotYouBusy(true); setNotYouErr('');
    let outcome: Awaited<ReturnType<typeof signOut>>;
    try { outcome = await signOut(); } catch { outcome = 'failed'; }
    setNotYouBusy(false);
    if (outcome === 'failed') { setNotYouErr(NOT_YOU_FAILED); return; }
    setVerifiedEmail(''); setEmail(''); setEmailBad(false); setSendErr(''); setStage('email');
  }

  async function sendCode() {
    const v = email.trim();
    if (!isEmail(v)) { setEmailBad(true); return; }
    setEmailBad(false); setBusy(true); setSendErr('');
    const { error } = await supabase.auth.signInWithOtp({ email: v, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) { setSendErr(sendCodeError(error)); return; }
    setDigits(Array(CODE_LENGTH).fill('')); setCodeErr(''); setSecs(RESEND_SECONDS); setStage('code');
  }

  async function checkCode(code: string) {
    if (busy) return;
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: 'email' });
    setBusy(false);
    if (!error) { setCodeErr(''); setVerifiedEmail(email.trim()); void startPayment(email.trim()); return; }
    setCodeErr(verifyCodeError(error));
    setShake(true); setTimeout(() => setShake(false), 300); buzz([40, 60, 40]);
    setDigits(Array(CODE_LENGTH).fill(''));
    boxes.current[0]?.focus();
  }

  async function applyPromo() {
    if (!promo.trim()) { setPromoMsg('Enter a code first.'); buzz([40, 60, 40]); return; }
    setPromoChecking(true); setPromoMsg('');
    await Promise.resolve();
    setPromoChecking(false);
    setPromoMsg('Promo codes are not available yet.'); buzz([40, 60, 40]);
  }

  const date = dateOnly(dateLine);
  const outline = { border: `1px solid ${LINE}`, color: INK, background: '#fff' } as const;
  const btn = 'h-[46px] w-full rounded-[10px] text-[14px] font-semibold disabled:opacity-100';
  const primary = (off: boolean) => ({ background: off ? '#f4f6f5' : BRAND, color: off ? '#9aa8a1' : '#fff' });

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Tickets" data-testid="ticket-picker-b1" className="fixed inset-0 z-50 flex flex-col" style={{ background: '#fff', color: INK }}>
      <div className="mx-auto flex min-h-0 w-full max-w-[430px] flex-1 flex-col">
        <nav className="flex shrink-0 items-center px-[18px] pt-[14px]">
          <button type="button" onClick={() => window.history.back()} data-testid="tickets-back" className="h-[44px] pr-3 text-[15px]" style={{ color: SUB }}>&lsaquo; Back</button>
        </nav>
        <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-3">
          <header className="pb-[14px] pt-1">
            <h1 className="break-words text-[19px] font-semibold leading-tight" style={{ color: INK }}>{title}</h1>
            {date && <p className="mt-[2px] text-[14px]" style={{ color: SUB }}>{date}</p>}
            {venueLine && <p data-testid="tickets-venue" className="break-words text-[14px]" style={{ color: SUB }}>{venueLine}</p>}
          </header>
          {cancelled && <p role="status" data-testid="picker-cancelled" className="mb-[10px] rounded-[10px] px-3 py-[10px] text-[14px]" style={{ background: '#f4f6f5' }}>{CANCELLED_NOTE}</p>}
          {(refusal || priceNote) && <p role="alert" data-testid="picker-refusal" className="mb-[10px] rounded-[10px] px-3 py-[10px] text-[14px]" style={{ background: '#f4f6f5', color: BAD }}>{priceNote || refusal}</p>}
          {data && types.length === 0 && <p className="text-[14px]" style={{ color: SUB }}>No tickets are on sale for this night. Check the event page for other ways in.</p>}
          {types.map((t, ix) => {
            const max = maxQuantity(t, now);
            const n = clean[t.id] ?? 0;
            const room = roomFor(t, clean, now);
            const a = availability(t, now);
            const per = perLine(t);
            return (
              <div key={t.id} data-testid="picker-row" className="flex items-start justify-between gap-3 py-[14px]" style={{ borderTop: `1px solid ${LINE}`, ...(ix === types.length - 1 ? { borderBottom: `1px solid ${LINE}` } : {}) }}>
                <div className="min-w-0">
                  <div className="break-words text-[15px] font-semibold">{t.name}</div>
                  {max === 0 && <div className="mt-[2px] text-[13px]" style={{ color: SUB }}>{a.label}</div>}
                  {per && <div className="mt-1 text-[13px]" style={{ color: BRAND }}>{per}</div>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <div className="text-[17px] font-semibold tabular-nums">{formatPence(t.pricePence)}</div>
                  {max > 0 && (
                    <div className="flex items-center gap-[2px]">
                      <button type="button" aria-label={`Remove one ${t.name}`} disabled={n === 0} onClick={() => step(t.id, -1)} className="h-[40px] w-[40px] rounded-full text-[20px] disabled:text-[#c3cdc8]" style={outline}>&minus;</button>
                      <output aria-label={`${t.name} count`} className="w-[28px] text-center text-[15px] font-semibold tabular-nums">{n}</output>
                      <button type="button" aria-label={`Add one ${t.name}`} disabled={room === 0} onClick={() => step(t.id, 1)} className="h-[40px] w-[40px] rounded-full text-[20px] disabled:text-[#c3cdc8]" style={{ ...outline, borderColor: BRAND, color: BRAND }}>+</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {atCap && <p role="status" data-testid="picker-cap" className="mt-[10px] text-[13px]" style={{ color: SUB }}>{ORDER_CAP_NOTE}</p>}
          {types.length > 0 && (
            <div className="mt-4">
              <label htmlFor="picker-promo" className="mb-[6px] block text-[13px] font-semibold">Promo code</label>
              <div className="flex gap-2">
                <input id="picker-promo" value={promo} onChange={(e) => { setPromo(e.target.value.toUpperCase()); setPromoMsg(''); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void applyPromo(); } }}
                  autoComplete="off" autoCapitalize="characters" placeholder="Enter code" disabled={promoChecking}
                  className="h-[44px] min-w-0 flex-1 rounded-[10px] px-3 text-[15px]" style={{ border: `1px solid ${promoMsg ? BAD : LINE}`, background: '#fff', color: INK }} />
                <button type="button" onClick={() => void applyPromo()} disabled={promoChecking} className="h-[44px] rounded-[10px] px-4 text-[14px] font-semibold" style={{ border: `1px solid ${BRAND}`, color: BRAND, background: '#fff' }}>{promoChecking ? <>Checking&hellip;</> : 'Apply'}</button>
              </div>
              <div role="status" data-testid="picker-promo-msg" className="mt-[6px] min-h-[16px] text-[13px]" style={{ color: BAD }}>{promoMsg}</div>
              <button type="button" aria-expanded={showTerms} onClick={() => setShowTerms((v) => !v)} className="min-h-[44px] text-[13px] underline" style={{ color: SUB }}>
                {showTerms ? 'Hide the terms of sale' : 'Read the terms of sale'}
              </button>
              {showTerms && (
                <div data-testid="terms-text" className="space-y-1 text-[12px]" style={{ color: SUB }}>
                  <ul className="list-disc space-y-1 pl-4">{TERMS_OF_SALE.map((line) => <li key={line}>{line}</li>)}</ul>
                  <p>{PRIVACY_PARAGRAPH} {PRIVACY_POLICY_LINE.lead}{' '}<a href={PRIVACY_POLICY_LINE.path} target="_blank" rel="noopener noreferrer" className="underline">{PRIVACY_POLICY_LINE.linkText}</a>{' '}{PRIVACY_POLICY_LINE.tail}</p>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="shrink-0 px-[18px] pb-[14px] pt-3" style={{ borderTop: `1px solid ${LINE}` }}>
          <div className="mb-[10px] flex items-baseline justify-between" style={{ color: SUB }}>
            <span data-testid="picker-count">{countLabel(sum.count)}</span>
            <b data-testid="picker-total" className="text-[17px] tabular-nums" style={{ color: INK }}>{formatPence(payPence)}</b>
          </div>
          <label className="mb-[6px] flex min-h-[44px] items-center gap-3">
            <input type="checkbox" data-testid="picker-terms" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="h-[22px] w-[22px] shrink-0" style={{ accentColor: BRAND }} />
            <span className="text-[13px]" style={{ color: INK }}>{TERMS_CHECKBOX_LABEL}</span>
          </label>
          {blocked && <p data-testid="picker-blocked" className="mb-[6px] text-[13px]" style={{ color: SUB }}>{blocked}</p>}
          {BUYER_ONBOARDING_ENABLED && knownEmail && (
            <p data-testid="picker-not-you" className="mb-[6px] flex flex-wrap items-center gap-x-1 break-words text-[13px]" style={{ color: SUB }}>
              <span>Tickets go to {knownEmail}.</span>
              <button type="button" data-testid="picker-not-you-btn" onClick={() => void notYou()} disabled={notYouBusy} className="min-h-[44px] underline" style={{ color: BRAND, opacity: notYouBusy ? 0.5 : 1 }}>Not you?</button>
            </p>
          )}
          {BUYER_ONBOARDING_ENABLED && knownEmail && notYouErr && <p role="alert" data-testid="picker-not-you-error" className="mb-[6px] text-[13px]" style={{ color: BAD }}>{notYouErr}</p>}
          <button type="button" data-testid="picker-continue" onClick={onContinue} disabled={continueOff} className={btn} style={primary(continueOff)}>{heldNow ? PRICE_CONFIRM_LABEL : 'Continue'}</button>
          <Trust />
        </div>
      </div>

      {(stage === 'email' || stage === 'code') && (
        <div className="absolute inset-0 flex items-center justify-center p-[18px]" style={{ background: 'rgba(10,18,14,.55)' }}>
          <div role="dialog" aria-modal="true" aria-labelledby="picker-card-title" className="w-full max-w-[394px] rounded-2xl bg-white px-[18px] pb-4 pt-5" style={{ boxShadow: '0 10px 30px rgba(0,0,0,.3)' }}>
            {stage === 'email' ? (
              <form noValidate onSubmit={(e) => { e.preventDefault(); void sendCode(); }}>
                <h2 id="picker-card-title" className="mb-1 text-[17px] font-semibold" style={{ color: INK }}>Where should we send your tickets?</h2>
                <p className="mb-[14px] text-[14px]" style={{ color: SUB }}>We email you a code to confirm it is you.</p>
                <div className="mb-3 flex justify-between rounded-[10px] px-3 py-[10px] text-[14px]" style={{ background: '#f4f6f5' }}><span>{countLabel(sum.count)}</span><b className="tabular-nums">{formatPence(payPence)}</b></div>
                <input type="email" inputMode="email" autoComplete="email" aria-label="Email address" placeholder="you@example.com" value={email} autoFocus
                  onChange={(e) => { setEmail(e.target.value); setEmailBad(false); }}
                  className="h-[46px] w-full rounded-[10px] px-3 text-[16px]" style={{ border: `1px solid ${emailBad ? BAD : LINE}`, color: INK, background: '#fff' }} />
                {emailBad && <div role="alert" className="mt-[6px] text-[13px]" style={{ color: BAD }}>Enter a valid email, like you@example.com.</div>}
                {sendErr && <div role="alert" className="mt-[6px] text-[13px]" style={{ color: BAD }}>{sendErr}</div>}
                <button type="submit" disabled={busy} className={`${btn} mt-3`} style={primary(false)}>{busy ? <>Sending&hellip;</> : 'Continue'}</button>
                <Trust />
                <button type="button" onClick={() => setStage('pick')} className="mx-auto mt-2 block h-[44px] text-[14px]" style={{ color: SUB }}>Back to tickets</button>
              </form>
            ) : (
              <div>
                <h2 id="picker-card-title" className="mb-1 text-[17px] font-semibold" style={{ color: INK }}>Enter the 6-digit code</h2>
                <p className="mb-[14px] break-words text-[14px]" style={{ color: SUB }}>We sent it to {email.trim()}.</p>
                <CodeBoxes digits={digits} onDigits={(n) => { setDigits(n); setCodeErr(''); }} onComplete={(c) => void checkCode(c)} busy={busy} bad={Boolean(codeErr)} shake={shake} boxes={boxes} />
                <div role="alert" data-testid="code-error" className="mt-[6px] min-h-[34px] text-[13px]" style={{ color: BAD }}>{codeErr}</div>
                <div className="flex items-center justify-between text-[13px]" style={{ color: SUB }}>
                  {secs > 0 ? <span>Send a new code in {secs}s</span> : <button type="button" onClick={() => void sendCode()} className="h-[44px] underline" style={{ color: BRAND }}>Send a new code</button>}
                  <button type="button" onClick={() => { setSecs(0); setStage('email'); }} className="h-[44px] underline" style={{ color: BRAND }}>Change email</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {stage === 'open' && (
        <div role="status" data-testid="picker-opening" className="absolute inset-0 flex flex-col items-center justify-center gap-[10px] bg-white text-center">
          <div aria-hidden="true" className="h-[30px] w-[30px] animate-spin rounded-full" style={{ border: `3px solid ${LINE}`, borderTopColor: BRAND }} />
          <div className="text-[19px] font-semibold">Opening secure payment</div>
          <div className="flex items-center gap-[6px] text-[13px]" style={{ color: SUB }}><Lock aria-hidden="true" width={14} height={14} /><span>Secure payment by Stripe</span></div>
        </div>
      )}
    </div>,
    document.body,
  );
}

export default TicketPickerB1;
