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
  KNOWN_SELF_SERVE_CODES,
  PROGRAMME_COPY,
  selfServeErrorCopy,
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

/**
 * Cooldown and interim-seat refusals (admin I1 #1284): `declined_recently` and
 * `interim_cannot_add` each get their own sentence from the ONE COPY map, never
 * the generic line, never the raw code. Written against the unfixed map first.
 */
const GENERIC_LINE = 'Something went wrong. Please try again.';
const REFUSALS = [
  {
    code: 'declined_recently',
    message: 'The page said no to your last request. You can ask again after 30 days, or message us.',
    next: 'contact_support',
  },
  {
    code: 'interim_cannot_add',
    message:
      'While this page has no owner, only the Bachata Calendar team can add people. Share the page link and ask them to tap Ask to join.',
    next: null,
  },
] as const;

describe.each(REFUSALS)('$code refusal', ({ code, message, next }) => {
  const error = { code: 'P0001', message: code };
  it('has its own sentence and next step', () => {
    expect(selfServeErrorCopy(error)).toEqual({ message, next });
  });
  it('is listed as a known code', () => {
    expect(KNOWN_SELF_SERVE_CODES).toContain(code);
  });
  it('never shows the raw code and is not the generic line', () => {
    const shown = selfServeErrorCopy(error).message;
    expect(shown).not.toBe(GENERIC_LINE);
    expect(shown).not.toContain(code);
    expect(shown).not.toMatch(/_/);
  });
  it('mentions only controls that exist (Ask to join; message us -> contact_support)', () => {
    const copy = selfServeErrorCopy(error);
    expect(copy.message).not.toMatch(/\b(retry|try again|add someone|invite)\b/i);
    if (/message us/i.test(copy.message)) expect(copy.next).toBe('contact_support');
    if (/ask to join/i.test(copy.message)) expect(copy.message).toMatch(/tap Ask to join/);
  });
});
