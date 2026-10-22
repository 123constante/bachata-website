/**
 * W1 code-review round 1 F2+F5, round 2 R1: the overlay's person mapping is a lazy chunk
 * (person-page/searchPerson), imported with a plain import() (never safeDynamicImport: a
 * stale-chunk reload mid-keystroke would throw the typed query away). If that chunk cannot
 * load, search must still return every other result kind, the people rows degrade to a
 * mapping without it (roles from the search read, no page link: the search results instead),
 * and the failure is reported once. A search with no people never waits on the chunk.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const flagState = vi.hoisted(() => ({ searchV5: true, searchV6: true, searchV7: true, teacherDetail: false }));
const rpc = vi.hoisted(() => vi.fn());
const report = vi.hoisted(() => vi.fn());

vi.mock('@/lib/featureFlags', () => ({ flags: flagState }));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => ({ rpc }) }));
vi.mock('@/lib/festivalsList', () => ({
  fetchPublicFestivalsList: async () => [],
  filterUpcomingFestivals: (rows: unknown[]) => rows,
}));
vi.mock('@/lib/reportClientErrorLazy', () => ({ reportClientErrorLazy: report }));
// vitest wraps a throwing mock factory's error in its own message, so the stale-chunk
// classifier is pinned: every import failure here counts as deploy-stale, and the
// once-per-session reload is a spy. The plain import() path must never reach it.
const attemptReload = vi.hoisted(() => vi.fn(() => true));
vi.mock('@/lib/staleChunk', () => ({
  isStaleChunkError: () => true,
  attemptChunkReloadOnce: attemptReload,
  clearChunkReloadFlag: () => {},
}));

const person = {
  id: 'p1', first_name: 'Ana', surname: 'B', display_name: 'Ana B', photo_url: null, avatar_url: null,
  slug: null, nationality_code: null, roles: ['dj', 'teacher'], primary_role: 'dj',
};
const envelope = (people: unknown[]) => ({
  query: 'first',
  events: [{ id: 'e1', name: 'Night', poster_url: null, event_type: 'party', start_time: null }],
  organisers: [{ id: 'o1', name: 'Org', avatar_url: null }],
  venues: [{ id: 'v1', name: 'Hall', address: 'A', photo_url: null }],
  vendors: [], cities: [],
  people,
  total_count: 3 + people.length, did_you_mean: null,
});


// Fresh searchRpc (and its report-once latch) per test, with the chunk mocked to `factory`.
async function load(factory: () => unknown) {
  vi.resetModules();
  vi.doMock('@/modules/person-page/searchPerson', factory as never);
  return (await import('@/lib/searchRpc')).searchPublicV3;
}
// A hang must fail the test fast, not at the 5 s test timeout.
const within = <T,>(p: Promise<T>, ms = 1000) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('search never settled')), ms))]);

beforeEach(() => {
  rpc.mockReset();
  report.mockReset();
  attemptReload.mockClear();
  rpc.mockResolvedValue({ data: envelope([person]), error: null });
});
afterEach(() => {
  vi.doUnmock('@/modules/person-page/searchPerson');
});

const failing = (msg: string) => () => {
  throw new Error(msg);
};

describe('searchPerson chunk fails to load (null module)', () => {
  it('events, venues and organisers are still returned', async () => {
    const search = await load(failing('network down'));
    const rows = await within(search('first', 'london', 5, false));
    expect(rows.map((r) => r.kind).sort()).toEqual(['event', 'organiser', 'person', 'venue']);
    expect(rows.find((r) => r.kind === 'event')!.href).toBe('/event/e1');
    expect(rows.find((r) => r.kind === 'venue')!.subtitle).toBe('A');
  });
  it('the person row degrades: roles in order, a search href, never /people/', async () => {
    const search = await load(failing('network down'));
    const rows = await within(search('first', 'london', 5, false));
    const p = rows.find((r) => r.kind === 'person')!;
    expect(p.roles).toEqual(['teacher', 'dj']);
    expect(p.subtitle).toBe('Teacher \u00b7 DJ');
    expect(p.href).toBe('/city/london/search?q=Ana%20B');
    expect(p.href).not.toMatch(/\/people\//);
    expect(p.telemetryKind).toBe('dj');
  });
  it('a stale-chunk error does NOT reload the page mid-keystroke; search still resolves', async () => {
    const search = await load(failing('Failed to fetch dynamically imported module: /assets/searchPerson-x.js'));
    const rows = await within(search('first', 'london', 5, false));
    expect(attemptReload).not.toHaveBeenCalled();
    expect(rows.find((r) => r.kind === 'person')!.href).toBe('/city/london/search?q=Ana%20B');
  });
  it('the failure is reported once, not per keystroke', async () => {
    const search = await load(failing('network down'));
    await within(search('first', 'london', 5, false));
    await within(search('firs', 'london', 5, false));
    await within(search('fir', 'london', 5, false));
    expect(report).toHaveBeenCalledTimes(1);
    expect(report.mock.calls[0][0]).toBeInstanceOf(Error);
  });
});

describe('a search with no people never waits on the chunk', () => {
  it('resolves even if the import never settles', async () => {
    rpc.mockResolvedValue({ data: envelope([]), error: null });
    const search = await load(() => new Promise(() => {}));
    const rows = await within(search('first', 'london', 5, false));
    expect(rows.map((r) => r.kind).sort()).toEqual(['event', 'organiser', 'venue']);
    expect(report).not.toHaveBeenCalled();
  });
});
