// The organiser area's pinned sentences (plan 4.3 #9). D28 allows a sentence
// only at a costly action; each lives here once, and shared/__tests__/copy.test.ts
// counts the screens that import it (exactly ONE each once its flow lands).

/** Cancel confirm only (D31, D40): the one date warning line. */
export const WARN_DATE = 'Only this date changes. Dancers see it at once.';

/** End confirm only (R3-8, C42c): an ended event is admin-only to leave. */
export const WARN_END = 'Only Ricky can reopen an ended event.';

/** A write refused with version_conflict (R3-7): someone else saved first. */
export const VERSION_CONFLICT = 'Someone changed this first. Check it.';

/**
 * A rule date taken off (series.skip_date): ONE name on Change "what", its
 * confirm and the date page (INT3; it was "Break this week" on the date page).
 */
export const TAKE_OFF = {
  label: 'Take this date off',
  sub: 'Skip it. No cancellation shows.',
  confirm: 'Take it off',
  done: (day: string) => `${day} is taken off`,
} as const;

/** Hand-over confirm only (D14 verbatim; D40: this sentence IS that screen's warning). */
export const handOverWarning = (pageName: string, toName: string): string =>
  `Hand ${pageName} over to ${toName}? You become a Manager: you can still edit events but no longer hand the page over or remove people. ${toName} can hand it back.`;
