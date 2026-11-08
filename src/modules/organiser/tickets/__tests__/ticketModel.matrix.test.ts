import { describe, expect, it } from 'vitest';
import {
  newRefundRequestId,
  partialRefundDone,
  refundAmountError,
  refundPartQuestion,
  MOVE_LABEL,
  NEXT_STATUS,
  NOT_MANAGER,
  NOT_SWITCHED_ON,
  STATUS_LABEL,
  STATUS_TONE,
  TICKET_STATUSES,
  buildUpsert,
  canManage,
  editLock,
  formOf,
  isoToLondonInput,
  londonInputToIso,
  moveBlock,
  penceOf,
  priceLabel,
  priceLock,
  reasonMessage,
  refundBlock,
  refundQuestion,
  refundable,
  stripeStateOf,
  totalsOf,
  validateForm,
  type StripeState,
  type TicketStatus,
  type TicketType,
} from '../ticketModel';
import { classifyEdge } from '../ticketsApi';

const type = (over: Partial<TicketType> = {}): TicketType => ({
  id: 't1',
  seriesId: 's1',
  occurrenceId: null,
  name: 'Early bird',
  pricePence: 1250,
  capacity: 100,
  reserved: 0,
  salesOpenAt: null,
  salesCloseAt: null,
  status: 'draft',
  manualSoldOut: false,
  ...over,
});

/** ticket_type_set_status_v1's CASE, copied from the live function body (2026-10-27). */
const SERVER_ALLOWS: Record<TicketStatus, TicketStatus[]> = {
  draft: ['on_sale', 'closed'],
  on_sale: ['paused', 'sold_out', 'closed'],
  paused: ['on_sale', 'closed'],
  sold_out: ['on_sale', 'closed'],
  closed: [],
};

describe('status machine mirrors the server', () => {
  for (const from of TICKET_STATUSES) {
    for (const to of TICKET_STATUSES) {
      if (from === to) continue;
      it(`${from} -> ${to}: offered iff the server accepts it`, () => {
        expect(NEXT_STATUS[from].includes(to)).toBe(SERVER_ALLOWS[from].includes(to));
      });
    }
  }
  it('every status has words, a tone, and every reachable target a button label', () => {
    for (const s of TICKET_STATUSES) {
      expect(STATUS_LABEL[s]).toBeTruthy();
      expect(STATUS_TONE[s]).toBeTruthy();
      for (const to of NEXT_STATUS[s]) expect(MOVE_LABEL[to]).toBeTruthy();
    }
  });
});

const ROLES = ['owner', 'manager', 'contributor'] as const;
const STRIPES: (StripeState | 'unknown')[] = ['none', 'started', 'waiting', 'connected', 'unknown'];

describe('moveBlock: every status x role x Stripe x free/paid x room left x series live', () => {
  for (const from of TICKET_STATUSES)
    for (const to of NEXT_STATUS[from])
      for (const role of ROLES)
        for (const stripe of STRIPES)
          for (const paid of [false, true])
            for (const full of [false, true])
              for (const seriesLive of [true, false]) {
              it(`${from}->${to} ${role} ${stripe} ${paid ? 'paid' : 'free'} ${full ? 'full' : 'room'} ${seriesLive ? 'live' : 'not-live'}`, () => {
                const t = type({ status: from, pricePence: paid ? 1000 : 0, reserved: full ? 100 : 3 });
                const got = moveBlock(t, to, { role, stripe, seriesLive });
                if (role === 'contributor') return expect(got).toBe(NOT_MANAGER);
                if (to === 'on_sale' && !seriesLive) return expect(got).toMatch(/Put this event live/);
                if (to === 'on_sale' && full) return expect(got).toMatch(/Every ticket is taken/);
                if (to === 'on_sale' && paid && stripe === 'unknown') return expect(got).toMatch(/Checking your payment set-up/);
                // Q1: a free ticket type never needs Stripe.
                if (to === 'on_sale' && paid && stripe !== 'connected') return expect(got).toMatch(stripe === 'waiting' ? /still checking your details/ : /Connect payments/);
                expect(got).toBeNull();
              });
            }
});

describe('roles (Q15)', () => {
  it('only owner and manager manage or refund', () => {
    expect(canManage('owner')).toBe(true);
    expect(canManage('manager')).toBe(true);
    expect(canManage('contributor')).toBe(false);
    expect(canManage(undefined)).toBe(false);
    expect(refundBlock('owner')).toBeNull();
    expect(refundBlock('contributor')).toMatch(/owner or manager/);
  });
  it('edit lock: contributor always, anyone on a closed type', () => {
    for (const s of TICKET_STATUSES) {
      expect(editLock(type({ status: s }), 'contributor')).toBe(NOT_MANAGER);
      expect(editLock(type({ status: s }), 'owner') !== null).toBe(s === 'closed');
    }
    expect(editLock(null, 'manager')).toBeNull();
  });
});

