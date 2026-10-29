import { describe, expect, it } from 'vitest';
import {
  MAX_PER_ORDER,
  REASON_COPY,
  WAY_LABEL,
  availability,
  buildCheckoutBody,
  buyLabel,
  cancelReturnPath,
  typesForNight,
  clampQuantity,
  disabledReason,
  checkoutOriginOk,
  previewCheckoutOrigin,
  formatPence,
  maxQuantity,
  parseCheckoutReply,
  parsePublicTypes,
  reasonCopy,
  thanksCopy,
  totals,
  type PublicTicketType,
} from '../ticketCheckoutModel';
import { LEGAL_COPY_STATUS, PRIVACY_PARAGRAPH, TERMS_OF_SALE } from '../legalCopy';

const NOW = new Date('2026-10-27T12:00:00Z');
const PAST = '2026-10-01T12:00:00Z';
const FUTURE = '2026-11-20T19:00:00Z';
const PROD = 'https://www.bachatacalendar.co.uk';

type Window = 'open' | 'not_yet' | 'closed';
const mk = (p: Partial<PublicTicketType> = {}): PublicTicketType => ({
  id: '11111111-1111-1111-1111-111111111111', occurrenceId: null, name: 'Early bird', pricePence: 1200, status: 'on_sale',
  remaining: 50, salesOpenAt: null, salesCloseAt: null, ...p,
});
const win = (w: Window) =>
  w === 'not_yet' ? { salesOpenAt: FUTURE } : w === 'closed' ? { salesOpenAt: PAST, salesCloseAt: PAST } : { salesOpenAt: PAST, salesCloseAt: FUTURE };

describe('every status x window x free/paid x remaining', () => {
  const statuses = ['on_sale', 'sold_out'] as const;
  const windows: Window[] = ['open', 'not_yet', 'closed'];
  const prices = [0, 1200, 1250];
  const remainings = [0, 1, 5, 20, 25];
  for (const status of statuses) for (const w of windows) for (const price of prices) for (const remaining of remainings) {
    const t = mk({ status, pricePence: price, remaining, ...win(w) });
    it(`${status} ${w} ${price}p remaining=${remaining}`, () => {
      const a = availability(t, NOW);
      const expected = status === 'sold_out' || remaining === 0 ? 'sold_out' : w === 'not_yet' ? 'not_yet' : w === 'closed' ? 'closed' : 'buyable';
      expect(a.kind).toBe(expected);
      const max = maxQuantity(t, NOW);
      expect(max).toBe(expected === 'buyable' ? Math.min(MAX_PER_ORDER, remaining) : 0);
      expect(max).toBeLessThanOrEqual(20);
      // Every label is words, never empty.
      expect(a.label.length).toBeGreaterThan(0);
      const reason = disabledReason({ type: t, quantity: 1, email: 'a@b.co', termsAccepted: true, origin: PROD, submitting: false }, NOW);
      if (expected === 'buyable') expect(reason).toBeNull();
      else expect(reason).toMatch(/cannot be bought right now/);
      if (expected === 'buyable') {
        const s = totals(t, max);
        expect(s.free).toBe(price === 0);
        expect(s.feePence).toBe(0); // no booking fee (owner order 2026-10-29)
        expect(s.totalPence).toBe(price * max + s.feePence);
        expect(buyLabel(t)).toBe(price === 0 ? 'Get free ticket' : 'Buy tickets');
      }
    });
  }
});

describe('quantity', () => {
  it.each([[0, 5, 1], [1, 5, 1], [5, 5, 5], [9, 5, 5], [30, 20, 20], [3, 0, 0], [2.7, 5, 2]])('clamp(%s, max %s) = %s', (q, m, r) => {
    expect(clampQuantity(q, m)).toBe(r);
  });
});

