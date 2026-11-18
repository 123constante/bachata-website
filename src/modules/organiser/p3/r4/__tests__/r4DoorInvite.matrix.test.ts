import { describe, expect, it } from 'vitest';
import { R4_DOOR_INVITE_COPY as C, r4DoorInviteOf, type R4DoorInviteIn } from '../r4DoorInviteModel';

/*
 * Board R4DoorInvite x prod shapes (survey 2026-11-18, counts only): 0 door invites and 0 door
 * seats exist; 110 series, 9 with no night coming up; pages have 1 to many events. The link is
 * never made here (no accept page), so Copy is always off with a reason and nothing is written.
 */
const ev = (nextDate: string | null, name = 'Friday Social') => ({ id: 's1', name, nextDate });
const base: R4DoorInviteIn = { load: 'ready', event: ev('2026-11-20'), many: true, doorOn: true };

const CASES: Array<[string, Partial<R4DoorInviteIn>, { load: string; pick: string | null; why: string; facts: number; preview: string | null; pickable: boolean }]> = [
  ['weekly event, next night set, many events', {}, { load: 'ready', pick: 'Friday Social, Fri 20 Nov', why: C.copyWhy, facts: 2, preview: 's1', pickable: true }],
  ['one event on the page', { many: false }, { load: 'ready', pick: 'Friday Social, Fri 20 Nov', why: C.copyWhy, facts: 2, preview: 's1', pickable: false }],
  ['no night coming up', { event: ev(null) }, { load: 'ready', pick: 'Friday Social, no night coming up', why: C.noNight, facts: 2, preview: 's1', pickable: true }],
  ['no name yet', { event: ev('2026-11-20', '  ') }, { load: 'ready', pick: 'No name yet, Fri 20 Nov', why: C.copyWhy, facts: 2, preview: 's1', pickable: true }],
  ['ticketing off: no door preview', { doorOn: false }, { load: 'ready', pick: 'Friday Social, Fri 20 Nov', why: C.copyWhy, facts: 2, preview: null, pickable: true }],
  ['no event on the page', { event: null }, { load: 'none', pick: null, why: C.none, facts: 0, preview: null, pickable: false }],
  ['loading', { load: 'loading' }, { load: 'loading', pick: null, why: C.copyWhy, facts: 0, preview: null, pickable: false }],
  ['could not load', { load: 'error' }, { load: 'error', pick: null, why: C.copyWhy, facts: 0, preview: null, pickable: false }],
];

describe('R4DoorInvite model x shape', () => {
  it.each(CASES)('%s', (_n, over, want) => {
    const m = r4DoorInviteOf({ ...base, ...over });
    expect({ load: m.load, pick: m.pick, why: m.copyWhy, facts: m.facts.length, preview: m.previewFor, pickable: m.pickable }).toEqual(want);
  });
  it('the facts are the server window and the names-only screen', () => {
    expect(r4DoorInviteOf(base).facts).toEqual(['Access ends 12 hours after the event.', 'They see names only, never money.']);
  });
});
