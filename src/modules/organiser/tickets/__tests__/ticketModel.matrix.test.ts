import { describe, expect, it } from 'vitest';
import {
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
const STRIPES: (StripeState | 'unknown')[] = ['none', 'started', 'connected', 'unknown'];

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
                if (to === 'on_sale' && paid && stripe !== 'connected') return expect(got).toMatch(/Connect payments/);
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
  it('reads organiser_stripe_accounts as none / started / connected', () => {
    expect(stripeStateOf(null)).toBe('none');
    expect(stripeStateOf({ charges_enabled: false, details_submitted: false })).toBe('started');
    expect(stripeStateOf({ charges_enabled: false, details_submitted: true })).toBe('started');
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
      { ...row, ticketsSold: 2, ordersPaid: 1, ordersPending: 1, ordersRefunded: 0, ordersDisputed: 0, grossPence: 2000, bookingFeesPence: 100, refundedPence: 0 },
      { ...row, ticketsSold: 3, ordersPaid: 2, ordersPending: 0, ordersRefunded: 1, ordersDisputed: 1, grossPence: 3000, bookingFeesPence: 150, refundedPence: 1050 },
    ]);
    expect(t).toEqual({ ticketsSold: 5, ordersPaid: 3, ordersPending: 1, ordersRefunded: 1, ordersDisputed: 1, grossPence: 5000, bookingFeesPence: 250, refundedPence: 1050 });
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