describe('Buy disabled reasons (each says why)', () => {
  const ok = { type: mk(), quantity: 2, email: 'a@b.co', termsAccepted: true, origin: PROD, submitting: false };
  it.each([
    ['no type', { type: null }, /Pick a ticket/],
    ['quantity over max', { quantity: 21 }, /between 1 and 20/],
    ['no email', { email: '  ' }, /Enter your email/],
    ['bad email', { email: 'nope' }, /does not look right/],
    ['terms', { termsAccepted: false }, /accept the terms/],
    ['preview origin', { origin: 'https://bachata-website-git-x.vercel.app' }, /only works on bachatacalendar\.co\.uk/],
    ['localhost', { origin: 'http://localhost:5173' }, /only works on bachatacalendar\.co\.uk/],
    ['submitting', { submitting: true }, /Working on it/],
  ])('%s', (_n, patch, re) => {
    expect(disabledReason({ ...ok, ...patch }, NOW)).toMatch(re);
  });
  it('apex origin is allowed too', () => {
    expect(disabledReason({ ...ok, origin: 'https://bachatacalendar.co.uk' }, NOW)).toBeNull();
  });
});

describe('preview checkout origin (walk alias, preview builds only)', () => {
  const WALK = 'https://bachata-walk.vercel.app';
  it.each([
    ['preview + bare https origin', 'preview', WALK, WALK],
    ['production build ignores it', 'production', WALK, ''],
    ['no VERCEL_ENV ignores it', '', WALK, ''],
    ['unset', 'preview', '', ''],
    ['http is refused', 'preview', 'http://bachata-walk.vercel.app', ''],
    ['a path is refused', 'preview', `${WALK}/x`, ''],
    ['not a URL', 'preview', 'walk', ''],
  ])('%s', (_n, env, raw, want) => {
    expect(previewCheckoutOrigin(env, raw)).toBe(want);
  });
  it('only the named origin is allowed, the real domains still are, others are not', () => {
    expect(checkoutOriginOk(WALK, WALK)).toBe(true);
    expect(checkoutOriginOk('https://bachatacalendar.co.uk', WALK)).toBe(true);
    expect(checkoutOriginOk('https://bachata-website-git-x.vercel.app', WALK)).toBe(false);
    expect(checkoutOriginOk(WALK, '')).toBe(false);
  });
});

describe('money (GBP only, Q10)', () => {
  it.each([[0, 'Free'], [50, '\u00a30.50'], [1200, '\u00a312'], [1250, '\u00a312.50']])('%s -> %s', (p, s) => expect(formatPence(p)).toBe(s));
  it('drops non-GBP rows and unknown statuses', () => {
    const rows = parsePublicTypes([
      { id: 'a', name: 'A', price_pence: 100, currency: 'gbp', status: 'on_sale', remaining: 3 },
      { id: 'b', name: 'B', price_pence: 100, currency: 'EUR', status: 'on_sale', remaining: 3 },
      { id: 'c', name: 'C', price_pence: 100, currency: 'GBP', status: 'draft', remaining: 3 },
      null,
    ]);
    expect(rows.map((r) => r.id)).toEqual(['a']);
    expect(parsePublicTypes(null)).toEqual([]);
  });
});

describe('night and cancel return', () => {
  it('shows series-wide types plus this night only', () => {
    const list = [mk({ id: 'a' }), mk({ id: 'b', occurrenceId: 'n1' }), mk({ id: 'c', occurrenceId: 'n2' })];
    expect(typesForNight(list, 'n1').map((t) => t.id)).toEqual(['a', 'b']);
    expect(typesForNight(list, null).map((t) => t.id)).toEqual(['a']);
  });
  it('keeps ?occurrenceId on the cancel return', () => {
    expect(cancelReturnPath('/event/abc', '?occurrenceId=X')).toBe('/event/abc?occurrenceId=X&tickets=cancelled');
    expect(cancelReturnPath('/event/abc', '?tickets=cancelled')).toBe('/event/abc?tickets=cancelled');
    expect(cancelReturnPath('/event/abc', '')).toBe('/event/abc?tickets=cancelled');
  });
  it('a 401 without a reason reads as an expired sign-in, not a retry loop of internal_error', () => {
    expect(parseCheckoutReply({ code: 401, msg: 'Invalid JWT' }, 401)).toEqual({ kind: 'error', reason: 'unauthorised', message: null });
    expect(reasonCopy('unauthorised').text).toMatch(/Refresh the page/);
  });
});

