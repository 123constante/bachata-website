/**
 * FIX-3 fix 2 (review F3): the hint under the New event chips, one function, one sentence per
 * (phase x busy) pair. Before the create is sent the chip's own hint shows; while any step runs
 * "creating"; sent but not confirmed and idle "not confirmed yet" (the event may not exist, so
 * nothing says it is made); confirmed, the locked hint (the event exists with that chip).
 */
import { describe, expect, it } from 'vitest';
import { CHIPS_LOCKED_HINT, EVENT_TYPES, FIRST_SESSION_HINT, chipHint, type CreatePhase, type NewEventType } from '../eventType';

const hintOf = (type: NewEventType) => EVENT_TYPES.find((t) => t.type === type)!.hint;
const CREATING = 'Creating your event…';
const NOT_CONFIRMED = 'Not confirmed yet. Press Create to finish: nothing is made twice.';

describe('chipHint: every (phase x busy) pair reads its one hint', () => {
  const table: Array<[CreatePhase, boolean, NewEventType | null, string]> = [
    ['open', false, null, FIRST_SESSION_HINT],
    ['open', false, 'class', hintOf('class')],
    ['open', false, 'party', hintOf('party')],
    ['open', false, 'workshop', hintOf('workshop')],
    ['open', true, 'party', CREATING], // the city lookup before the create is sent
    ['sent', true, 'party', CREATING],
    ['sent', false, 'party', NOT_CONFIRMED],
    ['made', true, 'party', CHIPS_LOCKED_HINT],
    ['made', false, 'party', CHIPS_LOCKED_HINT],
  ];
  it.each(table)('%s, busy %s, chip %s', (phase, busy, type, expected) => {
    expect(chipHint(phase, busy, type)).toBe(expected);
  });
  it('never says the event is made, or to open it, before the create is confirmed', () => {
    for (const busy of [false, true]) {
      for (const phase of ['open', 'sent'] as CreatePhase[]) {
        expect(chipHint(phase, busy, 'party')).not.toMatch(/is made|open the event/);
      }
    }
    expect(CHIPS_LOCKED_HINT).toMatch(/is made with it/);
  });
  it('the three frozen-phase hints are three different sentences', () => {
    expect(new Set([CREATING, NOT_CONFIRMED, CHIPS_LOCKED_HINT]).size).toBe(3);
  });
});
