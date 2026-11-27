import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BUYER_ONBOARDING_ENABLED } from '@/lib/buyerOnboardingFlag';
import { fetchPublicTicketTypes, postTicketCheckout, previewPromo, publicTicketKeys } from './ticketCheckoutApi';
import { PROMO_MAX_LENGTH, isCodeReason, normaliseCode, promoView, type PromoState } from './promo';
import { NO_PAID_LINES, REPRICE_DEBOUNCE_MS, discountedTotal, pickerPromoKey, previewBasketPromo, promoLines } from './pickerPromo';
import {
  CANCELLED_PARAM, MAX_PER_ORDER, PREVIEW_ORIGIN_REASON, THANKS_PATH, availability, checkoutOriginOk, earlySavingPence, formatPence, isEarlyOpen, maxQuantity, reasonCopy, typesForNight,
} from './ticketCheckoutModel';
import { flags } from '@/lib/featureFlags';

/** Early bird (flag ticketEarlyBird, needs ticketPriceSteps): the refusal when the early tickets ran out. */
export const EARLY_BIRD_RAN_OUT = 'Early bird tickets just ran out. Check the new price and tap Continue again.';
const EARLY = '#c2410c';
import { PRICE_CONFIRM_LABEL, parsePriceChanged, priceChangedText, stepReasonCopy } from './priceSteps';
import { PRIVACY_PARAGRAPH, PRIVACY_POLICY_LINE, TERMS_OF_SALE } from './legalCopy';
import { saveOrderId } from './orderStorage';
import { CodeBoxes } from './CodeBoxes';
import {
  CANCELLED_NOTE, CODE_LENGTH, ORDER_CAP_NOTE, RESEND_SECONDS, TRUST_LINE_BOLD, basketKey, basketTotals, buildPickerBody,
  basketSummaryLines, cleanBasket, countLabel, isFreeOnly, dateOnly, heldFrom, isEmail, loadBasket, perLine, roomFor, saveBasket, sendCodeError, verifyCodeError,
  type Basket, type PickerHeld,
} from './pickerModel';

/**
 * Ticket picker B1 (flag ticketPickerB1; docs/briefs/ticket-buyer-picker.md). A white checkout:
 * pick, Continue, email card, 6-digit code card, "Opening secure payment", Stripe.
 * Promo: an always-open box priced by the classic page's preview RPC, line by line (pickerPromo.ts).
 * Valid = a ticket-stub row (code, minus amount, Remove), old total struck beside the new one.
 */
export interface TicketPickerB1Props {
  seriesId: string;
  occurrenceId: string | null;
  title: string;
  dateLine: string | null;
  venueLine?: string | null;
  onClose: () => void;
  now?: Date;
  /** Early-bird rows, save line and early_bird_limit copy. Defaults to flags.ticketEarlyBird && flags.ticketPriceSteps; tests pass it. */
  earlyBird?: boolean;
}

// confirm = signed in (no email step): who the tickets go to, terms, Continue to Stripe.
type Stage = 'pick' | 'email' | 'code' | 'open';

const INK = '#17211c', SUB = '#5f6e66', LINE = '#e3e9e6', BRAND = '#14604a', BAD = '#b3261e';
/** Prototype motion (B1 v4): the stub unfolds, the total rolls; both off for reduced motion. */
const MOTION_CSS = '@keyframes pb1-unfold{from{opacity:0;transform:scaleY(.4)}to{opacity:1;transform:scaleY(1)}}'
  + '@keyframes pb1-roll{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}'
  + '.pb1-unfold{transform-origin:top;animation:pb1-unfold .38s cubic-bezier(.2,.8,.2,1)}.pb1-roll{display:inline-block;animation:pb1-roll .45s cubic-bezier(.2,.8,.2,1)}'
  + '@media (prefers-reduced-motion:reduce){.pb1-unfold,.pb1-roll{animation:none}}';
const buzz = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* no vibration here */ } };

