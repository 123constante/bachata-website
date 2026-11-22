import { describe, expect, it, vi } from 'vitest';
import { changeList, knownDraft, runHeld, runPlan, stepSig, writePlan, type EditorDraft, type SaveHold, type WriteStep } from '../editorModel';
import { v2KeepsDraft } from '../scope';

/* Editor v2 S1 fix round (review of ce1c1e5): each block failed on the unfixed code. */
const base = { name: 'N', about: 'A', venueId: 'v1' };
const dayOf = (id: string) => id;
const dates = [{ id: 'o1', version: 3 }, { id: 'o2', version: 5 }];
const sess = (v: number) => ({ version: v, payload: [{ series_item_id: 's1', removed: true }], rows: [] });
const nameCmd = { type: 'update_series', payload: { name: 'New' } } as unknown as WriteStep['command'];
const aboutCmd = { type: 'update_series', payload: { default_description: 'B' } } as unknown as WriteStep['command'];
let n = 0;
const newKey = () => `k${(n += 1)}`;
// the real occurrence_command_p5 / series_command_p5 shape (_command_result_ok_p5, prod 2026-11-20)
const ok = (v: number) => ({ ok: true, data: {}, new_version: v, audit_id: 'a' });

describe('finding 1: a retry keeps the series version the landed steps left', () => {
  it('the second series step sends the bumped version, not the prop', async () => {
    const draft: EditorDraft = { event: {}, nights: {}, sessions: {} };
    const steps = writePlan('ser', [nameCmd!, aboutCmd!], draft, dates, dayOf);
    let fail = true;
    const sent: (number | null)[] = [];
    const send = vi.fn(async (s: WriteStep, v: number | null) => {
      sent.push(v);
      if (s === steps[1] && fail) { fail = false; throw new Error('net'); }
      return ok((v ?? 0) + 1);
    });
    const first = await runHeld(steps, null, 10, send, newKey);
    expect(first.error).not.toBeNull();
    // same steps, prop still 10 (no refetch yet): the retry must send 11
    const second = await runHeld(steps, first.hold, 10, send, newKey);
    expect(second.error).toBeNull();
    expect(sent).toEqual([10, 11, 11]);
  });
});

describe('finding 2: a refetch that drops a landed step does not resend the others', () => {
  it('landed night override is not re-sent; the sessions step keeps the bumped version; keys are reused', async () => {
    const draft: EditorDraft = { event: {}, nights: { o1: { title: 'X' } }, sessions: { o1: sess(3) } };
    const before = writePlan('ser', [nameCmd!], draft, dates, dayOf);
    const calls: [string, number | null, string][] = [];
    let fail = true;
    const send = vi.fn(async (s: WriteStep, v: number | null, occ: number | null, key: string) => {
      calls.push([s.target, s.target === 'series' ? v : occ, key]);
      if (s.target === 'programme' && fail) { fail = false; throw new Error('net'); }
      return s.target === 'programme' ? { version: (occ ?? 0) + 1 } : ok(((s.target === 'series' ? v : occ) ?? 0) + 1);
    });
    const first = await runHeld(before, null, 10, send, newKey);
    expect(first.failed).toEqual(['Sessions that night (o1)']);
    // the refetch lands the name: detailsPlan no longer emits it, and the date shows its new version
    const after = writePlan('ser', [], draft, [{ id: 'o1', version: 4 }, { id: 'o2', version: 5 }], dayOf);
    const second = await runHeld(after, first.hold, 11, send, newKey);
    expect(second.error).toBeNull();
    expect(calls.map((c) => c[0])).toEqual(['series', 'occurrence', 'programme', 'programme']);
    expect(calls[3][1]).toBe(4);
    expect(calls[3][2]).toBe(calls[2][2]);
    expect(second.hold).toBeNull();
  });
  it('a step whose content changed is a new step with a new key', async () => {
    const draft: EditorDraft = { event: {}, nights: { o1: { title: 'X' } }, sessions: {} };
    const steps = writePlan('ser', [], draft, dates, dayOf);
    const hold: SaveHold = { keys: { [stepSig(steps[0])]: 'old' }, landed: [], occ: {}, seriesVersion: null };
    const edited = writePlan('ser', [], { ...draft, nights: { o1: { title: 'Y' } } }, dates, dayOf);
    const keys: string[] = [];
    await runHeld(edited, hold, 1, async (_s, _v, _o, key) => { keys.push(key); return ok(4); }, newKey);
    expect(keys[0]).not.toBe('old');
  });
});

describe('finding 3: the programme step reads the real set_override response', () => {
  it('chains new_version from the prod shape', async () => {
    const steps = writePlan('ser', [], { event: {}, nights: { o1: { title: 'X' } }, sessions: { o1: sess(3) } }, dates, dayOf);
    const seen: (number | null)[] = [];
    await runPlan(steps, 0, 1, async (s, _v, occ) => { seen.push(occ); return s.target === 'programme' ? { version: 5 } : ok(4); });
    expect(seen).toEqual([3, 4]);
  });
});

describe('finding 4: a night no longer on the event is not a change', () => {
  it('the save bar does not count what Save would not send', () => {
    const draft: EditorDraft = { event: {}, nights: { gone: { title: 'X' } }, sessions: { gone2: sess(1) } };
    const known = knownDraft(draft, dates);
    expect(changeList(base, known, dayOf)).toEqual([]);
    expect(writePlan('ser', [], known, dates, dayOf)).toEqual([]);
    expect(changeList(base, knownDraft({ event: {}, nights: { o1: { title: 'X' } } }, dates), dayOf)).toEqual(['Name for this night (o1)']);
  });
});

describe('nit: the v2 no-ask pair is flag-gated', () => {
  it('flag off asks as today; on keeps the draft', () => {
    expect(v2KeepsDraft('/o/events/e1/edit', '/o/events/e1/night/n1', false)).toBe(false);
    expect(v2KeepsDraft('/o/events/e1/edit', '/o/events/e1/night/n1', true)).toBe(true);
  });
});
