/**
 * People arc S3: the gig time facts over every stored shape the timeline RPC returns (a London
 * wall clock stamped +00, PostgREST "T" or " " separator, midnight on the dot, garbage, null).
 * The day is the one written: a zone conversion would move a 23:30 BST gig to the next day.
 */
import { describe, expect, it } from 'vitest';
import { dateLabel, dayNumber, gigDateLabel, monthLabel, timeLabel, wallDayOf } from '../facts';

const CASES: [raw: string | null | undefined, day: string | null, num: string | null, time: string | null, month: string | null, label: string | null][] = [
  ['2026-10-23T22:00:00+00:00', '2026-10-23', '23', '22:00', 'October 2026', 'Friday 23 October'],
  ['2026-10-23 23:30:00+00', '2026-10-23', '23', '23:30', 'October 2026', 'Friday 23 October'],
  ['2026-12-31 21:30:00+00', '2026-12-31', '31', '21:30', 'December 2026', 'Thursday 31 December'],
  ['2026-11-01T00:30:00+00:00', '2026-11-01', '1', '00:30', 'November 2026', 'Sunday 1 November'],
  ['2026-11-07T00:00:00+00:00', '2026-11-07', '7', null, 'November 2026', 'Saturday 7 November'],
  ['2026-09-05', '2026-09-05', '5', null, 'September 2026', 'Saturday 5 September'],
  ['2026-02-30 20:00:00+00', null, null, null, null, null],
  ['not a date', null, null, null, null, null],
  ['', null, null, null, null, null],
  [null, null, null, null, null, null],
  [undefined, null, null, null, null, null],
];

describe.each(CASES)('%s', (raw, day, num, time, month, label) => {
  it('wallDayOf / dayNumber / timeLabel / monthLabel / gigDateLabel', () => {
    expect(wallDayOf(raw)).toBe(day);
    expect(dayNumber(raw)).toBe(num);
    expect(timeLabel(raw)).toBe(time);
    expect(monthLabel(raw)).toBe(month);
    expect(gigDateLabel(raw)).toBe(label);
  });
});

it('gigDateLabel is dateLabel of the written day (one date format, no second copy)', () => {
  expect(gigDateLabel('2026-10-23 23:30:00+00')).toBe(dateLabel('2026-10-23'));
});
