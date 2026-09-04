import { describe, expect, it } from 'vitest';
import {
  computeHeroDayStatus,
  type CancellationState,
  type HeroDayStatusInput,
} from '../festivalHeroDayStatus';

const base = (over: Partial<HeroDayStatusInput> = {}): HeroDayStatusInput => ({
  startKey: '2026-08-10',
  endKey: '2026-08-12',
  todayKey: '2026-08-08',
  isCancelled: false,
  cancellationState: 'known',
  ...over,
});

const ALL_STATES: CancellationState[] = ['known', 'pending', 'unknowable'];

describe('computeHeroDayStatus — pre-start labels', () => {
  it('says "Tomorrow" the day before, never "In 1 days"', () => {
    expect(computeHeroDayStatus(base({ todayKey: '2026-08-09' }))).toEqual({ label: 'Tomorrow' });
  });

  it('counts plural days out', () => {
    expect(computeHeroDayStatus(base({ todayKey: '2026-08-08' }))).toEqual({ label: 'In 2 days' });
  });

  it('says "Today" on the start day', () => {
    expect(computeHeroDayStatus(base({ todayKey: '2026-08-10' }))).toEqual({ label: 'Today' });
  });
});

describe('computeHeroDayStatus — the live window', () => {
  it('says "Happening now" mid-run', () => {
    expect(computeHeroDayStatus(base({ todayKey: '2026-08-11' }))).toEqual({ label: 'Happening now' });
  });

  it('goes silent after the end', () => {
    expect(computeHeroDayStatus(base({ todayKey: '2026-08-13' }))).toBeNull();
  });

  it('does not pin "Happening now" on an absurd far-future end date', () => {
    // >30 days past the start, so the clamp must win however wrong endKey is.
    expect(
      computeHeroDayStatus(base({ startKey: '2026-01-01', endKey: '2099-01-01', todayKey: '2026-08-11' })),
    ).toBeNull();
  });
});

describe('computeHeroDayStatus — cancellation', () => {
  it('makes NO timing claim for a cancelled festival, in any state', () => {
    for (const cancellationState of ALL_STATES) {
      expect(
        computeHeroDayStatus(base({ isCancelled: true, todayKey: '2026-08-11', cancellationState })),
      ).toBeNull();
    }
  });

  it('stays silent entirely while the fact is still PENDING', () => {
    // Regression: the detail query resolves before the snapshot query, and
    // answering in that window flashed "Happening now" at a cancelled festival.
    for (const todayKey of ['2026-08-08', '2026-08-09', '2026-08-10', '2026-08-11']) {
      expect(computeHeroDayStatus(base({ todayKey, cancellationState: 'pending' }))).toBeNull();
    }
  });

  it('UNKNOWABLE still renders pre-start labels — a blank hero was the bug', () => {
    // Regression: `snapshotPayload !== undefined` was success-only, so a query that
    // failed deterministically pinned the guard shut and blanked the hero forever on
    // a perfectly healthy festival.
    expect(
      computeHeroDayStatus(base({ todayKey: '2026-08-09', cancellationState: 'unknowable' })),
    ).toEqual({ label: 'Tomorrow' });
    expect(
      computeHeroDayStatus(base({ todayKey: '2026-08-10', cancellationState: 'unknowable' })),
    ).toEqual({ label: 'Today' });
  });

  it('UNKNOWABLE never says "Happening now" — that is the dangerous claim', () => {
    // A failed snapshot makes a CANCELLED festival indistinguishable from a healthy
    // one (isCancelled is false only because no data arrived), and no banner renders
    // to contradict it. Pre-start dates are safe; "running right now" is not.
    expect(
      computeHeroDayStatus(base({ todayKey: '2026-08-11', cancellationState: 'unknowable' })),
    ).toBeNull();
  });

  it('the live window is reachable ONLY when cancellation is known', () => {
    const live = { todayKey: '2026-08-11' };
    expect(computeHeroDayStatus(base({ ...live, cancellationState: 'known' }))).toEqual({
      label: 'Happening now',
    });
    expect(computeHeroDayStatus(base({ ...live, cancellationState: 'pending' }))).toBeNull();
    expect(computeHeroDayStatus(base({ ...live, cancellationState: 'unknowable' }))).toBeNull();
  });
});

describe('computeHeroDayStatus — malformed input', () => {
  it('returns null on a missing start key', () => {
    for (const startKey of [null, undefined, '']) {
      expect(computeHeroDayStatus(base({ startKey }))).toBeNull();
    }
  });

  it('returns null on a missing today key', () => {
    for (const todayKey of [null, undefined, '']) {
      expect(computeHeroDayStatus(base({ todayKey }))).toBeNull();
    }
  });

  it('rejects a MALFORMED key rather than sorting it lexicographically', () => {
    // A degraded-Intl runtime yields '2026-13-45': truthy, so a bare falsy check
    // would let it through into the date maths.
    expect(computeHeroDayStatus(base({ todayKey: '2026-13-45' }))).toBeNull();
    expect(computeHeroDayStatus(base({ startKey: '2026-13-45' }))).toBeNull();
  });

  it('survives an absent end key (single-day festival)', () => {
    expect(
      computeHeroDayStatus(base({ startKey: '2026-08-10', endKey: null, todayKey: '2026-08-10' })),
    ).toEqual({ label: 'Today' });
  });
});

describe('computeHeroDayStatus -- an ended series (arc W14)', () => {
  // The observed defect: a festival whose run has ended but whose PROGRAMME days
  // still read forward. The keys here come from get_public_festival_detail_v2's
  // span, built by _p5_festival_span_v1 off event_series_program_day_p5 -- and
  // the arc's P5a constraint trigger governs occurrences, not programme days, so
  // nothing in the database stops this pairing. Without the guard the hero prints
  // "In 2 days" directly above a record card that says the festival has finished.
  it('makes no timing claim when the programme still reads forward', () => {
    expect(computeHeroDayStatus(base({ isEnded: true }))).toBeNull();
  });

  it('makes none on the start day either', () => {
    expect(computeHeroDayStatus(base({ todayKey: '2026-08-10', isEnded: true }))).toBeNull();
  });

  // The loudest one: "Happening now" over a finished run.
  it('never says "Happening now" for a run that has ended', () => {
    expect(computeHeroDayStatus(base({ todayKey: '2026-08-11', isEnded: true }))).toBeNull();
  });

  it('is silent in every cancellation state, since it never reaches that logic', () => {
    for (const cancellationState of ALL_STATES) {
      expect(computeHeroDayStatus(base({ isEnded: true, cancellationState }))).toBeNull();
    }
  });

  // The other direction, and the half a "returns null" test cannot prove on its
  // own: the guard must not have swallowed the ordinary case. Omitting isEnded
  // entirely is how every caller that predates W14 still calls this.
  it('leaves a live festival exactly as it was -- the flag defaults to false', () => {
    expect(computeHeroDayStatus(base({ isEnded: false }))).toEqual({ label: 'In 2 days' });
    expect(computeHeroDayStatus(base())).toEqual({ label: 'In 2 days' });
    expect(computeHeroDayStatus(base({ todayKey: '2026-08-11' }))).toEqual({ label: 'Happening now' });
  });
});
