import { describe, expect, it, vi } from 'vitest';

// `parseEventPageSnapshot` is pure, but the module graph reaches
// `@/modules/event-page/useEventPageQuery`, which constructs the REAL Supabase
// client at import time -- a live client, with its own timers, in an extra
// worker. A pure-function test has no business opening a network client.
//
// SCOPE, precisely. This was the last spec whose STATIC import graph reached
// the client (7 did; the other 6 already severed it -- 4 mock the client, 2 cut
// `app/lib/ogCardRender`). It is NOT true that no test opens a client any more:
// three still construct one at RUN time from inside a test body, via
// `await import('@/pages/FestivalDetail')` -- tests/client/festivalClientState
// and tests/ssr/festivalDaysAwaySsr -- while tests/ssr/eventPageSsr declares
// never mocking it a HARD CONSTRAINT, since its whole point is proving the real
// module evaluates under node. Do not read this mock as more than it is.
//
// It is hygiene, not a fix for the EdgeTtl parallel failures: measured n=3 per
// configuration, adding it changed nothing (those are 5000ms TIMEOUTS driven by
// module-resolution cost inside `it()` bodies).
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: vi.fn() },
}));

import { parseEventPageSnapshot } from '@/modules/event-page/useEventPageQuery';

// Minimal payload satisfying parseEventPageSnapshot's require* guards -- only
// the tickets under test vary.
const minimalSnapshot = (tickets: unknown[]) => ({
  event_id: 'e1',
  event: {
    actions: {},
    meta_data_public: { tickets },
  },
  location_default: {},
  attendance: { preview: [] },
  organisers: [],
  occurrences: [],
  occurrence_effective: null,
});

describe('parseEventPageSnapshot - tickets parser', () => {
  it('keeps string prices and parses currency', () => {
    const snap = parseEventPageSnapshot(
      minimalSnapshot([
        { id: 't1', name: 'Standard', price: '15', currency: 'EUR', quantity: '50', description: 'Early bird' },
      ]),
    );
    expect(snap?.event.tickets).toEqual([
      { id: 't1', name: 'Standard', price: '15', currency: 'EUR', quantity: '50', description: 'Early bird' },
    ]);
  });

  it('accepts numeric price/quantity (older admin rows persisted JSON numbers)', () => {
    const snap = parseEventPageSnapshot(
      minimalSnapshot([{ id: 't1', name: 'Door', price: 40, quantity: 100 }]),
    );
    expect(snap?.event.tickets).toEqual([
      { id: 't1', name: 'Door', price: '40', currency: null, quantity: '100', description: '' },
    ]);
  });

  it('still drops rows without an id', () => {
    const snap = parseEventPageSnapshot(
      minimalSnapshot([{ name: 'No id', price: 10 }, { id: 't2', name: 'Kept', price: '5' }]),
    );
    expect(snap?.event.tickets.map((t) => t.id)).toEqual(['t2']);
  });
});
