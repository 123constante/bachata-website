import { describe, expect, it } from 'vitest';
import { PAYOUTS_ASK_OWNER, canSetUpPayouts, connectBlock, connectReturnBanner, moveBlock, type StripeState } from '../../../tickets/ticketModel';
import { showPrompt } from '../model';
import { startView } from '../GetPaid';
import { org } from './fixtures';

/* Screen x role, from ONE mapping (canSetUpPayouts): only the owner is ever offered Stripe onboarding. */
const ROLES = [['owner', true], ['manager', false], ['contributor', false], [null, false]] as const;
const NOT_CONNECTED: StripeState[] = ['none', 'started', 'waiting'];
const paid = [{ id: 't', name: 'GA', pricePence: 1000, status: 'draft' as const }];
const off = { switchedOff: false, note: null };

describe('payout set-up is owner-only on every entry point', () => {
  it.each(ROLES)('role %s: canSetUpPayouts = %s', (role, want) => expect(canSetUpPayouts(role)).toBe(want));

  describe.each(ROLES)('role %s', (role, owner) => {
    it.each(NOT_CONNECTED)('Home prompt, %s', (state) => expect(showPrompt(role, true, state)).toBe(owner));
    it.each(NOT_CONNECTED)('Get paid screen, %s: connect button only for owner; others told to ask', (state) => {
      const v = startView({ manager: role === 'owner' || role === 'manager', owner, state, arrival: 'fresh', phase: null, switchedOff: false, org: org({ role: role ?? undefined } as never) });
      const connects = [v.primary, v.secondary].filter((c) => c?.kind === 'connect').length;
      expect(connects > 0).toBe(owner);
      if (!owner) expect(v.note).toMatch(/^Ask .* to connect payments$/);
    });
    it.each(NOT_CONNECTED)('Tickets connect block, %s', (stripe) => expect(connectBlock(1000, { role: role as never, stripe }, off) !== null).toBe(owner));
    it.each(['none', 'started', 'waiting'] as const)('Tickets return banner, %s: no carry-on for non-owner', (stripe) => {
      for (const flags of [{ arrivedFromStripe: true }, { arrivedFromStripe: false, refresh: true }]) {
        const b = connectReturnBanner({ ...flags, stripe, role: role as never, drafts: paid, polling: false });
        const carry = b?.actions.some((a) => a.kind === 'carry_on') ?? false;
        expect(carry).toBe(owner && b !== null);
        if (!owner && b) expect(b.line).not.toMatch(/Stripe link ran out|Carry on/);
      }
    });
    it('put-on-sale reason points only at a control the person has', () => {
      const r = moveBlock({ pricePence: 1000, reserved: 0, capacity: 5 }, 'on_sale', { role: role as never, stripe: 'none', seriesLive: true });
      if (role === 'manager') expect(r).toBe(PAYOUTS_ASK_OWNER);
      if (role === 'owner') expect(r).toMatch(/Connect payments/);
    });
  });
});
