import { describe, expect, it } from 'vitest';
import { CLASSIC_FORM, KINDS, afterKind, kindTarget } from '../model';
import { CLASSIC_CREATE_KINDS, CLASSIC_CREATE_PATH, P3_PATHS, isClassicCreateAllowed } from '../../shell/paths';

/* p3-create-kinds: every kind x page count x page named. A built kind opens its own form (or the page question);
   a not-yet-built one opens the classic kind picker with the kind and page named. */
const deferred = KINDS.filter((k) => k.deferred);

describe('where a tapped kind goes', () => {
  it('the deferred kinds are exactly the allow-listed three, all with the classic-form pill', () => {
    expect(deferred.map((k) => k.kind)).toEqual([...CLASSIC_CREATE_KINDS]);
    for (const k of deferred) expect(k.deferred).toBe(CLASSIC_FORM);
    expect(CLASSIC_FORM).toBe('Opens the classic form');
  });

  const cases = KINDS.flatMap((k) => [0, 1, 2].flatMap((pages) => [null, 'o1'].map((o) => [k.kind, pages, o] as const)));
  it.each(cases)('%s, %i page(s), organiser %s', (kind, pages, o) => {
    const k = KINDS.find((x) => x.kind === kind)!;
    const to = kindTarget(k, o, pages);
    if (k.deferred) {
      expect(to).toBe(`/account/o/new/what?kind=${kind}${o ? '&o=o1' : ''}`);
      expect(isClassicCreateAllowed(...(to.split('?') as [string, string]))).toBe(true);
    } else {
      expect(to).toBe(afterKind(k.kind, o, pages));
      expect(to.startsWith(P3_PATHS.create)).toBe(true);
    }
  });
});

describe('the classic create allow-list', () => {
  it.each([
    [CLASSIC_CREATE_PATH, '', true], [`${CLASSIC_CREATE_PATH}/`, '?kind=course', true], [CLASSIC_CREATE_PATH, '?kind=online&o=x', true],
    [CLASSIC_CREATE_PATH, '?kind=weekly', false], ['/account/o/events', '', false], ['/account/o', '', false], ['/account/p3/create', '', false],
  ])('%s%s -> %s', (path, search, ok) => {
    expect(isClassicCreateAllowed(path, search)).toBe(ok);
  });
});
