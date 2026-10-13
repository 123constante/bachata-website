// The first session an organiser picks when creating an event (G2), and how a
// series' type reads. Nobody is asked what an event IS any more (event-truth
// P1): category is derived from the sessions (src/lib/eventCategory.ts and its
// SQL twin), so a chip here only seeds the first session on the first date and
// sets the schedule a create starts with. The Type row reads the stored mirror
// through the shared label, the same word every other screen shows (one mapping,
// never a copy). A course FORMAT stays admin-only (a
// non-admin create is forced to one_off or recurring). Pure.
import { categoryLabelFor, wordForStored } from '@/lib/eventCategory';

export type NewEventType = 'class' | 'party' | 'workshop';

export const EVENT_TYPES: Array<{ type: NewEventType; label: string; hint: string }> = [
  { type: 'class', label: 'Class', hint: 'Same day every week. The first 8 weeks are listed, with a class on the first date. Add more sessions after.' },
  { type: 'party', label: 'Party', hint: 'One date with a party session. Make it weekly later from Repeats. Add more sessions after.' },
  { type: 'workshop', label: 'Workshop', hint: 'One date with a workshop session (listed under Classes). Add more sessions after.' },
];

/** The hint before a chip is picked. */
export const FIRST_SESSION_HINT = 'Choose one. It becomes the first session; you can add more after.';

/**
 * The hint once the event exists but a later step (its dates, its first session)
 * failed: the chips are locked, so this says why and what to do next.
 */
export const CHIPS_LOCKED_HINT = 'Already chosen: your event is made with it. Press Create to finish, or open the event.';

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

/** The type as every organiser screen shows it ('Not set' when the series has no session yet). */
export const categoryLabel = (format: string | null | undefined, category: string | null | undefined): string =>
  categoryLabelFor(format, category);

/** What the editor knows that decides which controls the Type row may point at. */
export interface TypeRowState {
  /** Ended / archived: shown, never edited, so no session can be changed. */
  locked: boolean;
  /** At least one upcoming date (a past date's sessions cannot be edited). */
  hasUpcoming: boolean;
}

/**
 * What sets the type, under the Type row. Never names a control that is not on
 * the page: a locked series has no session to change, a series with no upcoming
 * date has no date to put a session on (the When group below says how to list one).
 */
export function typeSublabel(format: string | null | undefined, category: string | null | undefined, state: TypeRowState): string {
  if (format === 'festival' || format === 'course') return 'Set by its format.';
  const canEdit = !state.locked && state.hasUpcoming;
  if (wordForStored(format, category)) {
    return canEdit ? 'Set by its sessions. Change the sessions on a date and it follows.' : 'Set by its sessions.';
  }
  if (state.locked) return 'No session, so not set.';
  return state.hasUpcoming
    ? 'Add a session to one of its dates and it is set for you.'
    : 'Add a session once a date is listed under When, and it is set for you.';
}
