import { describe, expect, it } from 'vitest';
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
