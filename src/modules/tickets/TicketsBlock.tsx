import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchPublicTicketTypes, postTicketCheckout, publicTicketKeys } from './ticketCheckoutApi';
import {
  CANCELLED_PARAM,
  ORDER_STORAGE_KEY,
  THANKS_PATH,
  WAY_LABEL,
  availability,
  buildCheckoutBody,
  buyLabel,
  clampQuantity,
  disabledReason,
  formatPence,
  maxQuantity,
  reasonCopy,
  totals,
  type PublicTicketType,
} from './ticketCheckoutModel';
import { PRIVACY_PARAGRAPH, TERMS_CHECKBOX_LABEL, TERMS_OF_SALE } from './legalCopy';

/**
 * The Tickets block on /event/:id (S4, docs/ticketing-buyer-journey.md). Mounted by
 * BentoPage only while flags.publicTicketing is on and the night is still bookable;
 * renders nothing until the series has a type on sale or sold out.
 */
export interface TicketsBlockProps {
  seriesId: string;
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
const accentBg = { background: 'hsl(var(--bento-accent))', color: 'hsl(var(--bento-surface))' } as const;

function saveOrderId(id: string) {
  try {
    window.sessionStorage.setItem(ORDER_STORAGE_KEY, id);
  } catch {
    /* storage blocked: the thank-you page still shows the paid copy without an order id */
  }
}

export function TicketsBlock({ seriesId, organiserId, now: nowProp, origin: originProp }: TicketsBlockProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: types } = useQuery({
    queryKey: publicTicketKeys.types(seriesId),
    queryFn: () => fetchPublicTicketTypes(seriesId),
    staleTime: 30_000,
  });
  const now = nowProp ?? new Date();
  const origin = originProp ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const cancelled = new URLSearchParams(location.search).get(CANCELLED_PARAM) === 'cancelled';

  const [typeId, setTypeId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ reason: string; message: string | null } | null>(null);

  const list = types ?? [];
  const buyable = list.filter((t) => maxQuantity(t, now) > 0);
  // One buyable type is picked for the buyer; otherwise they choose.
  const selected: PublicTicketType | null =
    list.find((t) => t.id === typeId) ?? (buyable.length === 1 ? buyable[0] : null);
  const max = selected ? maxQuantity(selected, now) : 0;
  const qty = clampQuantity(quantity, max);

  useEffect(() => {
    if (quantity !== qty && qty > 0) setQuantity(qty);
  }, [quantity, qty]);

  if (list.length === 0) return null;

  const reason = disabledReason({ type: selected, quantity: qty, email, termsAccepted, origin, submitting }, now);
  const sum = selected ? totals(selected, qty) : null;
  const err = error ? reasonCopy(error.reason, error.message) : null;

  async function onBuy() {
    if (!selected || reason) return;
    setSubmitting(true);
    setError(null);
    const result = await postTicketCheckout(
      buildCheckoutBody({ typeId: selected.id, quantity: qty, email, name }, origin, location.pathname),
    );
    if (result.kind === 'redirect') {
      saveOrderId(result.orderId);
      window.location.assign(result.url);
      return;
    }
    setSubmitting(false);
    if (result.kind === 'free') {
      saveOrderId(result.orderId);
      navigate(`${THANKS_PATH}?o=${encodeURIComponent(result.orderId)}&free=1`);
      return;
    }
    setError({ reason: result.reason, message: result.message });
  }

  function onWayForward() {
    if (!err) return;
    if (err.way === 'pick_another') setTypeId(null);
    if (err.way === 'retry' || err.way === 'pick_another' || err.way === 'fix_form') setError(null);
  }

  return (
    <section aria-labelledby="tickets-heading" className="mb-3 rounded-md p-3 text-[14px]" style={card} data-testid="tickets-block">
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
                }}
                className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left disabled:opacity-60"
                style={{
                  background: 'hsl(var(--bento-surface))',
                  border: isSel ? '2px solid hsl(var(--bento-accent))' : '1px solid var(--bento-hairline)',
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{t.name}</span>
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

      {selected && max > 0 && sum && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span>Quantity</span>
            <div className="flex items-center gap-2" role="group" aria-label="Quantity">
              <button
                type="button"
                aria-label="One fewer ticket"
                disabled={qty <= 1}
                onClick={() => setQuantity(qty - 1)}
                className="h-[44px] w-[44px] rounded-md text-[18px] disabled:opacity-40"
                style={{ background: 'hsl(var(--bento-surface))' }}
              >
                &minus;
              </button>
              <span className="w-8 text-center font-semibold" aria-live="polite" data-testid="ticket-qty">{qty}</span>
              <button
                type="button"
                aria-label="One more ticket"
                disabled={qty >= max}
                onClick={() => setQuantity(qty + 1)}
                className="h-[44px] w-[44px] rounded-md text-[18px] disabled:opacity-40"
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
            {!sum.free && (
              <div className="flex justify-between" style={muted}>
                <dt>+ 50p booking fee per ticket</dt>
                <dd>{formatPence(sum.feePence)}</dd>
              </div>
            )}
            <div className="flex justify-between font-semibold">
              <dt>Total</dt>
              <dd>{sum.free ? 'Free' : formatPence(sum.totalPence)}</dd>
            </div>
          </dl>

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
                <p>{PRIVACY_PARAGRAPH}</p>
              </div>
            )}
          </div>

          {err && (
            <div className="rounded-md px-3 py-2 text-[13px]" style={{ background: 'hsl(var(--bento-surface))' }} role="alert">
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

          <div>
            <button
              type="button"
              onClick={onBuy}
              disabled={reason !== null}
              aria-describedby={reason ? 'tickets-buy-reason' : undefined}
              className="min-h-[48px] w-full rounded-md px-3 py-2 text-[15px] font-semibold disabled:opacity-50"
              style={accentBg}
            >
              {submitting ? <>Working on it&hellip;</> : buyLabel(selected)}
            </button>
            {reason && (
              <p id="tickets-buy-reason" className="mt-1 text-[12px]" style={muted}>{reason}</p>
            )}
          </div>
        </div>
      )}

      {!selected && buyable.length > 1 && (
        <p className="mt-2 text-[13px]" style={muted}>Pick a ticket to choose how many.</p>
      )}
    </section>
  );
}

export default TicketsBlock;
