/**
 * F-PAR S5 / S6 consistency row: one name for bringing a date back (PUT_IT_BACK)
 * and one Take-this-date-off body (TAKE_OFF.body). Every non-test source file of
 * the organiser module is scanned for the old wordings; any left fails.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === '__tests__' ? [] : sources(p);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

const FILES = sources(ROOT);

const OLD: [string, RegExp][] = [
  ['"Put back" as a button label', /(>\s*Put back\s*<|'Put back'|`Put back )/],
  ['"Put it back on" as a button label', /Put it back on\s*</],
  ['the old taken-off body', /It disappears from the calendar/],
  ['the old date-page break body', /comes off the calendar for a break/],
];

describe('F-PAR S5/S6: no old wording is left in the organiser module', () => {
  it('scans a real set of files', () => {
    expect(FILES.length).toBeGreaterThan(50);
  });
  it.each(OLD)('%s', (_name, pattern) => {
    const hits = FILES.filter((f) => pattern.test(readFileSync(f, 'utf8'))).map((f) => relative(ROOT, f));
    expect(hits).toEqual([]);
  });
});
