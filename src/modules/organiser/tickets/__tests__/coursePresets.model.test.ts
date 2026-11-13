import { describe, expect, it } from 'vitest';
import { buildUpsert, formOf, type TypeForm } from '../ticketModel';
import { upsertPayload } from '../ticketsApi';
import { PRESETS_FREE, PRESETS_FULL, PRESET_PAST, PRESET_TAKEN, courseErrors, coursePresets, parseCourseDates, presetForm, shiftDay } from '../coursePresets';

const NOW = new Date('2026-11-13T12:00:00Z');
const step = (effectiveFrom: string) => ({ effectiveFrom });
const view = (o: Partial<Parameters<typeof coursePresets>[0]> = {}) =>
  coursePresets({ kind: 'course', validFrom: '2027-03-01', basePricePence: 6000, steps: [], now: NOW, ...o });

describe('presets, per shape', () => {
  const T: [string, Partial<Parameters<typeof coursePresets>[0]>, (v: NonNullable<ReturnType<typeof view>>) => void][] = [
    ['paid course, 0 steps: 3 presets, London midnight', {}, (v) => {
      expect(v.blocked).toBeNull();
      expect(v.offered.map((p) => p.at)).toEqual(['2027-02-01T00:00', '2027-02-15T00:00', '2027-02-22T00:00']);
      expect(v.skipped).toEqual([]);
    }],
    ['free course: none, says why', { basePricePence: 0 }, (v) => { expect(v.blocked).toBe(PRESETS_FREE); expect(v.offered).toEqual([]); }],
    ['3 existing steps: none, says why', { steps: [step('2027-01-01T00:00:00Z'), step('2027-01-02T00:00:00Z'), step('2027-01-03T00:00:00Z')] }, (v) => { expect(v.blocked).toBe(PRESETS_FULL); }],
    ['1 existing step on a preset instant: that preset skipped (taken)', { steps: [step('2027-02-15T00:00:00Z')] }, (v) => {
      expect(v.skipped.map((s) => [s.id, s.why])).toEqual([['weeks-2', PRESET_TAKEN]]);
      expect(v.offered).toHaveLength(2);
    }],
    ['start in the past: all skipped as past', { validFrom: '2026-10-01' }, (v) => { expect(v.offered).toEqual([]); expect(v.skipped.every((s) => s.why === PRESET_PAST)).toBe(true); expect(v.skipped).toHaveLength(3); }],
    ['start 10 days away: only the 1 week preset is left', { validFrom: '2026-11-23' }, (v) => {
      expect(v.offered.map((p) => p.id)).toEqual(['weeks-1']);
      expect(v.skipped.map((s) => s.id)).toEqual(['weeks-4', 'weeks-2']);
    }],
    ['spring DST (clocks forward 28 Mar 2027): wall time stays 00:00', { validFrom: '2027-04-11' }, (v) => {
      expect(v.offered.map((p) => p.at)).toEqual(['2027-03-14T00:00', '2027-03-28T00:00', '2027-04-04T00:00']);
    }],
    ['autumn DST (clocks back 31 Oct 2027)', { validFrom: '2027-11-14', now: new Date('2027-01-01T00:00:00Z') }, (v) => {
      expect(v.offered.map((p) => p.at)).toEqual(['2027-10-17T00:00', '2027-10-31T00:00', '2027-11-07T00:00']);
    }],
  ];
  it.each(T)('%s', (_n, over, check) => check(view(over)!));
  it('a night type or a course without dates has no presets section', () => {
    expect(view({ kind: 'night' })).toBeNull();
    expect(view({ validFrom: null })).toBeNull();
  });
  it('a preset fills the time only and never a price', () => {
    expect(presetForm(view()!.offered[0])).toEqual({ at: '2027-02-01T00:00', price: '' });
  });
});

describe('course create', () => {
  const base: TypeForm = { ...formOf(null), name: 'Term 1', paid: true, price: '60', capacity: '20' };
  const ids = { organiserId: 'o', seriesId: 's' };
  it('a new course sends kind and dates', () => {
    const d = buildUpsert({ ...base, kind: 'course', validFrom: '2027-03-01', validTo: '2027-05-10' }, null, ids)!;
    expect(upsertPayload(d)).toMatchObject({ kind: 'course', valid_from: '2027-03-01', valid_to: '2027-05-10', occurrence_id: null });
  });
  it('a night ticket sends no kind keys (flag off is the same payload)', () => {
    expect(Object.keys(upsertPayload(buildUpsert(base, null, ids)!))).not.toContain('kind');
    expect(Object.keys(upsertPayload(buildUpsert({ ...base, kind: 'night' }, null, ids)!))).not.toContain('valid_from');
  });
  it.each([
    [{ validFrom: '', validTo: '' }, ['validFrom', 'validTo']],
    [{ validFrom: '2027-03-01', validTo: '' }, ['validTo']],
    [{ validFrom: '2027-03-02', validTo: '2027-03-01' }, ['validTo']],
    [{ validFrom: '2027-03-01', validTo: '2027-03-01' }, []],
  ])('dates %j', (f, keys) => expect(Object.keys(courseErrors(f))).toEqual(keys));
  it('shiftDay and parse', () => {
    expect(shiftDay('2027-03-01', -28)).toBe('2027-02-01');
    expect(parseCourseDates({ kind: 'course', valid_from: '2027-03-01', valid_to: null })).toEqual({ kind: 'course', validFrom: '2027-03-01', validTo: null });
  });
});
