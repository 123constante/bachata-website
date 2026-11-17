import { describe, expect, it } from 'vitest';
import { DOOR_CLOSES_AFTER_MS, DOOR_OPENS_BEFORE_MS, EXIT_TO, EXIT_WORD, ticketsClock } from '../clockState';
import { BACK_WORD } from '../../../v2/V2Shell';

const START = '2026-11-20T20:00:00Z';
const t = Date.parse(START);

describe('ticketsClock', () => {
  it('is before until the door window opens', () => {
    expect(ticketsClock(START, t - DOOR_OPENS_BEFORE_MS - 1)).toBe('before');
  });
  it('is door from the window opening to the end', () => {
    expect(ticketsClock(START, t - DOOR_OPENS_BEFORE_MS)).toBe('door');
    expect(ticketsClock(START, t)).toBe('door');
    expect(ticketsClock(START, t + DOOR_CLOSES_AFTER_MS)).toBe('door');
  });
  it('is after later, and with no coming night', () => {
    expect(ticketsClock(START, t + DOOR_CLOSES_AFTER_MS + 1)).toBe('after');
    expect(ticketsClock(null, t)).toBe('after');
    expect(ticketsClock('nonsense', t)).toBe('after');
  });
});

describe('flag-off parity', () => {
  it('keeps today’s exit wording and the new wording apart', () => {
    expect(BACK_WORD).toBe('Back to Bachata Calendar');
    expect(EXIT_WORD).toBe('Back to bachatacalendar.co.uk');
    expect(EXIT_TO).toBe('/');
  });
});
