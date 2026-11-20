import { describe, expect, it, vi } from 'vitest';
import { NIGHT_ROLES, changeList, draftEmpty, runPlan, sameV2Editor, writePlan, type EditorDraft, type WriteStep } from '../editorModel';
import { clearDraftOf, draftOf, setDraftOf } from '../editorDraft';

const base = { name: 'N', about: 'A', venueId: 'v1' };
const iso: Record<string, string> = { o1: '2026-11-24', o2: '2026-12-01' };
// day words do not sort by date ("Tue 1 Dec" < "Tue 24 Nov"): orderOf must win
const words: Record<string, string> = { o1: 'Tue 24 Nov', o2: 'Tue 1 Dec' };
const dayOf = (id: string) => words[id] ?? id;
const orderOf = (id: string) => iso[id] ?? id;
const dates = [{ id: 'o1', version: 3 }, { id: 'o2', version: 5 }];
const sess = (v: number) => ({ version: v, payload: [{ series_item_id: 's1', removed: true }], rows: [] });

describe('sessions in the write plan (order 2)', () => {
  const d: EditorDraft = { event: {}, nights: { o2: { title: 'X' } }, sessions: { o2: sess(5), o1: sess(3) } };
  it('names each night\u2019s sessions in the change list, by date', () => {
    expect(changeList(base, d, dayOf, orderOf)).toEqual([
      'Name for this night (Tue 1 Dec)', 'Sessions that night (Tue 24 Nov)', 'Sessions that night (Tue 1 Dec)',
    ]);
  });
  it('overrides first, then sessions, each by date; a session step carries the full payload', () => {
    const steps = writePlan('ser', [], d, dates, dayOf, orderOf);
    expect(steps.map((s) => [s.order, s.target, s.id])).toEqual([[1, 'occurrence', 'o2'], [2, 'programme', 'o1'], [2, 'programme', 'o2']]);
    expect(steps[1]).toMatchObject({ command: null, version: 3, payload: [{ series_item_id: 's1', removed: true }] });
  });
  it('drops sessions for a date no longer on the event', () => {
    expect(writePlan('ser', [], { event: {}, nights: {}, sessions: { gone: sess(1) } }, dates, dayOf)).toEqual([]);
  });
  it('an untouched draft sends nothing', () => {
    expect(writePlan('ser', [], { event: {}, nights: { o1: {} }, sessions: {} }, dates, dayOf)).toEqual([]);
    expect(draftEmpty({ event: {}, nights: { o1: {} }, sessions: {} })).toBe(true);
    expect(draftEmpty({ event: {}, nights: {}, sessions: { o1: sess(3) } })).toBe(false);
  });
});

describe('runner chains the occurrence version', () => {
  it('the sessions step sends the version the override step left', async () => {
    const steps = writePlan('ser', [], { event: {}, nights: { o1: { title: 'X' } }, sessions: { o1: sess(3) } }, dates, dayOf, orderOf);
    const seen: (number | null)[] = [];
    const send = vi.fn(async (s: WriteStep, _v: number | null, occ: number | null) => {
      seen.push(occ);
      return s.target === 'occurrence' ? { new_version: 4 } : { version: 5 };
    });
    const r = await runPlan(steps, 0, 1, send);
    expect(r.failed).toEqual([]);
    expect(seen).toEqual([3, 4]);
  });
  it('a failed sessions step names it; the override that landed is not resent on retry', async () => {
    const steps = writePlan('ser', [], { event: {}, nights: { o1: { title: 'X' } }, sessions: { o1: sess(3) } }, dates, dayOf, orderOf);
    const r = await runPlan(steps, 0, 1, async (s) => { if (s.target === 'programme') throw new Error('x'); return { new_version: 4 }; });
    expect(r.done).toBe(1);
    expect(r.failed).toEqual(['Sessions that night (Tue 24 Nov)']);
  });
});

describe('one save bar across event page and nights', () => {
  it.each([
    ['/organiser/events/a/edit', '/organiser/events/a/night/o1', true],
    ['/organiser/events/a/night/o1', '/organiser/events/a/night/o2', true],
    ['/organiser/events/a/night/o1', '/organiser/events/a/edit', true],
    ['/organiser/events/a/edit', '/organiser/events/b/night/o1', false],
    ['/organiser/events/a/edit', '/organiser/events/a', false],
    ['/organiser/events/a/edit', '/organiser/events/a/details', false],
  ])('%s -> %s keeps the draft without asking: %s', (from, to, same) => {
    expect(sameV2Editor(from, to)).toBe(same);
  });
  it('the draft is one per event and survives between screens until cleared', () => {
    setDraftOf('a', (d) => ({ ...d, nights: { o1: { title: 'X' } } }));
    expect(draftOf('a').nights.o1).toEqual({ title: 'X' });
    expect(draftEmpty(draftOf('b'))).toBe(true);
    clearDraftOf('a');
    expect(draftEmpty(draftOf('a'))).toBe(true);
  });
});

it('nights may set teachers, DJs and dancers', () => {
  expect([...NIGHT_ROLES]).toEqual(['teaching', 'djing', 'dancing']);
});

it('a retry after a failed sessions step sends the version the landed override left', async () => {
  const steps = writePlan('ser', [], { event: {}, nights: { o1: { title: 'X' } }, sessions: { o1: sess(3) } }, dates, dayOf, orderOf);
  const first = await runPlan(steps, 0, 1, async (s) => { if (s.target === 'programme') throw new Error('x'); return { new_version: 4 }; });
  const seen: (number | null)[] = [];
  const again = await runPlan(steps, first.done, 1, async (_s, _v, occ) => { seen.push(occ); return { version: 5 }; }, first.occ);
  expect(again.failed).toEqual([]);
  expect(seen).toEqual([4]);
});
