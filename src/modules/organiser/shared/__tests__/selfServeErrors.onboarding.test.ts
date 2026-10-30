/**
 * Scope G1: the onboarding gate's refusal (P0001, message `onboarding_incomplete`,
 * bare or `permission_denied: `-prefixed) gets its own sentence on every door's
 * copy table, never the generic line, from ONE shared pattern. Written against
 * the unfixed map first: both tables fell through to the generic line.
 */
import { describe, expect, it } from 'vitest';
import {
  COMMAND_COPY,
  commandErrorMessage,
  isOnboardingRefusal,
  ONBOARDING_REFUSAL,
  ONBOARDING_REFUSAL_MATCH,
  PROGRAMME_COPY,
  programmeErrorCopy,
} from '../selfServeErrors';

const BARE = { code: 'P0001', message: 'onboarding_incomplete', details: '{"missing":["photo"]}', hint: 'Finish your details' };
const PREFIXED = { code: 'P0001', message: 'permission_denied: onboarding_incomplete' };

describe('onboarding_incomplete refusal', () => {
  it('is the first row of both tables, from the one shared pattern', () => {
    expect(COMMAND_COPY[0]).toEqual({ match: ONBOARDING_REFUSAL_MATCH, message: ONBOARDING_REFUSAL });
    expect(PROGRAMME_COPY[0]).toEqual({ match: ONBOARDING_REFUSAL_MATCH, message: ONBOARDING_REFUSAL });
  });
  it.each([['bare', BARE], ['prefixed', PREFIXED]])('maps on both tables: %s', (_name, error) => {
    expect(commandErrorMessage(error)).toBe(ONBOARDING_REFUSAL);
    expect(programmeErrorCopy(error)).toEqual({ message: ONBOARDING_REFUSAL, sessionIndex: null, reload: false });
  });
  it.each([
    ['bare', BARE, true],
    ['prefixed', PREFIXED, true],
    ['other refusal', { code: 'P0001', message: 'version_conflict' }, false],
    ['not at the start', { code: 'P0001', message: 'invalid_payload: onboarding_incomplete' }, false],
    ['null', null, false],
  ])('isOnboardingRefusal agrees with the tables: %s', (_name, error, want) => {
    expect(isOnboardingRefusal(error)).toBe(want);
    expect(commandErrorMessage(error) === ONBOARDING_REFUSAL).toBe(want);
  });
});
