import { describe, expect, it } from 'vitest';
import { asWallClock } from '@/lib/time/wallClock';
import type { EventPageSnapshotOccurrence } from '@/modules/event-page/types';
import { courseLadderModel } from '@/modules/event-page/bento/blocks/courseLadderModel';

// WeeksLadderBlock and this model had NO tests at all before P4, and every rule
// here is a pure function over the occurrences array, so the whole surface is
// reachable without a renderer.
//
// Both directions on every rule, per the guards law: a cancelled night must
// lose its number AND drop the count, and an ordinary course must NOT have
// either happen to it. The count-mismatch flag gets the same treatment -- the
// expensive failure is a flag that is always on, not one that never fires.

let seq = 0;
const occ = (
  over: Partial<EventPageSnapshotOccurrence> = {},
): EventPageSnapshotOccurrence => ({
  occurrenceId: `occ-${(seq += 1)}`,
  startsAt: asWallClock('2026-09-01T19:00:00'),
  endsAt: asWallClock('2026-09-01T20:30:00'),
  localDate: asWallClock('2026-09-01T00:00:00'),
  timezone: 'Europe/London',
  isCancelled: false,
  cancellationReasonLabel: null,
  isLive: false,
  isPast: false,
  isUpcoming: true,
  lineup: { teachers: [], djs: [], dancers: [], vendors: [], videographers: [] },
  ...over,
});

const weeks = (m: ReturnType<typeof courseLadderModel>) => m.rows.map((r) => r.weekNumber);

describe('courseLadderModel', () => {
  it('numbers a clean four-week course 1..4 and counts four', () => {
    const m = courseLadderModel([occ(), occ(), occ(), occ()]);
    expect(weeks(m)).toEqual([1, 2, 3, 4]);
    expect(m.weekCount).toBe(4);
    expect(m.finished).toBe(false);
  });

  it('pulses the first session that is neither past nor cancelled', () => {
    const m = courseLadderModel([
      occ({ isPast: true }),
      occ({ isPast: true }),
      occ(),
      occ(),
    ]);
    expect(m.rows.map((r) => r.isNext)).toEqual([false, false, true, false]);
  });

  // The defect P4 exists to fix.
  it('leaves a cancelled week UNNUMBERED and does not count it', () => {
    const m = courseLadderModel([occ(), occ({ isCancelled: true }), occ(), occ()]);
    expect(weeks(m)).toEqual([1, null, 2, 3]);
    expect(m.weekCount).toBe(3);
  });

  it('does not let a cancelled night take the next-session pulse', () => {
    const m = courseLadderModel([occ({ isPast: true }), occ({ isCancelled: true }), occ()]);
    expect(m.rows.map((r) => r.isNext)).toEqual([false, false, true]);
  });

  it('renumbers every later week, not just the one after the cancellation', () => {
    const m = courseLadderModel([
      occ(),
      occ({ isCancelled: true }),
      occ({ isCancelled: true }),
      occ(),
      occ(),
    ]);
    expect(weeks(m)).toEqual([1, null, null, 2, 3]);
    expect(m.weekCount).toBe(2 + 1);
  });

  it('finishes when every session is past', () => {
    const m = courseLadderModel([occ({ isPast: true }), occ({ isPast: true })]);
    expect(m.finished).toBe(true);
    expect(m.rows.every((r) => !r.isNext)).toBe(true);
    // Past is not cancelled: a finished course still reports the weeks it ran.
    expect(m.weekCount).toBe(2);
    expect(weeks(m)).toEqual([1, 2]);
  });

  it('finishes when the only sessions left are cancelled', () => {
    const m = courseLadderModel([occ({ isPast: true }), occ({ isCancelled: true })]);
    expect(m.finished).toBe(true);
    expect(m.weekCount).toBe(1);
  });

  it('handles a course whose every date was cancelled', () => {
    const m = courseLadderModel([occ({ isCancelled: true }), occ({ isCancelled: true })]);
    expect(weeks(m)).toEqual([null, null]);
    expect(m.weekCount).toBe(0);
    expect(m.finished).toBe(true);
  });

  it('handles a single occurrence (BentoPage hides the tile, the model still answers)', () => {
    const m = courseLadderModel([occ()]);
    expect(weeks(m)).toEqual([1]);
    expect(m.weekCount).toBe(1);
    expect(m.rows[0].isNext).toBe(true);
  });

  it('handles an empty occurrences array without throwing', () => {
    const m = courseLadderModel([]);
    expect(m.rows).toEqual([]);
    expect(m.weekCount).toBe(0);
    expect(m.finished).toBe(true);
    expect(m.hasCountMismatch).toBe(false);
  });

  it('carries the occurrence through untouched, so the renderer reads one object', () => {
    const a = occ();
    const m = courseLadderModel([a]);
    expect(m.rows[0].occurrence).toBe(a);
  });

  describe('declared total', () => {
    it('reports a mismatch when the course total disagrees with what is listed', () => {
      const m = courseLadderModel([occ(), occ({ isCancelled: true }), occ()], 4);
      expect(m.weekCount).toBe(2);
      expect(m.declaredTotalSessions).toBe(4);
      expect(m.hasCountMismatch).toBe(true);
    });

    it('reports NO mismatch when the total agrees', () => {
      const m = courseLadderModel([occ(), occ(), occ()], 3);
      expect(m.hasCountMismatch).toBe(false);
      expect(m.declaredTotalSessions).toBe(3);
    });

    // The flag must be off by default, or it is on for every course on the site.
    it('reports NO mismatch when no total is supplied', () => {
      expect(courseLadderModel([occ(), occ()]).hasCountMismatch).toBe(false);
      expect(courseLadderModel([occ(), occ()], null).hasCountMismatch).toBe(false);
      expect(courseLadderModel([occ(), occ()], undefined).hasCountMismatch).toBe(false);
    });

    it('ignores a non-finite total rather than reporting a mismatch against NaN', () => {
      const m = courseLadderModel([occ(), occ()], Number.NaN);
      expect(m.declaredTotalSessions).toBeNull();
      expect(m.hasCountMismatch).toBe(false);
    });
  });
});
