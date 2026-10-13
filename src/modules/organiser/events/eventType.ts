// The first session an organiser picks when creating an event (G2), and how a
// series' type reads. Nobody is asked what an event IS any more (event-truth
// P1): category is derived from the sessions (src/lib/eventCategory.ts and its
// SQL twin), so a chip here only seeds the first session on the first date and
// sets the schedule a create starts with. The Type row reads the stored mirror
// through the shared label, the same word every other screen shows (one mapping,
// never a copy). A course FORMAT stays admin-only (a
// non-admin create is forced to one_off or recurring). Pure.
import { wordForStored } from '@/lib/eventCategory';

export type NewEventType = 'class' | 'party' | 'workshop';

export const EVENT_TYPES: Array<{ type: NewEventType; label: string; hint: string }> = [
  { type: 'class', label: 'Class', hint: 'Same day every week. The first 8 weeks are listed, with a class on the first date. Add more sessions after.' },
  { type: 'party', label: 'Party', hint: 'One date with a party session. Make it weekly later from Repeats. Add more sessions after.' },
  { type: 'workshop', label: 'Workshop', hint: 'One date with a workshop session (listed under Classes). Add more sessions after.' },
];

/** The hint before a chip is picked. */
export const FIRST_SESSION_HINT = 'Choose one. It becomes the first session; you can add more after.';

/**
 * The hint once the create is CONFIRMED (the event exists with this chip), whatever
 * later step (its dates, its first session) runs or failed: the chips are locked, so
 * this says why and what to do next. Open the event is on screen from then on.
 */
export const CHIPS_LOCKED_HINT = 'Already chosen: your event is made with it. Press Create to finish, or open the event.';

/**
 * Where a create stands (FIX-3): 'open' nothing sent yet; 'sent' the create went out
 * but its reply never confirmed it (it may or may not exist, and every later press
 * sends the identical create); 'made' the create was confirmed.
 */
export type CreatePhase = 'open' | 'sent' | 'made';

/** The one hint under the New event chips, per phase and whether a step is running. */
export function chipHint(phase: CreatePhase, busy: boolean, type: NewEventType | null): string {
  if (phase === 'made') return CHIPS_LOCKED_HINT;
  if (busy) return 'Creating your event\u2026';
  if (phase === 'sent') return 'Not confirmed yet. Press Create to finish: nothing is made twice.';
  return (type && EVENT_TYPES.find((t) => t.type === type)?.hint) || FIRST_SESSION_HINT;
}

/**
 * The one session a create seeds on the first date (organiser_set_occurrence_programme_v1
 * takes type class | masterclass | party | performance, so a workshop is a class session
 * titled Workshop). Times are the create's start time plus its default length.
 */
export const SEED_SESSION: Record<NewEventType, { type: 'class' | 'party'; title: string }> = {
  class: { type: 'class', title: 'Class' },
  party: { type: 'party', title: 'Party' },
  workshop: { type: 'class', title: 'Workshop' },
};

/** default_duration_minutes a create sends (G4; the server takes 1-1200), and the seeded session's length. */
export const DEFAULT_DURATION_MINUTES: Record<NewEventType, number> = { class: 120, party: 300, workshop: 120 };

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
    return canEdit ? 'Set by its sessions across all its dates.' : 'Set by its sessions.';
  }
  if (state.locked) return 'No session, so not set.';
  if (state.hasUpcoming) return 'Add a session to one of its dates and it is set for you.';
  return state.cancelledOnly
    ? `${EVERY_UPCOMING_CANCELLED}. Open one under When and put it back on, then add a session and it is set for you.`
    : 'Add a session once a date is listed under When, and it is set for you.';
}
