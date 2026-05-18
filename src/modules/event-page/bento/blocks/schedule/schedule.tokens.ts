// Bundle F.2.a — schedule renderer design tokens.
//
// Phase 1 (PeopleStack primitive) and Phase 2 (this file) of the schedule
// renderer unification plan. Both ScheduleBlock and FestivalProgramSection
// consume these tokens so that any future density tweak is a one-file
// change, not a sweep across two ~400-line renderers.
//
// Pure constants — no runtime cost, no side effects. Safe to import from
// any layer.

export const SCHEDULE_TOKENS = {
  /** Avatar pixel sizes by tier. Used by PeopleStack variants and the bespoke
   *  FestivalProgramSection ArtistLink fallback (until F.2.c folds it through
   *  PersonChip). */
  avatar: {
    sm: 28,
    md: 32,
    lg: 52,
    xl: 64,
  },
  /** Spacing knobs. `tight` is for inside-cell flex gaps; `row` is between
   *  session rows; `section` is between distinct day or kind sections. */
  gap: {
    tight: 6,
    row: 14,
    section: 16,
  },
  /** Time-axis column width on grid renders. */
  timeCol: {
    width: 64,
  },
  /** Typography sizes (px). `time` is the row's start–end label; `duration`
   *  is the small-caps duration tag; `pill` is the level chip; `name` is
   *  the session title. */
  text: {
    time: 12,
    duration: 9,
    pill: 9,
    name: 14,
  },
} as const;

export type ScheduleTokens = typeof SCHEDULE_TOKENS;
