import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, auth: {}, from: vi.fn() } }));

import { buildScopedEnvelope, heldKey, previewScope, sendScoped } from '../scopeAsk';
import { isOnboardingRefusal } from '../../../shared/selfServeErrors';
import { commandErrorMessage } from '../../../shared/selfServeErrors';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
beforeEach(() => rpc.mockReset());

describe('buildScopedEnvelope: exactly the documented envelope', () => {
  it('all_dates has no occurrence_id; expected_version is the series version', () => {
    const e = buildScopedEnvelope({ scope: 'all_dates', seriesId: 's1', changes: { passes: [] }, expectedVersion: 7 }, 'k1');
    expect(e).toEqual({ series_id: 's1', scope: 'all_dates', changes: { passes: [] }, idempotency_key: 'k1', expected_version: 7 });
    expect('occurrence_id' in e).toBe(false);
  });
  it('this_date carries the occurrence and its version; no version = no key', () => {
    expect(buildScopedEnvelope({ scope: 'this_date', seriesId: 's1', occurrenceId: 'o1', changes: { venue_id: 'v', city_id: 'c' }, expectedVersion: 3 }, 'k')).toEqual({
      series_id: 's1', scope: 'this_date', occurrence_id: 'o1', changes: { venue_id: 'v', city_id: 'c' }, idempotency_key: 'k', expected_version: 3,
    });
    expect('expected_version' in buildScopedEnvelope({ scope: 'this_date', seriesId: 's1', occurrenceId: 'o1', changes: { gallery: [] }, expectedVersion: null }, 'k')).toBe(false);
  });
  it('refuses an empty changes object, a venue without its city, and this_date without an occurrence', () => {
    expect(() => buildScopedEnvelope({ scope: 'all_dates', seriesId: 's', changes: {}, expectedVersion: 1 }, 'k')).toThrow();
    expect(() => buildScopedEnvelope({ scope: 'all_dates', seriesId: 's', changes: { venue_id: 'v' }, expectedVersion: 1 }, 'k')).toThrow();
    expect(() => buildScopedEnvelope({ scope: 'this_date', seriesId: 's', changes: { gallery: [] }, expectedVersion: 1 }, 'k')).toThrow();
  });
});

describe('heldKey: one uuid per identical write, renewed after Start again', () => {
  it('same write -> same key; a different write -> a new key; forget -> a new key', () => {
    const a = heldKey(null, 'sig-1');
    expect(a.key).toMatch(UUID);
    expect(heldKey(a, 'sig-1').key).toBe(a.key);
    expect(heldKey(a, 'sig-2').key).not.toBe(a.key);
    expect(heldKey(null, 'sig-1').key).not.toBe(a.key);
  });
});

describe('previewScope', () => {
  it('calls the preview with the field keys and returns typed counts', async () => {
    rpc.mockResolvedValue({ data: {
      series_id: 's1', today: '2026-11-04', fields: ['cover_image_url'],
      dates: [{ occurrence_id: 'o1', occurrence_date: '2026-11-07', kept_fields: [], applied_fields: ['cover_image_url'], curated_but_inherits: false }],
      totals: { dates: 1, applied: 1, kept: 0, curated: 0, curated_but_inherits: 0, going: 0 },
    }, error: null });
    const p = await previewScope('s1', ['cover_image_url']);
    expect(rpc).toHaveBeenCalledWith('series_scope_change_preview_v1', { p_series_id: 's1', p_fields: ['cover_image_url'] });
    expect(p.totals).toEqual({ dates: 1, applied: 1, kept: 0, curated_but_inherits: 0 });
    expect(p.dates[0]).toEqual({ occurrence_id: 'o1', occurrence_date: '2026-11-07', kept_fields: [], applied_fields: ['cover_image_url'] });
  });
  it('a malformed reply throws; an rpc error throws', async () => {
    rpc.mockResolvedValue({ data: { dates: 'no' }, error: null });
    await expect(previewScope('s1', ['passes'])).rejects.toThrow();
    rpc.mockResolvedValue({ data: null, error: { message: 'boom', code: 'P0001' } });
    await expect(previewScope('s1', ['passes'])).rejects.toBeTruthy();
  });
});

describe('sendScoped', () => {
  const ok = { scope: 'all_dates', series_id: 's1', result: { new_version: 9 }, applied_dates: ['a', 'b'], kept_dates: [{ occurrence_id: 'c', occurrence_date: '2026-11-14', fields: ['passes'] }], dates: [] };
  it('sends the envelope under p_envelope and returns the lists', async () => {
    rpc.mockResolvedValue({ data: ok, error: null });
    const r = await sendScoped({ scope: 'all_dates', seriesId: 's1', changes: { passes: [] }, expectedVersion: 8 }, 'key-1');
    expect(rpc).toHaveBeenCalledWith('series_scoped_change_p5', { p_envelope: { series_id: 's1', scope: 'all_dates', changes: { passes: [] }, idempotency_key: 'key-1', expected_version: 8 } });
    expect(r.appliedDates).toEqual(['a', 'b']);
    expect(r.keptDates).toEqual([{ occurrence_id: 'c', occurrence_date: '2026-11-14', fields: ['passes'] }]);
    expect(r.newVersion).toBe(9);
  });
  it('a retry with the same key is the same envelope key', async () => {
    rpc.mockResolvedValue({ data: ok, error: null });
    const held = heldKey(null, 'sig');
    await sendScoped({ scope: 'all_dates', seriesId: 's1', changes: { passes: [] }, expectedVersion: 8 }, held.key);
    await sendScoped({ scope: 'all_dates', seriesId: 's1', changes: { passes: [] }, expectedVersion: 8 }, heldKey(held, 'sig').key);
    const keys = rpc.mock.calls.map((c) => (c[1] as { p_envelope: { idempotency_key: string } }).p_envelope.idempotency_key);
    expect(keys[0]).toBe(keys[1]);
  });
  it('onboarding refusal rejects with the error the gate recognises', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'permission_denied: onboarding_incomplete', code: '42501' } });
    const e = await sendScoped({ scope: 'all_dates', seriesId: 's1', changes: { passes: [] }, expectedVersion: 1 }, 'k').catch((x) => x);
    expect(isOnboardingRefusal(e)).toBe(true);
  });
  it('a malformed reply (no applied_dates) is an error with the generic words, never a success', async () => {
    rpc.mockResolvedValue({ data: { scope: 'all_dates', kept_dates: [] }, error: null });
    const e = await sendScoped({ scope: 'all_dates', seriesId: 's1', changes: { passes: [] }, expectedVersion: 1 }, 'k').catch((x) => x);
    expect(e).toBeInstanceOf(Error);
    expect(commandErrorMessage(e)).not.toMatch(/^Saved/);
    expect(commandErrorMessage(e).length).toBeGreaterThan(0);
  });
});
