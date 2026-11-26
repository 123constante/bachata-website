import { describe, expect, it } from 'vitest';
import { RELOAD_STATUSES, RELOAD_WINDOW_MS, shouldReloadOnRouteError } from './routeErrorReload';

function store() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe('shouldReloadOnRouteError', () => {
  it.each(RELOAD_STATUSES)('reloads once then not again within the window for %i', (s) => {
    const st = store();
    expect(shouldReloadOnRouteError(s, '/a', st, 1000)).toBe(true);
    expect(shouldReloadOnRouteError(s, '/a', st, 1000 + RELOAD_WINDOW_MS - 1)).toBe(false);
  });
  it.each([400, 404, 410, 500, 501])('never reloads for %i', (s) => {
    expect(shouldReloadOnRouteError(s, '/a', store(), 1000)).toBe(false);
  });
  it('reloads again at now + window', () => {
    const st = store();
    expect(shouldReloadOnRouteError(503, '/a', st, 1000)).toBe(true);
    expect(shouldReloadOnRouteError(503, '/a', st, 1000 + RELOAD_WINDOW_MS)).toBe(true);
  });
  it('guard is per path', () => {
    const st = store();
    expect(shouldReloadOnRouteError(503, '/a', st, 1000)).toBe(true);
    expect(shouldReloadOnRouteError(503, '/b', st, 1001)).toBe(true);
  });
  it('null and throwing storage return false', () => {
    expect(shouldReloadOnRouteError(503, '/a', null, 1000)).toBe(false);
    const bad = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
    expect(shouldReloadOnRouteError(503, '/a', bad, 1000)).toBe(false);
  });
});
