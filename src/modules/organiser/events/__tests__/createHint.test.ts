/**
 * FIX-3 fix 2 (review F3): the hint under the New event chips, one function, one sentence per
 * (phase x busy) pair. Before the create is sent the chip's own hint shows; while any step runs
 * before the create is confirmed "creating"; sent but not confirmed and idle "not confirmed yet"
 * (the event may not exist, so nothing says it is made); confirmed and still running "finishing"
 * (FIX-4 F9: Create is busy, so nothing says to press it); confirmed and idle, the locked hint.
 */
import { describe, expect, it } from 'vitest';
import {
  CHIPS_LOCKED_HINT, EVENT_TYPES, FIRST_SESSION_HINT, HINT_BOX_LINES, HINT_CHARS_PER_LINE, chipHint, unconfirmedExitNote,
  type CreatePhase, type NewEventType,
} from '../eventType';
import { reopensAfterFailedCreate } from '../newEvent';

const hintOf = (type: NewEventType) => EVENT_TYPES.find((t) => t.type === type)!.hint;
const CREATING = 'Creating your event\u2026';
const FINISHING = 'Finishing your event\u2026';
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
    ['made', true, 'party', FINISHING], // FIX-4 F9: Create is busy, so the hint never says to press it
    ['made', false, 'party', CHIPS_LOCKED_HINT],
  ];
  it.each(table)('%s, busy %s, chip %s', (phase, busy, type, expected) => {
    expect(chipHint(phase, busy, type)).toBe(expected);
  });
  it('never says the event is made, or to open it, before the create is confirmed', () => {
    for (const busy of [false, true]) {
      for (const phase of ['open', 'sent'] as CreatePhase[]) {
        // "nothing is made twice" (the brief's own not-confirmed sentence) is not a claim the event exists.
        expect(chipHint(phase, busy, 'party')).not.toMatch(/is made with it|open the event/);
      }
    }
    expect(CHIPS_LOCKED_HINT).toMatch(/is made with it/);
  });
  it('never tells the person to press Create while a step runs (Create is busy)', () => {
    for (const phase of ['open', 'sent', 'made'] as CreatePhase[]) {
      expect(chipHint(phase, true, 'class')).not.toMatch(/Press Create/);
    }
  });
  it('the four frozen-phase hints are four different sentences', () => {
    expect(new Set([CREATING, FINISHING, NOT_CONFIRMED, CHIPS_LOCKED_HINT]).size).toBe(4);
  });
});

// FIX-4 F4: the hint box is a fixed number of lines so Create never moves while the hint changes.
// Measured in headless Chromium (html 13.57px, 13px text): at 320px wide (box 288px) the 107-char
// Class hint takes 3 lines and the 88-char Party hint 2, so a line holds at least 44 characters;
// HINT_CHARS_PER_LINE (40) is below that. Every hint the table can show must fit the box.
describe('the hint box fits every hint', () => {
  const every = new Set<string>();
  for (const phase of ['open', 'sent', 'made'] as CreatePhase[]) {
    for (const busy of [false, true]) {
      for (const type of [null, 'class', 'party', 'workshop'] as Array<NewEventType | null>) every.add(chipHint(phase, busy, type));
    }
  }
  it.each([...every])('%s', (hint) => {
    expect(Math.ceil(hint.length / HINT_CHARS_PER_LINE)).toBeLessThanOrEqual(HINT_BOX_LINES);
  });
  it('the table holds the longest hint (the Class chip)', () => {
    expect([...every].sort((a, b) => b.length - a.length)[0]).toBe(hintOf('class'));
  });
});

// FIX-4 F1: the form reopens after a failed create ONLY when nothing can have been saved: the
// press that failed was the FIRST send and the server refused it.
describe('reopensAfterFailedCreate', () => {
  const table: Array<[string, { refused: boolean; firstSend: boolean }, boolean]> = [
    ['first send refused', { refused: true, firstSend: true }, true],
    ['first send lost (not a refusal)', { refused: false, firstSend: true }, false],
    ['a resend refused (an earlier send may have saved it)', { refused: true, firstSend: false }, false],
    ['a resend lost', { refused: false, firstSend: false }, false],
  ];
  it.each(table)('%s', (_n, input, expected) => {
    expect(reopensAfterFailedCreate(input)).toBe(expected);
  });
});

// FIX-4 F5: sent, not confirmed, and the organiser became blocked: Create is disabled and the chips
// are frozen, so the one exit is the shell's back link. The note names it as it reads on screen.
describe('unconfirmedExitNote', () => {
  it('names the Events list and the back link by its own label', () => {
    expect(unconfirmedExitNote('Events')).toBe('If your event was saved it is in your Events list; use Events at the top to leave.');
    expect(unconfirmedExitNote('Back')).toBe('If your event was saved it is in your Events list; use Back at the top to leave.');
  });
});
