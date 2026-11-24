import { describe, expect, it } from 'vitest';
import { hubSteps } from '../../tickets/model';
import { r4StripeCardOf, R4_STRIPE_CARD } from '../r4StripeCardModel';

const base = { flagOn: true, role: 'owner', loaded: true };
describe('r4StripeCardOf', () => {
  it('not started: title, body, button, no bar', () => {
    const m = r4StripeCardOf({ ...base, row: null });
    expect(m).toEqual({ kind: 'not_started', title: R4_STRIPE_CARD.notStartedTitle, body: R4_STRIPE_CARD.notStartedBody, pct: null, button: 'Set up payouts' });
  });
  it('started (not submitted): same count as the hub, 1 of 3, 33%', () => {
    const done = hubSteps('started').filter((x) => x.done).length;
    expect(r4StripeCardOf({ ...base, row: { details_submitted: false } })).toMatchObject({ kind: 'half', title: `Nearly there: ${done} of 3 done`, pct: 33, button: 'Finish setting up', body: null });
    expect(done).toBe(1);
  });
  it('waiting: its own text', () => {
    expect(r4StripeCardOf({ ...base, row: { details_submitted: true } })).toMatchObject({ kind: 'waiting', title: 'Stripe is checking your details. This can take a few minutes.', pct: null });
  });
  it('no night: says Sell tickets', () => {
    expect(r4StripeCardOf({ ...base, hasNight: false, row: null })?.title).toBe('Sell tickets');
    expect(r4StripeCardOf({ ...base, hasNight: true, row: null })?.title).toBe('Sell tickets for this night');
  });
  it('connected: no card', () => expect(r4StripeCardOf({ ...base, row: { charges_enabled: true } })).toBeNull());
  it('flag off: no card', () => expect(r4StripeCardOf({ ...base, flagOn: false, row: null })).toBeNull());
  it('not loaded: no card', () => expect(r4StripeCardOf({ ...base, loaded: false, row: null })).toBeNull());
  it('role that cannot set up payouts: no card', () => expect(r4StripeCardOf({ ...base, role: 'manager', row: null })).toBeNull());
});