describe('Get paid', () => {
  it('reads organiser_stripe_accounts as none / started / waiting / connected', () => {
    expect(stripeStateOf(null)).toBe('none');
    expect(stripeStateOf({ charges_enabled: false, details_submitted: false })).toBe('started');
    expect(stripeStateOf({ charges_enabled: false, details_submitted: true })).toBe('waiting');
    expect(stripeStateOf({ charges_enabled: true })).toBe('connected');
  });
  it.each([
    [404, null, 'not_configured'],
    [404, { code: 'NOT_FOUND', message: 'Requested function was not found' }, 'not_configured'],
    [404, { reason: 'not_found' }, 'failed'],
    [503, { error: 'not_configured' }, 'not_configured'],
    [200, { error: 'not_configured' }, 'not_configured'],
    [500, { error: 'stripe_down' }, 'failed'],
    [403, { error: 'not_authorised' }, 'failed'],
    [200, { url: 'https://connect.stripe.com/x' }, 'ok'],
  ] as const)('edge answer %s %j -> %s (never a crash)', (status, body, kind) => {
    expect(classifyEdge(status, body).kind).toBe(kind);
  });
  it('the not-switched-on words say free tickets still work', () => {
    expect(NOT_SWITCHED_ON).toMatch(/not switched on yet/);
    expect(NOT_SWITCHED_ON).toMatch(/Free tickets work/);
  });
});

describe('money', () => {
  it.each([
    ['12', 1200],
    ['12.5', 1250],
    ['12.50', 1250],
    ['\u00A312.50', 1250],
    ['0', 0],
    ['10000', 1_000_000],
    ['10000.01', null],
    ['12.505', null],
    ['-1', null],
    ['abc', null],
    ['', null],
  ])('penceOf(%j) = %j', (text, pence) => expect(penceOf(text)).toBe(pence));
  it('Free for 0, pounds otherwise', () => {
    expect(priceLabel(0)).toBe('Free');
    expect(priceLabel(1250)).toBe('\u00A312.50');
  });
  it('totals add every type', () => {
    const row = { id: 'a', seriesId: 's', name: 'n', status: 'on_sale' as const, pricePence: 1000, capacity: 10, reserved: 2 };
    const t = totalsOf([
      { ...row, ticketsSold: 2, ordersPaid: 1, ordersPending: 1, ordersRefunded: 0, ordersDisputed: 0, grossPence: 2000, discountsPence: 0, bookingFeesPence: 100, refundedPence: 0 },
      { ...row, ticketsSold: 3, ordersPaid: 2, ordersPending: 0, ordersRefunded: 1, ordersDisputed: 1, grossPence: 3000, discountsPence: 200, bookingFeesPence: 150, refundedPence: 1050 },
    ]);
    expect(t).toEqual({ ticketsSold: 5, ordersPaid: 3, ordersPending: 1, ordersRefunded: 1, ordersDisputed: 1, grossPence: 5000, discountsPence: 200, bookingFeesPence: 250, refundedPence: 1050 });
  });
});

describe('sales window is London wall clock', () => {
  it('round-trips in GMT and in BST', () => {
    expect(londonInputToIso('2026-12-05T20:00')).toBe('2026-12-05T20:00:00.000Z');
    expect(londonInputToIso('2026-07-05T20:00')).toBe('2026-07-05T19:00:00.000Z');
    expect(isoToLondonInput('2026-07-05T19:00:00+00:00')).toBe('2026-07-05T20:00');
    expect(isoToLondonInput(null)).toBe('');
    expect(londonInputToIso('')).toBeNull();
  });
});

