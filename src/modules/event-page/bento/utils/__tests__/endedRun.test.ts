import { describe, expect, it } from 'vitest';
import { formatLongDate, formatRunRange, runNoun } from '@/modules/event-page/bento/utils/endedRun';

// One owner for the noun, because two surfaces read it: the on-page record card
// and the og:description a WhatsApp share renders. A second copy would drift and
// the drift would only ever be visible in a share preview.
describe('runNoun', () => {
  it('names a course and a festival', () => {
    expect(runNoun('course', null)).toBe('course');
    expect(runNoun('festival', null)).toBe('festival');
  });

  it('defaults to the community word for everything else', () => {
    expect(runNoun('recurring', 'party')).toBe('night');
    expect(runNoun('one_off', null)).toBe('night');
    expect(runNoun(null, null)).toBe('night');
  });

  // format is null for legacy-only events; type is the fallback the rest of the
  // event-page module COALESCEs to.
  it('falls back to type when format is null', () => {
    expect(runNoun(null, 'course')).toBe('course');
    expect(runNoun(null, 'festival')).toBe('festival');
  });

  // A present-but-unrecognised format must NOT fall through to type: format is
  // the more specific fact, and reading past it would let a legacy type label
  // override the P5 shape.
  it('does not fall through to type when format is present', () => {
    expect(runNoun('recurring', 'festival')).toBe('night');
  });

  // THE COMMON PATH, and it was wrong. `format` is the STRUCTURAL shape and
  // `category` is the discovery GENRE, so a weekly bachata class is
  // format='recurring' -- and reading shape alone called it a "night". "This
  // night has finished and is no longer running." for a class, in the share
  // preview and on the record card both. Most of what this arc ends is recurring.
  it('names a class, workshop and masterclass from CATEGORY, not shape', () => {
    expect(runNoun('recurring', null, 'class')).toBe('class');
    expect(runNoun('recurring', null, 'workshop')).toBe('workshop');
    expect(runNoun('recurring', null, 'masterclass')).toBe('masterclass');
    expect(runNoun('one_off', null, 'class')).toBe('class');
  });

  it('keeps the community word for a party, whatever its shape', () => {
    expect(runNoun('recurring', null, 'party')).toBe('night');
    expect(runNoun('one_off', 'party', 'party')).toBe('night');
  });

  // Shape still outranks genre where the two disagree on a bounded run: a course
  // categorised 'class' is a course, which is the more specific English word.
  it('lets course and festival outrank category', () => {
    expect(runNoun('course', null, 'class')).toBe('course');
    expect(runNoun('festival', null, 'party')).toBe('festival');
  });

  // Legacy-only rows carry no category at all; the default must survive it.
  it('tolerates a missing category', () => {
    expect(runNoun('recurring', null)).toBe('night');
    expect(runNoun('recurring', null, null)).toBe('night');
    expect(runNoun('recurring', null, 'something-new')).toBe('night');
  });
});

