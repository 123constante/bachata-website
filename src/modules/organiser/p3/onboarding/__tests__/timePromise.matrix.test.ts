/**
 * join-gaps-1 gap 4: ONE time promise (graceModel timePromise) on every screen that names a time -- Home's banner
 * (J3), the gate sheet (J4) and the onboarding welcome line (J5) -- for every rows-left shape. Prod 2026-11-04
 * (counts only): redeemed invitees sit at 2, 3, 3, 5, 6, 6, 8 and 10 codes left; the server knows 18 codes, so
 * 11+ is reachable too. No screen may show a time that disagrees with its row count.
 */
import { describe, expect, it } from 'vitest';
import { gateBody, graceBody, timePromise, welcomeLine } from '../graceModel';

/** The minutes a count may promise (the rule, written once more here on purpose: the test is the second opinion). */
const allowed = (left: number): string | null => (left <= 0 ? null : left <= 3 ? 'a minute or two' : left <= 6 ? 'about three minutes' : left <= 10 ? 'about five minutes' : 'about ten minutes');
const TIMES = /a minute or two|about (three|five|ten) minutes/g;

const ROWS: [string, number | null][] = [['10 left', 10], ['8 left', 8], ['6 left', 6], ['5 left', 5], ['3 left', 3], ['2 left', 2], ['1 left', 1], ['0 left', 0], ['18 left (every code)', 18], ['unknown (status not read)', null]];
const SCREENS: [string, (n: number | null) => string][] = [
  ['J3 Home grace banner', (n) => graceBody(n ?? 0)],
  ['J4 gate sheet body', gateBody],
  ['J5 onboarding welcome line', welcomeLine],
];

describe('one time promise per rows-left, on every screen', () => {
  for (const [screenName, words] of SCREENS) {
    it.each(ROWS)(`${screenName} x %s`, (_label, left) => {
      // The banner is never shown with an unknown count (graceShown needs onboardingLeft > 0): skip that cell.
      if (screenName.startsWith('J3') && left === null) return;
      const text = words(left);
      const times = text.match(TIMES) ?? [];
      const want = left === null ? null : allowed(left);
      expect(times).toEqual(want ? [want] : []);
      expect(text.includes('You can stop and come back.')).toBe(left === null || left > 3);
      expect(text).toContain(timePromise(left === null && screenName.startsWith('J3') ? 0 : left));
      expect(text).not.toMatch(/\s{2}|\s$/);
    });
  }

  it('the old flat promise is gone from all three', () => {
    for (const [, words] of SCREENS) for (const [, n] of ROWS) expect(words(n)).not.toMatch(/About five minutes, once only|It takes about five minutes and you only do it once/);
  });
});