describe('editor: validation and the untouched save', () => {
  it('an untouched edit sends nothing, for every status and window shape', () => {
    for (const s of TICKET_STATUSES) {
      for (const w of [
        [null, null],
        ['2026-07-01T18:00:00+00:00', null],
        [null, '2026-12-01T23:00:00+00:00'],
        ['2026-07-01T18:00:00+00:00', '2026-12-01T23:00:00+00:00'],
      ] as const) {
        for (const price of [0, 1250]) {
          const t = type({ status: s, pricePence: price, salesOpenAt: w[0], salesCloseAt: w[1] });
          expect(buildUpsert(formOf(t), t, { organiserId: 'o1', seriesId: 's1' })).toBeNull();
        }
      }
    }
  });
  it('a changed edit sends the full row with the occurrence unchanged', () => {
    const t = type({ occurrenceId: 'occ1' });
    const d = buildUpsert({ ...formOf(t), capacity: '120' }, t, { organiserId: 'o1', seriesId: 's1' });
    expect(d).toMatchObject({ id: 't1', occurrenceId: 'occ1', capacity: 120, pricePence: 1250, name: 'Early bird' });
  });
  it('a new type always sends, free = 0p', () => {
    const d = buildUpsert({ ...formOf(null), name: ' Door ', capacity: '50' }, null, { organiserId: 'o1', seriesId: 's1' });
    expect(d).toMatchObject({ id: null, name: 'Door', pricePence: 0, capacity: 50, seriesId: 's1', occurrenceId: null });
  });
  it('validation says what to do', () => {
    const e = validateForm({ name: '', paid: true, price: 'x', capacity: '0', opensAt: '2026-12-02T20:00', closesAt: '2026-12-01T20:00' }, { hasOrders: false, reserved: 0 });
    expect(e.name).toMatch(/Give the ticket a name/);
    expect(e.price).toMatch(/Enter a price/);
    expect(e.capacity).toMatch(/from 1 to 100,000/);
    expect(e.closesAt).toMatch(/close after they open/);
    expect(validateForm({ ...formOf(type()), capacity: '2' }, { hasOrders: true, reserved: 5 }).capacity).toMatch(/5 tickets are already taken/);
    expect(validateForm(formOf(type()), { hasOrders: false, reserved: 0 })).toEqual({});
  });
  it('price lock once orders exist', () => {
    expect(priceLock(true)).toMatch(/cannot change/);
    expect(priceLock(false)).toBeNull();
  });
});

describe('refunds (Q5, Q9)', () => {
  const order = { id: 'o', typeId: 't1', buyerName: 'Ana', quantity: 2, subtotalPence: 2000, bookingFeePence: 100, totalPence: 2100, refundedPence: 0, status: 'paid', paidAt: null };
  it('only paid orders are refundable', () => {
    expect(refundable(order)).toBe(true);
    expect(refundable({ ...order, status: 'refunded' })).toBe(false);
    expect(refundable({ ...order, status: 'disputed' })).toBe(false);
    expect(refundable({ ...order, totalPence: 0 })).toBe(false); // a free order
    expect(refundable({ ...order, refundedPence: 2100 })).toBe(false); // already refunded in full
  });
  it('the question names the buyer and the amount, and says the booking fee goes back too', () => {
    const q = refundQuestion(order);
    expect(q.title).toBe('Refund Ana?');
    expect(q.body).toBe('\u00A321.00 goes back, booking fee included. Their 2 tickets stop working and the places reopen. Cannot be undone.');
    expect(q.confirm).toBe('Refund \u00A321.00');
    expect(refundQuestion({ ...order, refundedPence: 500 }).confirm).toBe('Refund \u00A316.00');
    expect(refundQuestion({ ...order, quantity: 1 }).body).toMatch(/Their ticket stops working and the place reopens/);
    expect(refundQuestion({ ...order, buyerName: null }).title).toBe('Refund Buyer?');
  });
});

describe('server refusals all have words', () => {
  it.each([
    'not_authorised', 'not_found', 'invalid_payload', 'invalid_name', 'invalid_price', 'invalid_capacity',
    'invalid_sales_window', 'series_not_live_or_not_organisers', 'series_not_live', 'occurrence_not_in_series',
    'immutable_field', 'closed', 'has_orders', 'capacity_below_reserved', 'bad_transition', 'at_capacity',
    'organiser_not_onboarded',
  ])('%s', (r) => expect(reasonMessage(r)).not.toBe(reasonMessage('???')));
});

// ---- Partial refunds (brief ticket-partial-refund-ui; owner Q5) ------------------------

