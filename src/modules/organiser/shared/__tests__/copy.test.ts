import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { WARN_DATE, WARN_END, VERSION_CONFLICT, handOverWarning } from '../copy';
import { commandErrorMessage } from '../selfServeErrors';

const MODULE = resolve(__dirname, '../..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sources(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/**
 * Screens (non-test files outside shared/copy.ts) that import `name` from the
 * copy module. S8 inherits this counter: each name goes to 1 when its screen lands.
 */
export function importSites(name: string): string[] {
  const re = new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['"][^'"]*(?:shared/copy|\\./copy)['"]`);
  return sources(MODULE).filter((f) => !f.endsWith(join('shared', 'copy.ts')) && re.test(readFileSync(f, 'utf8')));
}

describe('copy (4.3 #9)', () => {
  it('pins the words', () => {
    expect(WARN_DATE).toBe('Only this date changes. Dancers see it at once.');
    expect(WARN_END).toBe('Only Ricky can reopen an ended event.');
    expect(VERSION_CONFLICT).toBe('Someone changed this first. Check it.');
    expect(handOverWarning('Ritmo', 'Maya R.')).toBe(
      'Hand Ritmo over to Maya R.? You become a Manager: you can still edit events but no longer hand the page over or remove people. Maya R. can hand it back.',
    );
  });

  it('each warning has at most ONE importing screen (0 until its flow lands, then exactly 1)', () => {
    for (const name of ['WARN_DATE', 'WARN_END', 'handOverWarning']) {
      expect(importSites(name).length, name).toBeLessThanOrEqual(1);
    }
  });

  it('a version_conflict refusal reads VERSION_CONFLICT (R3-7)', () => {
    expect(commandErrorMessage({ message: 'version_conflict: expected 3 got 4' })).toBe(VERSION_CONFLICT);
  });
});
