// The two formats an organiser can create in R1 (R3-1: a course or a festival is
// never creatable here), and how a series' format reads. Category is derived from
// the sessions (src/lib/eventCategory.ts and its SQL twin), so nobody is asked
// what an event IS, and the organiser editor shows no Type row (owner decision
// d39): the sessions say what it is. Existing course/festival series stay
// editable through the other flows; they only get read-only labels. Pure.

export type CreatableFormat = 'recurring' | 'one_off';

export const CREATABLE_FORMATS: Array<{ format: CreatableFormat; label: string }> = [
  { format: 'recurring', label: 'Weekly night' },
  { format: 'one_off', label: 'One night' },
];

/** Read-only labels for every format a series can carry (course and festival are never created here). */
export const FORMAT_LABELS: Record<string, string> = {
  recurring: 'Weekly night', one_off: 'One night', course: 'Course', festival: 'Festival',
};

/** The fact the Schedule card states for a cancelled-only series (one constant). */
export const EVERY_UPCOMING_CANCELLED = 'Every upcoming date is cancelled';
