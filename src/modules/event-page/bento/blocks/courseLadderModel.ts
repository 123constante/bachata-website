import type { EventPageSnapshotOccurrence } from '@/modules/event-page/types';

// The course ladder's arithmetic, extracted from WeeksLadderBlock so it can be
// tested without a renderer. The block previously derived all of this inline
// from the array index, which produced two wrong answers whenever a session was
// cancelled:
//
//   * `weekCount = occurrences.length` counted cancelled nights, so a 4-date
//     course with week 2 called off still advertised "4-week progressive
//     course" while listing only three nights anyone can attend.
//   * `i + 1` numbered the cancelled night "Week 2" and pushed the real second
//     week to "Week 3", so the numbering disagreed with the course itself from
//     the cancellation onwards.
//
// A cancelled night is therefore UNNUMBERED and does not count. Numbering runs
// over the sessions that are actually happening, in the order the snapshot RPC
// already sorted them.
//
// Derives everything from the occurrences array alone -- no contract change.
// `courseTotalSessions` is accepted because the intended total is a property of
// the COURSE, not of the dates materialised for it, and the two can legitimately
// disagree (a break week, a date not yet published). Nothing supplies it today,
// so it is optional and the headline always reports what is actually listed;
// the mismatch is reported rather than resolved, because guessing which side is
// right is what would put a wrong number back on the page.

export type CourseLadderRow = {
  occurrence: EventPageSnapshotOccurrence;
  /** 1-based position among the sessions that are going ahead; null when cancelled. */
  weekNumber: number | null;
  /** The one session that pulses: the first that is neither past nor cancelled. */
  isNext: boolean;
  isPast: boolean;
  isCancelled: boolean;
};

export type CourseLadderModel = {
  rows: CourseLadderRow[];
  /** Sessions going ahead. Excludes cancelled nights; this is the number shown. */
  weekCount: number;
  /** No session remains that is neither past nor cancelled. */
  finished: boolean;
  /** As passed in; null when the caller has no course-level total. */
  declaredTotalSessions: number | null;
  /** True only when a total was supplied AND it disagrees with weekCount. */
  hasCountMismatch: boolean;
};

export function courseLadderModel(
  occurrences: EventPageSnapshotOccurrence[],
  courseTotalSessions?: number | null,
): CourseLadderModel {
  // Read once. `findIndex` over the same predicate would drift from the loop
  // the moment either definition changed.
  let running = 0;
  let nextIdx = -1;

  const rows: CourseLadderRow[] = occurrences.map((occurrence, i) => {
    const isCancelled = occurrence.isCancelled;
    const isPast = occurrence.isPast;
    const goingAhead = !isCancelled;
    if (goingAhead) running += 1;
    if (nextIdx === -1 && !isPast && !isCancelled) nextIdx = i;

    return {
      occurrence,
      weekNumber: goingAhead ? running : null,
      isNext: false,
      isPast,
      isCancelled,
    };
  });

  if (nextIdx !== -1) rows[nextIdx].isNext = true;

  const weekCount = running;
  const declaredTotalSessions =
    typeof courseTotalSessions === 'number' && Number.isFinite(courseTotalSessions)
      ? courseTotalSessions
      : null;

  return {
    rows,
    weekCount,
    finished: nextIdx === -1,
    declaredTotalSessions,
    hasCountMismatch: declaredTotalSessions !== null && declaredTotalSessions !== weekCount,
  };
}
