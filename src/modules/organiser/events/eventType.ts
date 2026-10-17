// The two formats an organiser can create in R1 (R3-1: a course or a festival is
// never creatable here), and how a series' type reads. Category is derived from
// the sessions (src/lib/eventCategory.ts and its SQL twin), so nobody is asked
// what an event IS. The Type row reads the stored mirror through the shared
// label (one mapping, never a copy). Existing course/festival series stay
// editable through the other flows; they only get read-only labels. Pure.
import { wordForStored } from '@/lib/eventCategory';

export type CreatableFormat = 'recurring' | 'one_off';

export const CREATABLE_FORMATS: Array<{ format: CreatableFormat; label: string }> = [
  { format: 'recurring', label: 'Weekly night' },
  { format: 'one_off', label: 'One night' },
];

/** Read-only labels for every format a series can carry (course and festival are never created here). */
export const FORMAT_LABELS: Record<string, string> = {
  recurring: 'Weekly night', one_off: 'One night', course: 'Course', festival: 'Festival',
};

/**
 * What the editor knows that decides which controls the Type row may point at.
 * The Type row's VALUE is categoryLabelFor from the lib, called directly (one
 * mapping, no alias).
 */
export interface TypeRowState {
  /** Ended / archived: shown, never edited, so no session can be changed. */
  locked: boolean;
  /**
   * At least one upcoming date that is NOT cancelled: the programme writer refuses a
   * past date and a cancelled date (date_cancelled), so a series whose every upcoming
   * date is cancelled has no date to put a session on.
   */
  hasUpcoming: boolean;
  /**
   * Upcoming dates exist but every one is cancelled (hasUpcoming wins over it). When
   * lists them, and each opens the date, whose "Put this date back on" un-cancels it.
   */
  cancelledOnly: boolean;
  /**
   * At least one upcoming listed date carries a session: the review card's fact (reviewModel
   * sessionDates > 0, one mapping), so the row and the card never disagree (FIX-6 F-b, F-c).
   * When nothing can be edited (locked, or no upcoming date) the same mapping over EVERY
   * listed date (FIX-7 R3).
   */
  hasSession: boolean;
}

/** The fact the Schedule card and the Type row both state for a cancelled-only series (one constant). */
export const EVERY_UPCOMING_CANCELLED = 'Every upcoming date is cancelled';

/**
 * What sets the type, under the Type row. Never names a control that is not on
 * the page: a locked series has no session to change, a series with no upcoming
 * date that can take a session has no date to put one on (the When group below
 * says how to list one, or lists the cancelled dates to put back on). The
 * editable sentence promises nothing: the derivation is the union over the
 * series programme and every date, keep-if-agrees, so changing one date's
 * sessions need not move the word (review B F3, decision d22).
 */
export function typeSublabel(format: string | null | undefined, category: string | null | undefined, state: TypeRowState): string {
  if (format === 'festival' || format === 'course') return 'Set by its format.';
  const canEdit = !state.locked && state.hasUpcoming;
  if (wordForStored(format, category)) {
    // Not editable (FIX-7 R3): hasSession is then over every listed date. With none, never claim the
    // sessions set it; unlocked with no upcoming date, the no-date sentences below name the step.
    if (!canEdit && state.hasSession) return 'Set by its sessions.';
    if (state.locked) return 'No session on its dates.';
    if (!canEdit) return noDateSentence(state);
    // A legacy draft keeps a stored category with no session (the review card says add one).
    return state.hasSession ? 'Set by its sessions across all its dates.' : 'No session yet. Add one to one of its dates and it is set from it.';
  }
  if (state.locked) return 'No session, so not set.';
  // A session that sets no type (a performance) is still a session: never ask for "a session".
  if (state.hasUpcoming) return state.hasSession ? 'Its sessions set no type yet. Add a class or a party to one of its dates and it is set for you.' : 'Add a session to one of its dates and it is set for you.';
  return noDateSentence(state);
}

/** No upcoming date can take a session: name the step When offers (list one, or put one back on). */
function noDateSentence(state: TypeRowState): string {
  return state.cancelledOnly
    ? `${EVERY_UPCOMING_CANCELLED}. Open one under When and put it back on, then add a session and it is set for you.`
    : 'Add a session once a date is listed under When, and it is set for you.';
}