function Trust({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`${compact ? '' : 'mt-[10px] '}flex items-center justify-center gap-2 text-[12px]`} style={{ color: SUB }}>
      <Lock aria-hidden="true" width={14} height={14} />
      <span>{TRUST_LINE_BOLD}</span>
    </div>
  );
}

const NOT_YOU_FAILED = 'We could not sign you out. Try again.';

export function TicketPickerB1({ seriesId, occurrenceId, title, dateLine, venueLine, onClose, now: nowProp, earlyBird = flags.ticketEarlyBird && flags.ticketPriceSteps }: TicketPickerB1Props) {
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
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState<PromoState>({ status: 'idle' });
  // The stub row stays up while an applied code is re-priced for a new basket.
  const [stubbed, setStubbed] = useState(false);
  // Bumped when a code is applied or removed by the buyer: the bar total rolls to its new price.
  const [roll, setRoll] = useState(0);
  const promoSeq = useRef(0);
  const [refusal, setRefusal] = useState('');
  const [held, setHeld] = useState<PickerHeld | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const knownEmail = user?.email ?? verifiedEmail;
  const [notYouBusy, setNotYouBusy] = useState(false);
  const [notYouErr, setNotYouErr] = useState('');
  // The error belongs to one signed-in address: a different (or no) address means it is stale.
  useEffect(() => { setNotYouErr(''); }, [knownEmail]);
  const [showTerms, setShowTerms] = useState(false);
  const [cancelled] = useState(() => new URLSearchParams(location.search).get(CANCELLED_PARAM) === 'cancelled');
  const inFlight = useRef(false);
  const boxes = useRef<Array<HTMLInputElement | null>>([]);

  const clean = useMemo(() => cleanBasket(basket, types, now), [basket, types, now]);
  const sum = basketTotals(clean, types);
  // A price_changed holds only for the basket it was priced for.
  const heldNow = held && held.key === basketKey(clean) ? held : null;
  const key = pickerPromoKey(clean, occurrenceId, types);
  const lines = promoLines(clean, types);
  // The one shared promo mapping (promo.ts): what checkout sends, and what holds Continue back.
  const pv = promoView(promo, promoInput, key);
  const promoTotal = pv.appliedDiscountPence !== null ? discountedTotal(sum, pv.appliedDiscountPence) : null;
  const payPence = heldNow ? heldNow.totalPence : promoTotal ?? sum.totalPence;
  const priceNote = heldNow ? priceChangedText(heldNow.totalPence) : '';
  const freeOnly = isFreeOnly(clean, types);
  // the label also reads free on an all-free event at 0 tickets (the greyed button)
  const freeTotal = freeOnly || (sum.count === 0 && types.length > 0 && types.every((t) => t.pricePence <= 0));
  const summaryLines = basketSummaryLines(clean, types);
  // The early saving only (a promo does not change it).
  const earlySave = earlyBird ? earlySavingPence(types.map((t) => ({ type: t, quantity: clean[t.id] ?? 0 }))) : 0;
  const atCap = sum.count >= MAX_PER_ORDER;
  // Before any field: a preview can never complete checkout (same guard as the classic page).
  // The terms box lives in the email card and gates its pay button, not the bar's Continue.
  const blocked = sum.count === 0 ? null : !checkoutOriginOk(window.location.origin) ? PREVIEW_ORIGIN_REASON : pv.buyBlocked ?? null;
  const continueOff = sum.count === 0 || blocked !== null;
  const appliedCode = stubbed && promo.status === 'applied' ? promo.code : null;
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

  // An applied code is priced for one basket: a change of tickets or counts re-prices it (no buzz).
  // pricedKey = the basket the latest preview was asked for, so a change mid-check re-prices too.
  const pricedKey = useRef<string | null>(null);
  const lastApplied = useRef<typeof promo | null>(null);
  const liveCode = stubbed && (promo.status === 'applied' || promo.status === 'checking') ? promo.code : null;
  useEffect(() => {
    if (!liveCode || sum.count === 0) return;
    if (pricedKey.current === key) {
      // + then - inside the debounce: back on the priced basket, so restore its answer (step() set Checking).
      const last = lastApplied.current;
      if (promo.status === 'checking' && last && 'key' in last && last.key === key) { setPromo(last); return; }
      // Left and came back while this basket's own reply was dropped (seq bumped): nothing is pending, so re-price.
      if (promo.status !== 'checking') return;
      pricedKey.current = null;
    }
    // One preview per pause, so fast stepper taps cannot trip the limiter (step() already shows Checking).
    promoSeq.current += 1;
    const id = setTimeout(() => {
      // Only free tickets picked: nothing for the code to take off.
      if (lines.length === 0) { pricedKey.current = key; setPromo({ status: 'refused', code: liveCode, key, reason: NO_PAID_LINES }); setStubbed(false); return; }
      void pricePromo(liveCode, false);
    }, lines.length === 0 ? 0 : REPRICE_DEBOUNCE_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-price on a basket (or code) change only
  }, [key, liveCode]);

  // The answer sits low on a phone: after a tap, bring it above the bottom bar once it has rendered.
  const scrollToAnswer = useRef(false);
  useEffect(() => {
    if (!scrollToAnswer.current || promo.status === 'checking') return;
    scrollToAnswer.current = false;
    document.getElementById('picker-promo-box')?.scrollIntoView?.({ block: 'nearest' });
  }, [promo]);

  async function pricePromo(code: string, tapped: boolean) {
    const seq = ++promoSeq.current;
    const forKey = key;
    pricedKey.current = key;
    setPromo({ status: 'checking', code });
    const r = await previewBasketPromo(lines, code, (typeId, quantity, c) => previewPromo(seriesId, typeId, quantity, c, occurrenceId));
    if (seq !== promoSeq.current) return;
    scrollToAnswer.current = tapped;
    if (r.ok) {
      const applied = { status: 'applied' as const, code, key: forKey, discountPence: r.discountPence, totalPence: r.totalPence };
      lastApplied.current = applied;
      setPromo(applied);
      setStubbed(true);
      if (tapped) { buzz(30); setRoll((n) => n + 1); }
      return;
    }
    setPromo({ status: 'refused', code, key: forKey, reason: r.reason });
    setStubbed(false);
    if (tapped) buzz([40, 60, 40]);
  }

  async function applyPromo() {
    const code = normaliseCode(promoInput);
    if (!code) { setPromo({ status: 'refused', code: '', key: null, reason: 'empty' }); buzz([40, 60, 40]); return; }
    if (promo.status === 'checking') return;
    setHeld(null); // a held price_changed was priced without (or with) the old code
    // The keyboard closes on Apply; the stub row (or the red line) is what the buyer reads next.
    (document.activeElement as HTMLElement | null)?.blur?.();
    await pricePromo(code, true);
  }

  function removePromo() {
    promoSeq.current += 1; pricedKey.current = null; lastApplied.current = null; setHeld(null);
    if (stubbed) setRoll((n) => n + 1);
    setPromoInput(''); setPromo({ status: 'idle' }); setStubbed(false);
  }

  const step = (id: string, d: number) => {
    const t = types.find((x) => x.id === id);
    if (!t) return;
    setRefusal(''); setHeld(null); // any basket change spends a held price_changed
    if (liveCode) setPromo({ status: 'checking', code: liveCode }); // re-priced by the effect below; Continue waits
    const n = clean[id] ?? 0;
    setBasket({ ...clean, [id]: Math.max(0, d > 0 ? n + Math.min(d, roomFor(t, clean, now)) : n + d) });
  };

  async function startPayment(buyerEmail: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setStage('open');
    const sendCode = pv.sendCode;
    const body = buildPickerBody({
      basket: clean, types, email: buyerEmail, occurrenceId, origin: window.location.origin, pathname: location.pathname, search: location.search, held: heldNow,
      promo: sendCode ? { code: sendCode, totalPence: payPence } : null,
    });
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
    // A code refusal at checkout (HTTP 409) belongs to the promo box, as on the classic page.
    if (sendCode && isCodeReason(r.reason)) {
      scrollToAnswer.current = true;
      setPromo({ status: 'refused', code: sendCode, key, reason: r.reason }); setStubbed(false);
      buzz([40, 60, 40]);
      return;
    }
    // Early tickets ran out: re-read the types (the basket cleans down to the new max by itself).
    if (earlyBird && r.reason === 'early_bird_limit') { setRefusal(EARLY_BIRD_RAN_OUT); reread(); return; }
    const copy = stepReasonCopy(r.reason, null) ?? reasonCopy(r.reason, r.message);
    // The picker has no night list: a night refusal points at the Back control that IS on screen.
    setRefusal(copy.way === 'pick_night' ? 'Tickets for this night cannot be booked now. Go Back to pick another night.' : copy.text);
    // A refusal about stock or status means the list on screen is stale: re-read it.
    if (copy.way === 'pick_another' || copy.way === 'pick_night') reread();
  }

  function onContinue() {
    if (continueOff) return;
    setNotYouErr('');
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

  const date = dateOnly(dateLine);
  const outline = { border: `1px solid ${LINE}`, color: INK, background: '#fff' } as const;
  const btn = 'h-[46px] w-full rounded-[10px] text-[14px] font-semibold disabled:opacity-100';
  const primary = (off: boolean) => ({ background: off ? '#f4f6f5' : BRAND, color: off ? '#9aa8a1' : '#fff' });
  // Signed out elsewhere while the confirm card is up: there is no address to show, so ask for one.
  const card = stage;
  const stubUp = stubbed && (promo.status === 'applied' || promo.status === 'checking');
  // The 92px stub column fits a 5-character amount (25.80) at 18px; a longer one steps down so it never overflows.
  const saveSize = promo.status === 'applied' && formatPence(promo.discountPence).length > 6 ? 'text-[15px]' : 'text-[18px]';

  // One "Terms of sale" link under the button that may lead to Stripe; it opens the terms inline. No tick box: continuing is the acceptance.
  const termsLink = (
    <button type="button" data-testid="picker-terms-link" aria-expanded={showTerms} onClick={() => setShowTerms((v) => !v)} className={`${knownEmail ? 'min-h-[36px]' : 'mt-1 min-h-[40px]'} text-[13px] underline`} style={{ color: SUB }}>
      Terms of sale
    </button>
  );
  const termsText = showTerms ? (
    <div data-testid="terms-text" className="space-y-1 text-left text-[12px]" style={{ color: SUB }}>
      <ul className="list-disc space-y-1 pl-4">{TERMS_OF_SALE.map((line) => <li key={line}>{line}</li>)}</ul>
      <p>{PRIVACY_PARAGRAPH} {PRIVACY_POLICY_LINE.lead}{' '}<a href={PRIVACY_POLICY_LINE.path} target="_blank" rel="noopener noreferrer" className="underline">{PRIVACY_POLICY_LINE.linkText}</a>{' '}{PRIVACY_POLICY_LINE.tail}</p>
    </div>
  ) : null;
  const termsBlock = <div className="text-center">{termsLink}{termsText}</div>;
  const cardSummary = (
    <div data-testid="picker-card-summary" className="mb-3 flex justify-between gap-3 rounded-[10px] px-3 py-[10px] text-[13px]" style={{ background: '#f4f6f5', color: INK }}>
      <span className="min-w-0 break-all">{countLabel(sum.count)}{appliedCode && <> &middot; {appliedCode}</>}</span>
      <b className="shrink-0 tabular-nums">{formatPence(payPence)}</b>
    </div>
  );
  const backToTickets = <button type="button" onClick={() => setStage('pick')} className="mx-auto mt-2 block min-h-[40px] text-[13px]" style={{ color: SUB }}>Back to tickets</button>;

  return createPortal(
    // z-[65]: above the site header (GlobalHeader / FocusHeader are fixed z-[60]), below search (70) and toasts (100).
    <div role="dialog" aria-modal="true" aria-label="Tickets" data-testid="ticket-picker-b1" className="fixed inset-0 z-[65] flex flex-col" style={{ background: '#fff', color: INK }}>
      <style>{MOTION_CSS}</style>
      <div className="mx-auto flex min-h-0 w-full max-w-[430px] flex-1 flex-col">
        <nav className="flex shrink-0 items-center justify-between px-[18px] pb-[6px] pt-[14px] text-[13px]" style={{ color: SUB }}>
          <button type="button" onClick={() => window.history.back()} data-testid="tickets-back" className="-my-[10px] min-h-[40px] pr-3" style={{ color: SUB }}>&lsaquo; Back</button>
          <span data-testid="picker-step">Step 1 of 2</span>
        </nav>
        <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-6 pt-[6px]">
          <header className="pb-[14px] pt-1">
            <h1 className="break-words text-[17px] font-semibold leading-tight" style={{ color: INK }}>{title}</h1>
            {date && <p className="mt-[2px] text-[13px]" style={{ color: SUB }}>{date}</p>}
            {venueLine && <p data-testid="tickets-venue" className="mt-[2px] break-words text-[13px]" style={{ color: SUB }}>{venueLine}</p>}
          </header>
          {cancelled && <p role="status" data-testid="picker-cancelled" className="mb-[10px] rounded-[10px] px-3 py-[10px] text-[13px]" style={{ background: '#f4f6f5' }}>{CANCELLED_NOTE}</p>}
          {(refusal || priceNote) && <p role="alert" data-testid="picker-refusal" className="mb-[10px] rounded-[10px] px-3 py-[10px] text-[13px]" style={{ background: '#f4f6f5', color: BAD }}>{priceNote || refusal}</p>}
          {data && types.length === 0 && <p className="text-[13px]" style={{ color: SUB }}>No tickets are on sale for this night. Check the event page for other ways in.</p>}
          {types.map((t, ix) => {
            const max = maxQuantity(t, now);
            const n = clean[t.id] ?? 0;
            const room = roomFor(t, clean, now);
            const a = availability(t, now);
            const per = perLine(t);
            const earlyOpen = earlyBird && isEarlyOpen(t);
            const earlySold = earlyBird && t.earlyState === 'sold_out';
            return (
              <div key={t.id} data-testid="picker-row" className="flex items-start justify-between gap-3 py-[14px]" style={{ borderTop: `1px solid ${LINE}`, ...(ix === types.length - 1 ? { borderBottom: `1px solid ${LINE}` } : {}) }}>
                <div className="min-w-0">
                  <div className="break-words text-[14px] font-semibold">{t.name}</div>
                  {earlyOpen && <div data-testid="picker-early-line" className="mt-[2px] text-[11px] font-bold" style={{ color: EARLY }}>Early bird price</div>}
                  {earlySold && <div data-testid="picker-early-soldout" className="mt-[2px] text-[12px]" style={{ color: SUB }}>Early bird sold out</div>}
                  {max === 0 && <div className="mt-[2px] text-[12px]" style={{ color: SUB }}>{a.label}</div>}
                  {per && <div className="mt-1 text-[12px]" style={{ color: BRAND }}>{per}</div>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {earlyOpen && <s data-testid="picker-regular-price" className="-mb-[6px] text-[12px] tabular-nums" style={{ color: SUB }}>{formatPence(t.regularPricePence ?? 0)}</s>}
                  <div data-testid={t.pricePence <= 0 ? 'picker-free-price' : undefined} className="text-[16px] font-semibold leading-[1.2] tabular-nums" style={earlyOpen ? { color: EARLY } : undefined}>{formatPence(t.pricePence)}</div>
                  {max > 0 && (
                    // 36x36 is the prototype value, accepted by the owner over the 44px tap rule (2026-11-18).
                    <div className="flex items-center gap-[2px]">
                      <button type="button" aria-label={`Remove one ${t.name}`} disabled={n === 0} onClick={() => step(t.id, -1)} className="h-[36px] w-[36px] rounded-full text-[18px] font-medium leading-none disabled:text-[#c3cdc8]" style={outline}>&minus;</button>
                      <output aria-label={`${t.name} count`} className="w-[26px] text-center text-[14px] font-semibold tabular-nums">{n}</output>
                      <button type="button" aria-label={`Add one ${t.name}`} disabled={room === 0} onClick={() => step(t.id, 1)} className="h-[36px] w-[36px] rounded-full text-[18px] font-medium leading-none disabled:text-[#c3cdc8]" style={{ ...outline, borderColor: BRAND, color: BRAND }}>+</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {atCap && <p role="status" data-testid="picker-cap" className="mt-[10px] text-[12px]" style={{ color: SUB }}>{ORDER_CAP_NOTE}</p>}
          {types.length > 0 && (
            <div className="mt-4" id="picker-promo-box">
              {stubUp ? (
                // The applied code as a ticket stub: notched at the tear, dashed tear line, amount + Remove on the right.
                <div data-testid="picker-promo-stub" className="pb1-unfold relative mt-[2px] flex items-stretch rounded-[12px]" style={{ background: '#e8f3ee', color: BRAND }}>
                  <span aria-hidden="true" className="absolute -top-[7px] h-[14px] w-[14px] rounded-full bg-white" style={{ left: 'calc(100% - 99px)' }} />
                  <span aria-hidden="true" className="absolute -bottom-[7px] h-[14px] w-[14px] rounded-full bg-white" style={{ left: 'calc(100% - 99px)' }} />
                  <div className="flex min-w-0 flex-1 items-center px-[14px] py-3">
                    <b className="block break-all text-[15px] font-bold tracking-[.08em]">{promo.code}</b>
                  </div>
                  <div className="flex w-[92px] flex-none flex-col items-center justify-center gap-[2px] p-2" style={{ borderLeft: '2px dashed #b7d6c9' }}>
                    {promo.status === 'checking'
                      ? <span role="status" className="text-[12px]" style={{ color: SUB }}>Checking&hellip;</span>
                      : <b data-testid="picker-promo-saving" className={`${saveSize} whitespace-nowrap font-bold tabular-nums`}>&minus;{formatPence(promo.discountPence)}</b>}
                    <button type="button" data-testid="picker-promo-remove" aria-label={`Remove code ${promo.code}`} onClick={removePromo} className="min-h-[32px] px-[6px] text-[12px] underline" style={{ color: SUB }}>Remove</button>
                  </div>
                </div>
              ) : (
                <>
                  <label htmlFor="picker-promo" className="mb-[6px] block text-[12px] font-semibold">Promo code</label>
                  <div className="flex gap-2">
                    <input id="picker-promo" value={promoInput} maxLength={PROMO_MAX_LENGTH} readOnly={promo.status === 'checking'}
                      onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); if (promo.status === 'refused') setPromo({ status: 'idle' }); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void applyPromo(); } }}
                      autoComplete="off" autoCapitalize="characters" placeholder="Enter code" enterKeyHint="done"
                      aria-invalid={pv.tone === 'bad' || promo.status === 'refused'} aria-describedby="picker-promo-msg"
                      className="h-[44px] min-w-0 flex-1 rounded-[10px] px-3 text-[16px]" style={{ border: `1px solid ${promo.status === 'refused' ? BAD : LINE}`, background: '#fff', color: INK }} />
                    <button type="button" onClick={() => void applyPromo()} disabled={promo.status === 'checking'} className="h-[44px] rounded-[10px] px-4 text-[13px] font-semibold" style={{ border: `1px solid ${BRAND}`, color: BRAND, background: '#fff', opacity: promo.status === 'checking' ? 0.7 : 1 }}>{promo.status === 'checking' ? <>Checking&hellip;</> : 'Apply'}</button>
                  </div>
                </>
              )}
              <div role="status" id="picker-promo-msg" data-testid="picker-promo-msg" className="mt-[6px] min-h-[16px] text-[12px]" style={{ color: BAD }}>
                {promo.status === 'refused' ? pv.note ?? '' : ''}
              </div>
              {/* A typed code that is not applied holds Continue back ("Remove the promo code..."): the control is here. */}
              {!stubbed && normaliseCode(promoInput) !== '' && promo.status !== 'checking' && (
                <button type="button" data-testid="picker-promo-clear" onClick={removePromo} className="min-h-[40px] text-[12px] underline" style={{ color: SUB }}>Remove the code</button>
              )}
            </div>
          )}
        </div>
        <div className={`shrink-0 px-[18px] ${knownEmail ? 'pb-[8px] pt-2' : 'pb-[14px] pt-3'}`} style={{ borderTop: `1px solid ${LINE}` }}>
          {summaryLines.length > 1 && (
            <ul data-testid="picker-summary" className="mb-[6px] space-y-[2px] text-[12px]" style={{ color: SUB }}>
              {summaryLines.map((l) => <li key={l.id} className="flex justify-between gap-2"><span className="min-w-0 break-words">{l.quantity} &times; {l.name}</span><span className="tabular-nums">{l.priceLabel}</span></li>)}
            </ul>
          )}
          <div className={`${knownEmail ? 'mb-[4px]' : 'mb-[10px]'} flex items-baseline justify-between text-[13px]`} style={{ color: SUB }}>
            <span data-testid="picker-count">{countLabel(sum.count)}</span>
            <span key={roll} className={roll > 0 ? 'pb1-roll' : undefined}>
              {promoTotal !== null && !heldNow && <s data-testid="picker-total-was" className="mr-2 text-[13px] tabular-nums" style={{ color: SUB }}>{formatPence(sum.totalPence)}</s>}
              <b data-testid="picker-total" className="text-[16px] font-semibold tabular-nums" style={{ color: INK }}>{formatPence(payPence)}</b>
            </span>
          </div>
          {earlySave > 0 && <p data-testid="picker-early-save" className="mb-[6px] text-right text-[12px]" style={{ color: EARLY }}>You save &pound;{(earlySave / 100).toFixed(2)}</p>}
          {blocked && <p data-testid="picker-blocked" className="mb-[6px] text-[12px]" style={{ color: SUB }}>{blocked}</p>}
          {knownEmail && (
            <p data-testid={BUYER_ONBOARDING_ENABLED ? 'picker-not-you' : 'picker-sends-to'} className="mb-[4px] flex flex-wrap items-center gap-x-1 break-words text-[13px]" style={{ color: SUB }}>
              <span>Tickets go to {knownEmail}.</span>
              {BUYER_ONBOARDING_ENABLED && <button type="button" data-testid="picker-not-you-btn" onClick={() => void notYou()} disabled={notYouBusy} className="min-h-[40px] underline" style={{ color: BRAND, opacity: notYouBusy ? 0.5 : 1 }}>Not you?</button>}
            </p>
          )}
          {BUYER_ONBOARDING_ENABLED && notYouErr && <p role="alert" data-testid="picker-not-you-error" className="mb-2 text-[12px]" style={{ color: BAD }}>{notYouErr}</p>}
          <button type="button" data-testid="picker-continue" onClick={onContinue} disabled={continueOff} className={btn} style={primary(continueOff)}>{heldNow ? PRICE_CONFIRM_LABEL : freeTotal ? (knownEmail ? 'Get my free tickets' : 'Continue') : knownEmail ? 'Continue to Stripe' : 'Continue'}</button>
          {knownEmail ? (
            <>
              {/* Signed in: the terms link and the trust line share one row so the bar stays short and the promo box is never covered. */}
              <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4">{termsLink}{!freeOnly && <Trust compact />}</div>
              {termsText}
            </>
          ) : !freeOnly ? <Trust /> : null}
        </div>
      </div>

      {(card === 'email' || card === 'code') && (
        <div className="absolute inset-0 flex items-center justify-center p-[18px]" style={{ background: 'rgba(10,18,14,.55)' }}>
          <div role="dialog" aria-modal="true" aria-labelledby="picker-card-title" className="max-h-full w-full max-w-[394px] overflow-y-auto rounded-2xl bg-white px-[18px] pb-4 pt-5 text-[13px]" style={{ boxShadow: '0 10px 30px rgba(0,0,0,.3)' }}>
            {card === 'email' ? (
              <form noValidate onSubmit={(e) => { e.preventDefault(); void sendCode(); }}>
                <h2 id="picker-card-title" className="mb-1 text-[17px] font-semibold" style={{ color: INK }}>Your email</h2>
                {cardSummary}
                <input type="email" inputMode="email" autoComplete="email" aria-label="Email address" placeholder="you@example.com" value={email} autoFocus
                  onChange={(e) => { setEmail(e.target.value); setEmailBad(false); }}
                  className="h-[46px] w-full rounded-[10px] px-3 text-[16px]" style={{ border: `1px solid ${emailBad ? BAD : LINE}`, color: INK, background: '#fff' }} />
                {emailBad && <div role="alert" className="mt-[6px] text-[12px]" style={{ color: BAD }}>Enter a valid email, like you@example.com.</div>}
                {sendErr && <div role="alert" className="mt-[6px] text-[12px]" style={{ color: BAD }}>{sendErr}</div>}
                {termsBlock}
                <button type="submit" disabled={busy} className={`${btn} mt-3`} style={primary(false)}>{busy ? <>Sending&hellip;</> : 'Continue'}</button>
                {!freeOnly && <Trust />}
                {backToTickets}
              </form>
            ) : (
              <div>
                <h2 id="picker-card-title" className="mb-1 text-[17px] font-semibold" style={{ color: INK }}>Enter the 6-digit code</h2>
                <p className="mb-[14px] break-words" style={{ color: SUB }}>We sent it to {email.trim()}.</p>
                <CodeBoxes digits={digits} onDigits={(n) => { setDigits(n); setCodeErr(''); }} onComplete={(c) => void checkCode(c)} busy={busy} bad={Boolean(codeErr)} shake={shake} boxes={boxes} />
                <div role="alert" data-testid="code-error" className="mt-[6px] min-h-[34px] text-[12px]" style={{ color: BAD }}>{codeErr}</div>
                <div className="flex items-center justify-between text-[12px]" style={{ color: SUB }}>
                  {secs > 0 ? <span>Send a new code in {secs}s</span> : <button type="button" onClick={() => void sendCode()} className="min-h-[40px] underline" style={{ color: BRAND }}>Send a new code</button>}
                  <button type="button" onClick={() => { setSecs(0); setStage('email'); }} className="min-h-[40px] underline" style={{ color: BRAND }}>Change email</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {stage === 'open' && (
        <div role="status" data-testid="picker-opening" className="absolute inset-0 flex flex-col items-center justify-center gap-[10px] bg-white text-center">
          <div aria-hidden="true" className="h-[30px] w-[30px] animate-spin rounded-full" style={{ border: `3px solid ${LINE}`, borderTopColor: BRAND }} />
          <div className="text-[18px] font-semibold">{freeOnly ? 'Getting your tickets' : 'Opening secure payment'}</div>
          {!freeOnly && <div className="flex items-center gap-[6px] text-[12px]" style={{ color: SUB }}><Lock aria-hidden="true" width={14} height={14} /><span>Secure payment by Stripe</span></div>}
        </div>
      )}
    </div>,
    document.body,
  );
}

export default TicketPickerB1;
