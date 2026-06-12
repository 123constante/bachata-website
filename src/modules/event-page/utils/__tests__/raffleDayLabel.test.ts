// =============================================================================
// raffleDayLabel — locks the day-chip logic for the /raffles page cards.
//
// The convention under test: stored timestamps are wall-clock-as-UTC, so the
// event's calendar date is startIso.slice(0,10) verbatim, while "today" is
// computed in the Europe/London frame (the frame the wall clocks are written
// in). The BST midnight edge is the case that breaks naive implementations:
// at 23:30Z on the 11th, London is already 00:30 on the 12th.
//
// Known June 2026 anchors: 2026-06-11 = Thursday, 2026-06-12 = Friday,
// 2026-06-15 = Monday, 2026-06-20 = Saturday.
// =============================================================================

import { describe, it, expect } from 'vitest';
import { raffleDayLabel } from '../raffleCountdown';

// 15:00 UTC on Thu 11 Jun 2026 -> 16:00 BST, London "today" = 2026-06-11.
const THU_AFTERNOON = Date.parse('2026-06-11T15:00:00Z');
// 23:30 UTC on Thu 11 Jun -> 00:30 BST Fri 12 Jun. London has rolled over; UTC has not.
const BST_MIDNIGHT_EDGE = Date.parse('2026-06-11T23:30:00Z');

describe('raffleDayLabel', () => {
  it('same London day -> Tonight', () => {
    expect(raffleDayLabel('2026-06-11 20:00:00+00', THU_AFTERNOON))
      .toEqual({ label: 'Tonight', tone: 'tonight' });
  });

  it('next London day -> Tomorrow', () => {
    expect(raffleDayLabel('2026-06-12 19:30:00+00', THU_AFTERNOON))
      .toEqual({ label: 'Tomorrow', tone: 'tomorrow' });
  });

  it('later date -> full weekday + day + short month (house style: Monday, not Mon)', () => {
    expect(raffleDayLabel('2026-06-15T19:30:00+00:00', THU_AFTERNOON))
      .toEqual({ label: 'Monday 15 Jun', tone: 'day' });
  });

  it('BST midnight edge: after London midnight, the 12th IS tonight (not tomorrow)', () => {
    expect(raffleDayLabel('2026-06-12 19:30:00+00', BST_MIDNIGHT_EDGE))
      .toEqual({ label: 'Tonight', tone: 'tonight' });
  });

  it('BST midnight edge: the 13th is tomorrow', () => {
    expect(raffleDayLabel('2026-06-13 19:00:00+00', BST_MIDNIGHT_EDGE))
      .toEqual({ label: 'Tomorrow', tone: 'tomorrow' });
  });

  it('past date degrades to its weekday (open-raffle filter makes this unreachable anyway)', () => {
    expect(raffleDayLabel('2026-06-11 23:45:00+00', BST_MIDNIGHT_EDGE))
      .toEqual({ label: 'Thursday 11 Jun', tone: 'day' });
  });

  it('accepts date-only strings', () => {
    expect(raffleDayLabel('2026-06-20', THU_AFTERNOON))
      .toEqual({ label: 'Saturday 20 Jun', tone: 'day' });
  });

  it('null / undefined / garbage -> null', () => {
    expect(raffleDayLabel(null, THU_AFTERNOON)).toBeNull();
    expect(raffleDayLabel(undefined, THU_AFTERNOON)).toBeNull();
    expect(raffleDayLabel('not-a-date', THU_AFTERNOON)).toBeNull();
    expect(raffleDayLabel('', THU_AFTERNOON)).toBeNull();
  });
});
