import { normalisePostcode, type PostcodeFailure, type PostcodeFound } from './postcode';
import type { SimilarVenue } from './venueApi';

/** Prototype v7: a new venue name needs 3 letters (`nvBlock`). "Add a new venue" itself shows from MIN_ADD_LETTERS. */
export const MIN_NAME_LETTERS = 3;
/** Prototype v7 wording for an Add that matched a listed venue; callers that toast use this. */
export const ALREADY_LISTED = 'Already listed, picked it';

/** The answer to the last postcode lookup, for the postcode (and retry) it was asked for. */
export interface LookupAnswer {
  postcode: string;
  attempt: number;
  found: PostcodeFound | null;
  failure: PostcodeFailure | null;
}
/** The answer to the last look-alike check, for the `name|postcode` key it was asked for. */
export interface SimilarAnswer {
  key: string;
  rows: SimilarVenue[];
}

export interface AddVenueState {
  name: string;
  postcode: string;
  attempt: number;
  lookup: LookupAnswer | null;
  similar: SimilarAnswer | null;
  /** "No, it's a new venue" tapped for the look-alikes on screen. */
  sure: boolean;
}

/** The key the look-alike check is asked with, or null while there is nothing to ask. */
export function similarKey(name: string, place: PostcodeFound | null): string | null {
  const n = name.trim();
  return place && n.length >= MIN_NAME_LETTERS ? `${n}|${place.postcode}` : null;
}

/** The lookup answer for the postcode on screen now, or null while it is not whole or not answered yet. */
export function currentLookup(s: Pick<AddVenueState, 'postcode' | 'attempt' | 'lookup'>): LookupAnswer | null {
  const shaped = normalisePostcode(s.postcode);
  return shaped && s.lookup && s.lookup.postcode === shaped && s.lookup.attempt === s.attempt ? s.lookup : null;
}

/** Why "Add venue" cannot be tapped yet, or null. Prototype v7 `nvBlock`, plus the two waits a real lookup adds. */
export function addVenueBlock(s: AddVenueState): string | null {
  if (s.name.trim().length < MIN_NAME_LETTERS) return 'Type the name';
  if (!normalisePostcode(s.postcode)) return 'Type the postcode';
  const answer = currentLookup(s);
  if (!answer) return 'Looking up the postcode';
  if (!answer.found) return answer.failure === 'offline' ? 'Try the postcode lookup again' : 'Type the postcode';
  const key = similarKey(s.name, answer.found);
  if (!s.similar || s.similar.key !== key) return 'Checking the list';
  if (s.similar.rows.length && !s.sure) return 'Check the list above';
  return null;
}
