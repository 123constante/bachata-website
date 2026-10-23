import { describe, expect, it } from 'vitest';
import { rebuildEnabled } from '../rebuildSwitch';

describe('ER-S0 rebuild switch', () => {
  it.each([
    ['unset is off', undefined, ['o1'], false],
    ['empty is off', '', ['o1'], false],
    ['blank entries are off', ' , ', ['o1'], false],
    ['an allowlisted page turns it on', 'o9, o1', ['o1', 'o2'], true],
    ['a login with none of the pages is off', 'o9', ['o1'], false],
    ['a login with no pages is off', 'o9', [], false],
    ['* is everyone, even before pages load', '*', [], true],
  ] as const)('%s', (_n, raw, ids, want) => {
    expect(rebuildEnabled(raw, ids)).toBe(want);
  });
});
