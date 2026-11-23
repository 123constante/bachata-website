import { describe, expect, it } from 'vitest';
import { r4StripeCardOf, R4_STRIPE_CARD } from '../r4StripeCardModel';

const base = { flagOn: true, role: 'owner', loaded: true };
describe('r4StripeCardOf', () => {
  it('not started: title, body, button, no bar', () => {
    const m = r4StripeCardOf({ ...base, row: null });
    expect(m).toEqual({ kind: 'not_started', title: R4_STRIPE_CARD.notStartedTitle, body: R4_STRIPE_CARD.notStartedBody, pct: null, button: 'Set up payouts' });
  });
  it.each([{ details_submitted: false }, { details_submitted: true }])('half-finished %o: 2 of 3, 66%', (row) => {
    expect(r4StripeCardOf({ ...base, row })).toMatchObject({ kind: 'half', title: 'Nearly there: 2 of 3 done', pct: 66, button: 'Finish setting up', body: null });
  });
  it('connected: no card', () => expect(r4StripeCardOf({ ...base, row: { charges_enabled: true } })).toBeNull());
  it('flag off: no card', () => expect(r4StripeCardOf({ ...base, flagOn: false, row: null })).toBeNull());
  it('not loaded: no card', () => expect(r4StripeCardOf({ ...base, loaded: false, row: null })).toBeNull());
  it('role that cannot set up payouts: no card', () => expect(r4StripeCardOf({ ...base, role: 'manager', row: null })).toBeNull());
});