describe('partial refund amount (refundAmountError)', () => {
  // 25.00 paid, 17.00 already refunded: 8.00 left.
  const left = { totalPence: 2500, refundedPence: 1700 };
  const ROWS: Array<[string, 'ok' | 'empty' | 'price' | 'zero' | 'over']> = [
    ['', 'empty'],
    ['   ', 'empty'],
    ['abc', 'price'],
    ['0', 'zero'],
    ['0.00', 'zero'],
    ['-1', 'price'],
    ['0.001', 'price'],
    ['3', 'ok'],
    ['3.5', 'ok'],
    ['3.50', 'ok'],
    ['\u00A33.50', 'ok'],
    ['GBP3', 'price'],
    ['8', 'ok'], // exactly what is left: sent as a partial, the server decides clears_balance
    ['8.01', 'over'], // remaining + 1p
    ['10000.01', 'price'], // over the 1,000,000p cap
  ];
  it.each(ROWS)('%j -> %s', (text, want) => {
    const e = refundAmountError(text, left);
    if (want === 'ok') return expect(e).toBeNull();
    expect(e).toBeTruthy();
    // Every refusal names the maximum, so the person knows what to type.
    expect(e).toContain('\u00A38.00');
    if (want === 'empty') expect(e).toMatch(/^Enter how much/);
    if (want === 'over') expect(e).toMatch(/more than is left/);
    if (want === 'zero') expect(e).toMatch(/more than \u00A30/);
    if (want === 'price') expect(e).toMatch(/in pounds/);
  });
  it('the maximum is the remainder on a part-refunded order, the total on an untouched one', () => {
    expect(refundAmountError('25', { totalPence: 2500, refundedPence: 0 })).toBeNull();
    expect(refundAmountError('25.01', { totalPence: 2500, refundedPence: 0 })).toContain('\u00A325.00');
    expect(refundAmountError('8.01', left)).toContain('\u00A38.00');
  });
});

describe('partial refund words', () => {
  it('done: the amount, what is left, tickets stay valid', () => {
    expect(partialRefundDone(300, 500)).toBe('Refunded \u00A33.00. \u00A35.00 is left to refund. Tickets stay valid.');
    expect(partialRefundDone(800, 0)).toBe('Refunded \u00A38.00. Nothing is left to refund.');
    // The server cleared the balance: no promise about the tickets (the server settles the order).
    expect(partialRefundDone(800, 0, true)).toBe('Refunded \u00A38.00. Nothing is left to refund.');
    // No remainder in the reply: none is guessed from a row the webhook has not updated yet.
    expect(partialRefundDone(300, null)).toBe('Refunded \u00A33.00. Tickets stay valid.');

  });
  it('the partial question says tickets stay valid and names the maximum', () => {
    const q = refundPartQuestion({ totalPence: 2500, refundedPence: 1700 }, 300);
    expect(q.max).toBe('Up to \u00A38.00 left to refund');
    expect(q.body).toMatch(/stay valid/);
    expect(q.confirm).toBe('Refund \u00A33.00');
    expect(refundPartQuestion({ totalPence: 2500, refundedPence: 1700 }, null).confirm).toBe('Refund');
    // Exactly what is left: the server decides what happens to the order, so no promise about tickets.
    expect(refundPartQuestion({ totalPence: 2500, refundedPence: 1700 }, 800).body).not.toMatch(/stay valid|stays paid/);

  });
  it('a request id is 8-64 chars of [A-Za-z0-9_-], fresh each call, also without crypto.randomUUID', () => {
    const a = newRefundRequestId();
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(newRefundRequestId()).not.toBe(a);
    const real = globalThis.crypto.randomUUID;
    try {
      Object.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined, configurable: true });
      expect(newRefundRequestId()).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    } finally {
      Object.defineProperty(globalThis.crypto, 'randomUUID', { value: real, configurable: true });
    }
  });
});

describe('refund refusal words (the server reasons of ticket-refund)', () => {
  const GENERIC = 'That did not work. Try again in a moment.';
  // Controls the Refund sheet shows: the two choices, the amount field, Refund, Keep the order.
  const NOT_ON_SCREEN = /\b(Retry|Cancel|Settings|Dashboard|Stripe|Contact support|Undo)\b/i;
  it.each(['invalid_amount', 'request_id_required', 'request_id_reused', 'not_refundable', 'refund_exceeds_balance'])('%s has its own words', (r) => {
    const t = reasonMessage(r);
    expect(t).not.toBe(GENERIC);
    expect(t).not.toMatch(NOT_ON_SCREEN);
    expect(t).toMatch(/\.$/);
    expect(t).not.toMatch(/\bPress\b/); // house rule: Tap, never Press

    expect(t).not.toMatch(/[\u2018\u201C\u00E2]/); // no curly-quote or mojibake bytes in the copy
  });
  it('refund_exceeds_balance says an earlier refund may still be settling', () => {
    expect(reasonMessage('refund_exceeds_balance')).toMatch(/earlier refund.*settling.*wait a minute/i);
  });
});
