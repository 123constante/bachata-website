import { describe, expect, it } from 'vitest';
import { BOOKING_FEE_PENCE } from '../ticketBookingFee';

describe('ticketBookingFee', () => {
  it('charges no booking fee (owner order 2026-10-29; server default is also 0)', () => {
    expect(BOOKING_FEE_PENCE).toBe(0);
  });
});