describe('checkout body', () => {
  it('sends https site URLs, trims, omits a blank name', () => {
    const b = buildCheckoutBody({ typeId: 't', quantity: 3, email: ' a@b.co ', name: '  ' }, PROD, '/event/abc?tickets=cancelled');
    expect(b).toEqual({
      ticket_type_id: 't', quantity: 3, buyer_email: 'a@b.co',
      success_url: `${PROD}/tickets/thanks`, cancel_url: `${PROD}/event/abc?tickets=cancelled`,
    });
    expect(buildCheckoutBody({ typeId: 't', quantity: 1, email: 'a@b.co', name: ' Ana ' }, PROD, '/e').buyer_name).toBe('Ana');
  });
});

const SERVER_REASONS = ['invalid_request', 'rate_limited', 'not_found', 'not_on_sale', 'outside_sales_window', 'sold_out',
  'organiser_not_onboarded', 'stripe_error', 'internal_error', 'not_configured', 'invalid_quantity', 'invalid_email'];

describe('replies and every error reason', () => {
  it('redirect / free / error', () => {
    expect(parseCheckoutReply({ ok: true, order_id: 'o', checkout_url: 'https://checkout.stripe.com/x' }, 200)).toEqual({ kind: 'redirect', orderId: 'o', url: 'https://checkout.stripe.com/x' });
    expect(parseCheckoutReply({ ok: true, order_id: 'o', free: true }, 200)).toEqual({ kind: 'free', orderId: 'o' });
    expect(parseCheckoutReply({ ok: true, order_id: 'o', checkout_url: 'http://evil' }, 200).kind).toBe('error');
    expect(parseCheckoutReply(null, 404)).toEqual({ kind: 'error', reason: 'not_configured', message: null });
    expect(parseCheckoutReply(null, 500)).toEqual({ kind: 'error', reason: 'internal_error', message: null });
  });
  it.each(SERVER_REASONS)('%s has plain copy and a way forward', (r) => {
    expect(REASON_COPY[r]).toBeDefined();
    const c = reasonCopy(r);
    expect(c.text).toMatch(/[A-Z].+\.$/);
    expect(c.text).not.toMatch(/_/);
    expect(WAY_LABEL[c.way]).toBeTruthy();
  });
  it('payment-side failures say nobody was charged', () => {
    for (const r of ['stripe_error', 'internal_error']) expect(reasonCopy(r).text).toMatch(/not been charged/);
  });
  it('rate_limited uses the server message; unknown reasons fall back', () => {
    expect(reasonCopy('rate_limited', 'Slow down.').text).toMatch(/^Slow down\. If you cancelled a checkout just now/);
    expect(reasonCopy('free_issue_failed').way).toBe('retry');
  });
});

describe('thank-you copy never claims issuance from the redirect', () => {
  it.each([[false, 'confirmed'], [false, 'checking'], [false, 'none'], [true, 'checking']] as const)('free=%s order=%s', (free, state) => {
    const c = thanksCopy(free, state);
    expect(c.title).toMatch(free ? /on their way/ : state === 'confirmed' ? /^Payment received, your tickets are being emailed$/ : /^Checking your order$/);
    expect(`${c.title} ${c.body}`).not.toMatch(/issued|confirmed/i);
  });
});

describe('legal copy (owner approved 2026-10-27)', () => {
  it('is marked APPROVED and covers the brief points', () => {
    expect(LEGAL_COPY_STATUS).toBe('APPROVED');
    const all = `${TERMS_OF_SALE.join(' ')} ${PRIVACY_PARAGRAPH}`;
    for (const re of [/Stripe/, /Refunds are up to the organiser\./, /name/, /email/, /order/]) expect(all).toMatch(re);
    // No booking fee (owner order 2026-10-29): no fee sentence, no fee refund.
    expect(all).not.toMatch(/50p|booking fee|fee is ours/);
    expect(all).not.toMatch(/[\u2013\u2014\u2018\u2019\u201c\u201d\u2026]/);
  });
});
