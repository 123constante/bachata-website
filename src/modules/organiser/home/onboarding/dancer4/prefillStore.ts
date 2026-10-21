import { NO_PREFILL, parsePrefill, type DancerPrefill } from './dancer4Model';

/**
 * Carries redeem_organiser_invite_v1's `prefill` from the redeem call to the
 * dancer questions. Prefill only reaches the client on a BOUND link redeemed in
 * a proven-mailbox session, which skips the dancer gate: the redeem call runs
 * BEFORE the gate renders and calls rememberDancerPrefill(data.prefill); the
 * Finish screen reads it. sessionStorage, so a refresh between the two keeps it
 * and closing the tab drops it. Holds a first name and a city id, never a token.
 */
export const DANCER_PREFILL_KEY = 'bc:dancer-prefill';

let memory: DancerPrefill = NO_PREFILL;

export const rememberDancerPrefill = (raw: unknown): void => {
  memory = parsePrefill(raw);
  try {
    if (memory.first_name || memory.city_id) sessionStorage.setItem(DANCER_PREFILL_KEY, JSON.stringify(memory));
    else sessionStorage.removeItem(DANCER_PREFILL_KEY);
  } catch {
    /* storage can be blocked; the in-memory copy still serves this page load */
  }
};

export const readDancerPrefill = (): DancerPrefill => {
  if (memory.first_name || memory.city_id) return memory;
  try {
    const stored = sessionStorage.getItem(DANCER_PREFILL_KEY);
    return stored ? parsePrefill(JSON.parse(stored)) : NO_PREFILL;
  } catch {
    return NO_PREFILL;
  }
};

export const clearDancerPrefill = (): void => {
  memory = NO_PREFILL;
  try {
    sessionStorage.removeItem(DANCER_PREFILL_KEY);
  } catch {
    /* nothing to clear */
  }
};
