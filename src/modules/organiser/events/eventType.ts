// What an event IS (G2): the three types an organiser picks when creating one, and
// how a stored category reads on the event page. Owners may write the categories
// party, class and workshop (apply_aggregate_write_p5); a course FORMAT is
// admin-only (a non-admin create is forced to one_off or recurring), so 'Course or
// workshop' is category workshop. Pure.

export type NewEventType = 'class' | 'party' | 'workshop';

export const EVENT_TYPES: Array<{ type: NewEventType; label: string; hint: string }> = [
  { type: 'class', label: 'Class', hint: 'Same day every week. The first 8 weeks are listed for you.' },
  { type: 'party', label: 'Party', hint: 'Starts as one date. Make it weekly later from Repeats.' },
  { type: 'workshop', label: 'Course or workshop', hint: 'Starts as one date. Make it weekly later from Repeats.' },
];

/** event_series_p5.category each type writes. */
export const TYPE_CATEGORY: Record<NewEventType, string> = { class: 'class', party: 'party', workshop: 'workshop' };

/** default_duration_minutes a create sends (G4; the server takes 1-1200). */
export const DEFAULT_DURATION_MINUTES: Record<NewEventType, number> = { class: 120, party: 300, workshop: 120 };

const CATEGORY_LABEL: Record<string, string> = {
  class: 'Class', party: 'Party', workshop: 'Course or workshop', masterclass: 'Masterclass', festival: 'Festival',
};

/** The type as the event page shows it ('Not set' when the series has none). */
export const categoryLabel = (category: string | null | undefined): string =>
  !category ? 'Not set' : CATEGORY_LABEL[category] ?? category.charAt(0).toUpperCase() + category.slice(1);
