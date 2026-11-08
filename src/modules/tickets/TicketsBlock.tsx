import { quietBar, barSummary } from './ticketBars';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPublicTicketTypes, postTicketCheckout, previewPromo, publicTicketKeys, sellsInSite } from './ticketCheckoutApi';
import { PROMO_MAX_LENGTH, codeFromSearch, isCodeReason, normaliseCode, promoKey, promoNoteText, promoView, type PromoState } from './promo';
import {
  BOOKING_FEE_LABEL,
  CANCELLED_PARAM,
  THANKS_PATH,
  WAY_LABEL,
  availability,
  buildCheckoutBody,
  buyLabel,
  cancelReturnPath,
  clampQuantity,
  disabledReason,
  formatPence,
  maxQuantity,
  reasonCopy,
  totals,
  typesForNight,
  type PublicTicketType,
} from './ticketCheckoutModel';
import { SYMBOL_GRADIENT, ticketSymbol } from './ticketSymbol';
import { useAuth } from '@/hooks/useAuth';
import { buildSignInHref } from '@/lib/authRouting';
import { TICKET_WHERE } from './myTicketsModel';
import { clearOrderId, saveOrderId } from './orderStorage';
import { PRIVACY_PARAGRAPH, PRIVACY_POLICY_LINE, TERMS_CHECKBOX_LABEL, TERMS_OF_SALE } from './legalCopy';

/**
 * The Tickets block on /event/:id (S4, docs/ticketing-buyer-journey.md). Mounted by
 * BentoPage only while flags.publicTicketing is on and the night is still bookable;
 * renders nothing until the series has a type on sale or sold out.
 */
export interface TicketsBlockProps {
  /** The page's PUBLIC event id. ticket_types_public_v1 is keyed on event_series_p5.id, so
   *  where the two differ it answers no rows and the block stays hidden until the DB side
   *  accepts the public id (docs/ticketing-buyer-journey.md, "DB note"). */
  seriesId: string;
  /** The night on screen; per-occurrence types show only on their own night. */
  occurrenceId: string | null;
  organiserId: string | null;
  /** Injected for tests; defaults to the real clock / window origin. */
  now?: Date;
  origin?: string;
}

const card = {
  background: 'hsl(var(--bento-surface-raised))',
  color: 'hsl(var(--bento-fg))',
  border: '1px solid var(--bento-hairline)',
} as const;
const muted = { color: 'hsl(var(--bento-fg-muted))' } as const;
const accentBg = { background: '#FF9900', color: '#1A1208' } as const;

