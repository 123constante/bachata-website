// The FORMAT an organiser picks when creating an event (W1), and how a series'
// type reads. Nobody is asked what an event IS (event-truth P1): category is
// derived from the sessions (src/lib/eventCategory.ts and its SQL twin), which
// the organiser adds on the draft, so the create asks only the format. The Type
// row reads the stored mirror through the shared label, the same word every
// other screen shows (one mapping, never a copy). A course or festival FORMAT
// stays admin-only (a non-admin create is forced to one_off or recurring): its
// card is shown, never selectable, and says why (d33). Pure.
import { wordForStored } from '@/lib/eventCategory';

/** The formats an organiser may create (OwnerFormat's members). */
export type NewEventFormat = 'one_off' | 'recurring';

/** Every card the New event page shows: the two it may create, then the two only the team sets up. */
export type FormatCardId = NewEventFormat | 'course' | 'festival';

/** Why a Course or Festival card cannot be chosen (d33), on the card itself. */
export const TEAM_SETS_UP = 'Ask the Bachata Calendar team to set this up.';

export type FormatCard =
  | { id: NewEventFormat; label: string; hint: string; disabledReason: null }
  | { id: 'course' | 'festival'; label: string; hint: null; disabledReason: string };

/** The four format cards, in the admin's order. A hint never names a disabled card. */
export const FORMAT_CARDS: FormatCard[] = [
  { id: 'one_off', label: 'One-off', hint: 'One date. You add its sessions on the event page next.', disabledReason: null },
  { id: 'recurring', label: 'Recurring', hint: 'Every week on the same day, from its first date. You add its sessions on the event page next.', disabledReason: null },
  { id: 'course', label: 'Course', hint: null, disabledReason: TEAM_SETS_UP },
  { id: 'festival', label: 'Festival', hint: null, disabledReason: TEAM_SETS_UP },
];

/** Whether a card is one an organiser can create (the type guard the cards and the hint read). */
export const isNewEventFormat = (id: FormatCardId): id is NewEventFormat => id === 'one_off' || id === 'recurring';

/** The cards an organiser can choose (the hint table's domain). */
export const SELECTABLE_FORMATS = FORMAT_CARDS.filter((c) => isNewEventFormat(c.id));

/** The hint before a card is picked: names only the cards that can be chosen. */
export const FORMAT_HINT = 'Choose One-off or Recurring. You add its sessions on the event page next.';

/**
 * The hint once the create is CONFIRMED (the event exists with this format), whatever
 * later step (its dates) runs or failed: the cards are locked, so this says why and
 * what to do next. Open the event is on screen from then on.
 */
export const FORMAT_LOCKED_HINT = 'Already chosen: your event is made with it. Press Create to finish, or open the event.';

/**
 * Where a create stands (FIX-3): 'open' nothing sent yet; 'sent' the create went out
 * but its reply never confirmed it (it may or may not exist, and every later press
 * sends the identical create); 'made' the create was confirmed.
 */
export type CreatePhase = 'open' | 'sent' | 'made';

/**
 * The one hint under the New event cards, per phase, whether a step is running, and whether
 * the organiser is blocked. Blocked disables Create, so no hint names it then (FIX-7 R2): the
 * confirmed hint keeps only its exit, the unconfirmed one only its fact (the note under the
 * block message names the way out).
 */
export function formatHint(phase: CreatePhase, busy: boolean, format: NewEventFormat | null, blocked = false): string {
  // Made but its dates still running (FIX-4 F9): Create is busy, so never "press Create".
  if (phase === 'made') {
    if (busy) return 'Finishing your event\u2026';
    return blocked ? 'Already chosen: your event is made with it. Open the event.' : FORMAT_LOCKED_HINT;
  }
  if (busy) return 'Creating your event\u2026';
  if (phase === 'sent') return blocked ? 'Not confirmed yet.' : 'Not confirmed yet. Press Create to finish: nothing is made twice.';
  return (format && SELECTABLE_FORMATS.find((c) => c.id === format)?.hint) || FORMAT_HINT;
}

/**
 * The hint box's fixed height, in lines of HINT_LINE_PX, so Create never moves as the hint
 * changes (FIX-4 F4). Measured in headless Chromium (13px text, html 13.57px): at 320 and 360px
 * wide the longest hint takes 3 lines, at 375 and 390px 2. HINT_CHARS_PER_LINE is a floor under
 * the measured line (at least 44 characters at 320px); a unit test holds every hint to the box.
 */
export const HINT_BOX_LINES = 3;
export const HINT_LINE_PX = 18;
export const HINT_CHARS_PER_LINE = 40;

/**
 * Under the block message when a create was sent, never confirmed, and the organiser is now
 * blocked (FIX-4 F5): Create is disabled and the form frozen, so the way out is the shell's back
 * link, named here as it reads on screen.
 */
export function unconfirmedExitNote(backLabel: string): string {
  return `If your event was saved it is in your Events list; use ${backLabel} at the top to leave.`;
}

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
