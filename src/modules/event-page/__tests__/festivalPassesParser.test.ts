import { describe, expect, it, vi } from 'vitest';

// Same reason ticketsParser.test.ts mocks it: this module graph reaches
// `@/modules/event-page/useFestivalDetailQuery`, which constructs the REAL
// Supabase client at import time. A pure-parser test has no business opening a
// network client, and a live one in an extra worker has red timing-sensitive
// specs in parallel before.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: vi.fn() },
}));

import { parseFestivalDetail } from '@/modules/event-page/useFestivalDetailQuery';

// `event_id` is the only field parseFestivalDetail requires; every other
// branch tolerates absence. Only the passes under test vary.
const payload = (passes: unknown[]) => ({ event_id: 'e1', passes });

describe('parseFestivalDetail - passes parser', () => {
  // Why absence must not become 0, and why the defect was latent rather than
  // live: the price comment in useFestivalDetailQuery's parsePasses. The third
  // case below is the shape that made it reachable -- an early-bird price with
  // no regular one clears FestivalDetail's `amount > 0` grid filter and used to
  // carry `price: 0` all the way into the offer.
  it('records a missing price as null, never 0', () => {
    const parsed = parseFestivalDetail(
      payload([
        { id: 'p1', name: 'No price key at all', currency: 'EUR' },
        { id: 'p2', name: 'Explicit null', price: null },
        { id: 'p3', name: 'Early bird only', early_bird_price: 105 },
      ]),
    );
    expect(parsed?.passes.map((p) => p.price)).toEqual([null, null, null]);
    // The reachable case keeps its early-bird figure: the fix removes a false
    // price, it does not discard the number the pass actually has on file.
    expect(parsed?.passes[2].earlyBirdPrice).toBe(105);
    // p1 carries a currency ON PURPOSE, as the sibling ticketsParser case does:
    // without it, an over-correction that nulled the currency alongside the
    // price -- a plausible reading of "never a currency without a price" --
    // would keep this test green.
    expect(parsed?.passes[0].currency).toBe('EUR');
  });

  // The control. Without it the case above passes just as well against a
  // parser that stopped reading `price` altogether, and a genuine 0 -- a pass
  // the organiser really did mark free -- must still arrive as 0, because
  // that IS a claim they made.
  it('still keeps a real price, including a genuine 0', () => {
    const parsed = parseFestivalDetail(
      payload([
        { id: 'p1', name: 'Full Pass', price: 160 },
        { id: 'p2', name: 'Free taster', price: 0 },
      ]),
    );
    expect(parsed?.passes.map((p) => p.price)).toEqual([160, 0]);
  });
});