export function TicketsBlock({ seriesId, occurrenceId, organiserId, now: nowProp, origin: originProp }: TicketsBlockProps) {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, authStatus } = useAuth();
  const guest = !user && authStatus !== 'resolving';
  const { data: types } = useQuery({
    queryKey: publicTicketKeys.types(seriesId),
    queryFn: () => fetchPublicTicketTypes(seriesId),
    staleTime: 30_000,
  });
  const now = nowProp ?? new Date();
  const origin = originProp ?? (typeof window !== 'undefined' ? window.location.origin : '');
  // Read ?tickets=cancelled once, then drop it from the URL so a reload or a later
  // cancel_url never carries a stale cancel forward.
  const [cancelled] = useState(() => new URLSearchParams(location.search).get(CANCELLED_PARAM) === 'cancelled');

  const [typeId, setTypeId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Holds a second tap or Return even before React re-renders Buy as disabled.
  const inFlight = useRef(false);
  const [error, setError] = useState<{ reason: string; message: string | null } | null>(null);
  // Promo code: a `?code=` link pre-fills the field; it is only ever applied by a tap.
  const [promoInput, setPromoInput] = useState(() => codeFromSearch(location.search));
  const [promo, setPromo] = useState<PromoState>({ status: 'idle' });
  // Only the latest preview may land: a double tap or a fast quantity change drops the older reply.
  const promoSeq = useRef(0);

  const list = typesForNight(types ?? [], occurrenceId);
  const quiet = quietBar(list, now);
  const buyable = list.filter((t) => maxQuantity(t, now) > 0);
  // One buyable type is picked for the buyer; otherwise they choose.
  // A pick that has since sold out or closed (the list re-reads after a refusal) is no pick.
  const picked = buyable.find((t) => t.id === typeId) ?? null;
  const selected: PublicTicketType | null = picked ?? (buyable.length === 1 ? buyable[0] : null);
  const max = selected ? maxQuantity(selected, now) : 0;
  // The stepper only ever moves from qty, so the stored count never needs syncing.
  const qty = clampQuantity(quantity, max);
  const key = selected ? promoKey(selected.id, qty) : null;
  // A free ticket has nothing to take off: no field, and a pre-filled code never holds Buy back.
  const promoOn = selected !== null && selected.pricePence > 0;
  const pv = promoView(promoOn ? promo : { status: 'idle' }, promoOn ? promoInput : '', key);

  async function applyPromo(raw: string) {
    const code = normaliseCode(raw);
    if (!code) {
      setPromo({ status: 'refused', code: '', key: null, reason: 'empty' });
      return;
    }
    if (!selected || promo.status === 'checking') return;
    await pricePromo(code, selected.id, qty);
  }

  async function pricePromo(code: string, typeIdFor: string, quantityFor: number) {
    const seq = ++promoSeq.current;
    const forKey = promoKey(typeIdFor, quantityFor);
    setPromo({ status: 'checking', code });
    const r = await previewPromo(seriesId, typeIdFor, quantityFor, code);
    if (seq !== promoSeq.current) return;
    setPromo(r.ok ? { status: 'applied', code, key: forKey, discountPence: r.discountPence, totalPence: r.totalPence } : { status: 'refused', code, key: forKey, reason: r.reason });
  }

  /**
   * A new ticket or count re-prices the code in play straight away: applied, still being
   * checked (the newer price wins, the older reply is dropped) or refused for the old choice.
   */
  function choose(nextTypeId: string, nextQty: number) {
    const live = promo.status !== 'idle' && promo.code !== '' && promo.code === normaliseCode(promoInput) ? promo.code : null;
    if (live && promoKey(nextTypeId, nextQty) !== key) void pricePromo(live, nextTypeId, nextQty);
  }

  function removePromo() {
    promoSeq.current += 1;
    setPromoInput('');
    setPromo({ status: 'idle' });
  }

  // Back from Stripe can restore this page from the bfcache with submitting still true.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        inFlight.current = false;
        setSubmitting(false);
      }
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (!q.has(CANCELLED_PARAM)) return;
    // That checkout was not paid: never show its reference on a later thank-you page.
    clearOrderId();
    q.delete(CANCELLED_PARAM);
    const rest = q.toString();
    navigate(`${location.pathname}${rest ? `?${rest}` : ''}`, { replace: true });
  }, [location.pathname, location.search, navigate]);

  if (list.length === 0) return null;

  const err = error ? reasonCopy(error.reason, error.message) : null;

  // An organiser-side refusal cannot be fixed by trying again: Buy stays off with the reason.
  const reason =
    err?.way === 'contact_organiser'
      ? 'Online tickets are not available for this event right now.'
      : (disabledReason({ type: selected, quantity: qty, email, termsAccepted, origin, submitting }, now) ?? pv.buyBlocked);
  const sum = selected ? totals(selected, qty) : null;
  // The preview prices tickets only; any booking fee is added on top, as checkout does.
  const payPence = sum ? (pv.appliedTotalPence !== null ? pv.appliedTotalPence + sum.feePence : sum.totalPence) : 0;

  async function onBuy() {
    if (!selected || reason || inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    const result = await postTicketCheckout(
      buildCheckoutBody({ typeId: selected.id, quantity: qty, email, name, promoCode: pv.sendCode }, origin, cancelReturnPath(location.pathname, location.search)),
    );
    if (result.kind === 'redirect') {
      saveOrderId(result.orderId);
      window.location.assign(result.url);
      return;
    }
    inFlight.current = false;
    setSubmitting(false);
    if (result.kind === 'free') {
      saveOrderId(result.orderId);
      navigate(`${THANKS_PATH}?o=${encodeURIComponent(result.orderId)}&free=1`);
      return;
    }
    // A code refusal at checkout (HTTP 409) belongs to the code field, with its own way forward.
    if (pv.sendCode && isCodeReason(result.reason)) {
      setPromo({ status: 'refused', code: pv.sendCode, key, reason: result.reason });
      return;
    }
    setError({ reason: result.reason, message: result.message });
    // A refusal about stock or status means the list on screen is stale: re-read it.
    if (reasonCopy(result.reason).way === 'pick_another') {
      void queryClient.invalidateQueries({ queryKey: publicTicketKeys.types(seriesId) });
    }
  }

  function onWayForward() {
    if (!err) return;
    if (err.way === 'pick_another') setTypeId(null);
    if (err.way === 'retry' || err.way === 'pick_another' || err.way === 'fix_form') setError(null);
  }

  return (
    <section aria-labelledby="tickets-heading" className="mb-3 rounded-md p-3 text-[14px]" style={card} id="tickets" data-testid="tickets-block" data-sells-in-site={sellsInSite(list, now) ? 'true' : 'false'}>
      <h2 id="tickets-heading" className="mb-2 text-[15px] font-semibold" style={{ color: 'hsl(var(--bento-accent))' }}>
        Tickets
      </h2>

      {cancelled && !error && (
        <p className="mb-2 rounded-md px-3 py-2 text-[13px]" style={{ background: 'hsl(var(--bento-surface))' }} role="status">
          Checkout cancelled. You have not been charged. You can try again below.
        </p>
      )}

      <ul className="space-y-2" aria-label="Ticket types">
        {list.map((t) => {
          const a = availability(t, now);
          const pickable = a.kind === 'buyable';
          const isSel = selected?.id === t.id;
          return (
            <li key={t.id}>
              <button
                type="button"
                disabled={!pickable}
                aria-pressed={isSel}
                onClick={() => {
                  setTypeId(t.id);
                  setError(null);
                  choose(t.id, clampQuantity(quantity, maxQuantity(t, now)));
                }}
                className="flex min-h-[72px] w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left disabled:opacity-60"
                style={{
                  background: 'hsl(var(--bento-surface))',
                  border: isSel ? '2px solid hsl(var(--bento-accent))' : '1px solid var(--bento-hairline)',
                }}
              >
                <span
                  aria-hidden="true"
                  data-symbol={ticketSymbol(t.name, t.pricePence)}
                  className="h-[64px] w-[64px] shrink-0 rounded-md"
                  style={{ background: SYMBOL_GRADIENT[ticketSymbol(t.name, t.pricePence)] }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-medium">{t.name}</span>
                  <span className="block text-[12px]" style={muted}>{a.label}</span>
                </span>
                <span className="shrink-0 font-semibold">{formatPence(t.pricePence)}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {buyable.length === 0 && (
        <p className="mt-2 text-[13px]" style={muted}>
          No tickets can be bought right now. Check back later or contact the organiser.
        </p>
      )}

      {quiet && (
        <>
          <div
            data-testid="ticket-bar-quiet"
            className="fixed inset-x-0 bottom-0 z-[60] mx-auto flex w-full max-w-[430px] items-center justify-between gap-3 rounded-t-[18px] px-3 pt-3"
            style={{ background: '#243B36', color: '#FFFFFF', borderTop: '2px solid var(--bento-hairline)', paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="min-w-0">
              <div className="text-[18px] font-bold leading-tight">{quiet.title}</div>
              <div className="text-[12px]" style={{ color: '#A59474' }}>{quiet.sub}</div>
            </div>
            <button type="button" disabled className="h-[48px] shrink-0 rounded-md px-4 text-[14px] opacity-60" style={{ border: '1.5px solid var(--bento-hairline)', color: '#D8CCB0' }}>
              {quiet.button}
            </button>
          </div>
          <div aria-hidden="true" className="h-[84px]" />
        </>
      )}

      {err && (
        <div className="mt-2 rounded-md px-3 py-2 text-[13px]" style={{ background: 'hsl(var(--bento-surface))' }} role="alert">
          <p>{err.text}</p>
          {err.way === 'contact_organiser' ? (
            organiserId ? (
              <Link to={`/organisers/${organiserId}`} className="mt-1 inline-flex min-h-[44px] items-center underline">
                {WAY_LABEL.contact_organiser}
              </Link>
            ) : null
          ) : (
            <button type="button" onClick={onWayForward} className="mt-1 min-h-[44px] underline">
              {WAY_LABEL[err.way]}
            </button>
          )}
        </div>
      )}

      {selected && max > 0 && sum && (
        <form
          className="mt-3 space-y-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void onBuy();
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <span>Quantity</span>
            <div className="flex items-center gap-1 rounded-full px-1" style={{ border: '1.5px solid #D8CCB0' }} data-testid="qty-pill" role="group" aria-label="Quantity">
              <button
                type="button"
                aria-label="One fewer ticket"
                disabled={qty <= 1}
                onClick={() => {
                  setQuantity(qty - 1);
                  if (selected) choose(selected.id, qty - 1);
                }}
                className="h-[44px] w-[44px] rounded-full text-[18px] disabled:opacity-40"
                style={{ background: 'hsl(var(--bento-surface))' }}
              >
                &minus;
              </button>
              <span className="w-8 text-center font-semibold" aria-live="polite" data-testid="ticket-qty">{qty}</span>
              <button
                type="button"
                aria-label="One more ticket"
                disabled={qty >= max}
                onClick={() => {
                  setQuantity(qty + 1);
                  if (selected) choose(selected.id, qty + 1);
                }}
                className="h-[44px] w-[44px] rounded-full text-[18px] disabled:opacity-40"
                style={{ background: 'hsl(var(--bento-surface))' }}
              >
                +
              </button>
            </div>
          </div>
          {qty >= max && (
            <p className="text-[12px]" style={muted}>
              {max === selected.remaining && max < 20 ? `Only ${max} left.` : 'Up to 20 tickets per order.'}
            </p>
          )}

          <dl className="space-y-1 text-[13px]" data-testid="ticket-totals">
            <div className="flex justify-between">
              <dt>{qty} &times; {selected.name}</dt>
              <dd>{sum.free ? 'Free' : formatPence(sum.subtotalPence)}</dd>
            </div>
            {sum.feePence > 0 && (
              <div className="flex justify-between" style={muted}>
                <dt>+ {BOOKING_FEE_LABEL} booking fee per ticket</dt>
                <dd>{formatPence(sum.feePence)}</dd>
              </div>
            )}
            {pv.appliedDiscountPence !== null && (
              <div className="flex justify-between" data-testid="promo-saving">
                <dt>Promo code {pv.sendCode}</dt>
                <dd>&minus;{formatPence(pv.appliedDiscountPence)}</dd>
              </div>
            )}
            <div className="flex justify-between font-semibold">
              <dt>Total</dt>
              <dd>{sum.free ? 'Free' : formatPence(payPence)}</dd>
            </div>
          </dl>

          {!sum.free && (
            <div>
              <label htmlFor="tickets-promo" className="mb-1 block text-[13px]">Promo code (optional)</label>
              <div className="flex gap-2">
                <input
                  id="tickets-promo"
                  type="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={PROMO_MAX_LENGTH}
                  value={promoInput}
                  readOnly={promo.status === 'checking'}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    // Return in the code field applies the code; it never submits the purchase.
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (!pv.applyBlocked) void applyPromo(promoInput);
                    }
                  }}
                  aria-describedby={pv.note || pv.applyBlocked ? 'tickets-promo-note' : undefined}
                  className="h-[44px] min-w-0 flex-1 rounded-md px-3 text-[16px] uppercase text-black"
                />
                {pv.sendCode ? (
                  <button
                    type="button"
                    onClick={removePromo}
                    className="h-[44px] shrink-0 rounded-md px-3 text-[14px] font-semibold"
                    style={{ background: 'hsl(var(--bento-surface))', border: '1px solid var(--bento-hairline)' }}
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void applyPromo(promoInput)}
                    disabled={pv.applyBlocked !== null}
                    className="h-[44px] shrink-0 rounded-md px-3 text-[14px] font-semibold disabled:opacity-50"
                    style={{ background: 'hsl(var(--bento-surface))', border: '1px solid var(--bento-hairline)' }}
                  >
                    {promo.status === 'checking' ? <>Checking&hellip;</> : 'Apply'}
                  </button>
                )}
              </div>
              {(pv.note || pv.applyBlocked) && (
                <p
                  id="tickets-promo-note"
                  role={pv.tone === 'bad' ? 'alert' : 'status'}
                  data-testid="promo-note"
                  className="mt-1 text-[12px]"
                  style={pv.tone === 'good' ? { color: 'hsl(var(--bento-accent))' } : muted}
                >
                  {promoNoteText(pv)}
                </p>
              )}
              {normaliseCode(promoInput) && !pv.sendCode && promo.status !== 'checking' && (
                <button type="button" onClick={removePromo} className="min-h-[44px] text-[13px] underline" style={muted}>
                  Clear the code and pay the full price
                </button>
              )}
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-[13px]">Email (your tickets are sent here)</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-[44px] w-full rounded-md px-3 text-[16px] text-black"
            />
          </label>
          {guest && (
            <p className="text-[13px]" style={muted} data-testid="tickets-guest-note">
              {TICKET_WHERE.guestNote}{' '}
              <Link
                to={buildSignInHref(`${location.pathname}${location.search}`)}
                className="inline-flex min-h-[44px] items-center underline"
                data-testid="tickets-guest-signin"
              >
                {TICKET_WHERE.guestSignIn}
              </Link>
            </p>
          )}
          <label className="block">
            <span className="mb-1 block text-[13px]">Name (optional)</span>
            <input
              type="text"
              autoComplete="name"
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-[44px] w-full rounded-md px-3 text-[16px] text-black"
            />
          </label>

          <div>
            <label className="flex min-h-[44px] items-center gap-3">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="h-[22px] w-[22px] shrink-0"
              />
              <span className="text-[13px]">{TERMS_CHECKBOX_LABEL}</span>
            </label>
            <button
              type="button"
              aria-expanded={showTerms}
              onClick={() => setShowTerms((v) => !v)}
              className="min-h-[44px] text-[13px] underline"
              style={muted}
            >
              {showTerms ? 'Hide the terms of sale' : 'Read the terms of sale'}
            </button>
            {showTerms && (
              <div className="space-y-1 text-[12px]" style={muted} data-testid="terms-text">
                <ul className="list-disc space-y-1 pl-4">
                  {TERMS_OF_SALE.map((line) => <li key={line}>{line}</li>)}
                </ul>
                <p>
                  {PRIVACY_PARAGRAPH} {PRIVACY_POLICY_LINE.lead}{' '}
                  <Link to={PRIVACY_POLICY_LINE.path} className="underline">{PRIVACY_POLICY_LINE.linkText}</Link>{' '}
                  {PRIVACY_POLICY_LINE.tail}
                </p>
              </div>
            )}
          </div>

          <div
            data-testid="ticket-bar"
            className="fixed inset-x-0 bottom-0 z-[60] mx-auto flex w-full max-w-[430px] items-center justify-between gap-3 rounded-t-[18px] px-3 pt-3"
            style={{ background: '#FF9900', color: '#1A0A04', paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="min-w-0">
              <div className="text-[20px] font-extrabold leading-tight" aria-live="polite" data-testid="ticket-bar-total">{sum.free ? 'Free' : formatPence(payPence)}</div>
              <div className="truncate text-[12px]" style={{ color: '#3A2200' }} id={reason ? 'tickets-buy-reason' : undefined} data-testid="ticket-bar-sub">
                {reason ?? barSummary(qty, selected.name, sum.free)}
              </div>
            </div>
            <button
              type="submit"
              disabled={reason !== null}
              aria-describedby={reason ? 'tickets-buy-reason' : undefined}
              className="h-[48px] shrink-0 rounded-md px-4 text-[15px] font-semibold disabled:opacity-50"
              style={{ background: '#1A0A04', color: '#FFFFFF' }}
            >
              {submitting ? <>Working on it&hellip;</> : pv.appliedTotalPence !== null && payPence === 0 ? 'Get free tickets' : buyLabel(selected)}
            </button>
          </div>
          <div aria-hidden="true" className="h-[84px]" />
        </form>
      )}

      {!selected && buyable.length > 1 && (
        <p className="mt-2 text-[13px]" style={muted}>Pick a ticket to choose how many.</p>
      )}
    </section>
  );
}

export default TicketsBlock;
