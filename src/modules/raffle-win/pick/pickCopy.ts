// Pick screen copy (layout A). Refusal lines come from W1's LOCK_LINES so the two never drift.
import { LOCK_LINES } from '../model';

export const PICK_TITLE = 'Pick your night';
export const PICK_INTRO = 'Once you lock a night, only the organiser can change it.';
export const SEARCH_LABEL = 'Search event or venue';
export const SEARCH_EMPTY = 'No event or venue matches.';
export const SEARCH_CLEAR = 'Clear search';
export const DATES_HEAD = 'Which date?';
export const DATES_HEAD_ONE = 'One date only';
export const DOCK_IDLE = 'Tap an event, then choose a date';
export const LOCK_LABEL = 'Lock this night';
export const FALLBACK_TITLE = 'Bachata night';

export type PickRefusal = 'spot_taken' | 'already_been_to_event' | 'night_not_open' | 'honesty_required';

/** Refusals that show a banner. already_been_to_event is silent: the event is just removed. */
export type ShownRefusal = Exclude<PickRefusal, 'already_been_to_event'>;

export const REFUSAL_LINES: Record<ShownRefusal, string> = {
  spot_taken: LOCK_LINES.spot_taken,
  night_not_open: LOCK_LINES.night_not_open,
  honesty_required: LOCK_LINES.honesty_required,
};