describe('formatLongDate', () => {
  it('formats a date from its own parts', () => {
    expect(formatLongDate('2026-06-28')).toBe('28 June 2026');
  });

  it('does not shift across a BST boundary', () => {
    // The whole reason this file avoids Date/Intl: new Date('2026-03-29')
    // is UTC midnight, which in Europe/London can render as 28 March.
    expect(formatLongDate('2026-03-29')).toBe('29 March 2026');
    expect(formatLongDate('2026-10-25')).toBe('25 October 2026');
    expect(formatLongDate('2026-01-01')).toBe('1 January 2026');
    expect(formatLongDate('2026-12-31')).toBe('31 December 2026');
  });

  it('tolerates a full timestamp by taking the date half', () => {
    expect(formatLongDate('2026-06-28T13:00:00+00:00')).toBe('28 June 2026');
  });

  it('returns null rather than a wrong-but-plausible date', () => {
    expect(formatLongDate(null)).toBeNull();
    expect(formatLongDate(undefined)).toBeNull();
    expect(formatLongDate('')).toBeNull();
    expect(formatLongDate('28/06/2026')).toBeNull();
    expect(formatLongDate('2026-13-01')).toBeNull();
    expect(formatLongDate('2026-00-10')).toBeNull();
    expect(formatLongDate('2026-06-00')).toBeNull();
  });

  // A flat `d > 31` range check passed '2026-02-31' and printed "31 February
  // 2026" onto the tombstone and into the og:description -- the exact
  // wrong-but-plausible output the null-return above exists to prevent.
  it('rejects a day its month does not have', () => {
    expect(formatLongDate('2026-02-31')).toBeNull();
    expect(formatLongDate('2026-02-30')).toBeNull();
    expect(formatLongDate('2026-04-31')).toBeNull();
    expect(formatLongDate('2026-06-31')).toBeNull();
    expect(formatLongDate('2026-09-31')).toBeNull();
    expect(formatLongDate('2026-11-31')).toBeNull();
  });

  // Both directions: the guard must not reject a legitimate month end either.
  it('accepts every real month end', () => {
    expect(formatLongDate('2026-01-31')).toBe('31 January 2026');
    expect(formatLongDate('2026-04-30')).toBe('30 April 2026');
    expect(formatLongDate('2026-12-31')).toBe('31 December 2026');
  });

  // The leap rule is hand-rolled (this file builds no Date), so all three arms
  // of it get a case: /4, the /100 exception, and the /400 exception to that.
  it('applies the full leap rule to 29 February', () => {
    expect(formatLongDate('2024-02-29')).toBe('29 February 2024');
    expect(formatLongDate('2026-02-29')).toBeNull();
    expect(formatLongDate('1900-02-29')).toBeNull();
    expect(formatLongDate('2000-02-29')).toBe('29 February 2000');
    expect(formatLongDate('2024-02-30')).toBeNull();
  });
});

describe('formatRunRange', () => {
  it('sheds month and year when the run sits inside one month', () => {
    expect(formatRunRange('2026-06-07', '2026-06-28')).toEqual({
      kind: 'range', from: '7', to: '28 June 2026',
    });
  });

  it('keeps the month but sheds the year within one year', () => {
    expect(formatRunRange('2026-03-07', '2026-06-28')).toEqual({
      kind: 'range', from: '7 March', to: '28 June 2026',
    });
  });

  it('keeps both when the run spans years', () => {
    expect(formatRunRange('2024-03-07', '2026-06-28')).toEqual({
      kind: 'range', from: '7 March 2024', to: '28 June 2026',
    });
  });

  // The live branch before the P4a migration is applied: lifecycle says ended,
  // the payload carries no ended_on, and the page must render date-free copy.
  it('returns null without an authoritative end date', () => {
    expect(formatRunRange('2026-06-07', null)).toBeNull();
    expect(formatRunRange(null, null)).toBeNull();
  });

  it('falls back to the end alone when the start is missing', () => {
    expect(formatRunRange(null, '2026-06-28')).toEqual({ kind: 'single', to: '28 June 2026' });
  });

  it('collapses a single-night run', () => {
    expect(formatRunRange('2026-06-28', '2026-06-28')).toEqual({
      kind: 'single', to: '28 June 2026',
    });
  });

  // ended_on is authoritative; the earliest occurrence is not. If they disagree
  // the page must not print a backwards range like "28 June - 7 June".
  it('never renders a backwards range', () => {
    expect(formatRunRange('2026-06-28', '2026-06-07')).toEqual({
      kind: 'single', to: '7 June 2026',
    });
    expect(formatRunRange('2027-01-01', '2026-06-07')).toEqual({
      kind: 'single', to: '7 June 2026',
    });
  });

  it('ignores an unparseable start rather than dropping the end', () => {
    expect(formatRunRange('not-a-date', '2026-06-28')).toEqual({
      kind: 'single', to: '28 June 2026',
    });
  });
});
