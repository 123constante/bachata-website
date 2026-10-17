import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MODULE_ROOT, moduleSources, readModuleFile } from './sourceScan';

// D32: no tabs. TabBar.tsx and tabs.ts are deleted and nothing in the module
// imports them, names them, or asks the shell to hide them.
describe('no tab bar survives (D32)', () => {
  it('the two files are gone', () => {
    expect(existsSync(join(MODULE_ROOT, 'shell', 'TabBar.tsx'))).toBe(false);
    expect(existsSync(join(MODULE_ROOT, 'shell', 'tabs.ts'))).toBe(false);
  });

  it('no source file imports or names them', () => {
    const hits = moduleSources().filter((rel) => /\bTabBar\b|\bTABS\b|\bhideTabs\b|from ['"][^'"]*\/tabs['"]/.test(readModuleFile(rel)));
    expect(hits).toEqual([]);
  });
});
