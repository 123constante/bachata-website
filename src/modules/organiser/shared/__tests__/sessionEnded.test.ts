/**
 * Arc 1 flow 9c: a sign-in that ends mid-edit says so in ONE sentence on every
 * save path (series commands and the programme), from one constant. The
 * mockup's "What you typed is kept on this phone" is NOT said: no flow keeps a
 * draft across a sign-in, so the line would be false.
 */
import { describe, expect, it } from 'vitest';
import { SESSION_ENDED, commandErrorMessage, programmeErrorCopy } from '../selfServeErrors';

const RAISES = ['authentication_required', 'permission_denied: authentication_required'];

describe('session ended mid-edit', () => {
  it('is one short sentence that never promises a kept draft', () => {
    expect(SESSION_ENDED).toBe('Your sign-in ended. Sign in again.');
    expect(SESSION_ENDED).not.toMatch(/kept|saved/i);
  });

  it.each(RAISES)('series command: %s', (message) => {
    expect(commandErrorMessage({ message, code: 'P0001' })).toBe(SESSION_ENDED);
  });

  it.each(RAISES)('programme save: %s', (message) => {
    expect(programmeErrorCopy({ message, code: 'P0001' }).message).toBe(SESSION_ENDED);
  });
});
