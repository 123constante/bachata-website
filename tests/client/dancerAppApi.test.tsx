/**
 * The dancer app's api/ layer: the ONE error map, the RPC wrappers (real
 * parsing + error mapping over a mocked rpcLoose), the client delta rule, and
 * the in-memory fake backend's server mirror (diff-first save, codes, order,
 * every production shape as a fixture with the strength invariant).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: (...a: unknown[]) => h.rpc(...a) }));

import { DANCER_ERROR_CODES, SAVE_KEYS, STRENGTH_STEPS, type DancerErrorCode } from '@/modules/dancer-app/api/types';
import { DancerApiError, codeFromMessage, copyFor, fieldFor, toDancerError } from '@/modules/dancer-app/api/errors';
import {
  DANCER_RPC,
  fetchGate,
  fetchMyDancerEdit,
  fetchPublicExtras,
  saveMyDancerProfile,
  setFakeBackend,
} from '@/modules/dancer-app/api/rpc';
import { createFakeBackend } from '@/modules/dancer-app/api/fakeBackend';
import { CITY_MADRID, DANCER_SHAPES, DANCER_SHAPE_NAMES, isCompleteProfile, makeProfile } from '@/modules/dancer-app/api/fixtures';
import { diffDelta, isEmptyDelta } from '@/modules/dancer-app/api/delta';

afterEach(() => {
  setFakeBackend(null);
  h.rpc.mockReset();
});

/** The INTERFACE section 3 table, verbatim, plus the save contract's unknown_key. */
const INTERFACE_CODES = [
  'area_closed',
  'not_signed_in',
  'no_profile',
  'rate_limited',
  'invalid_display_name',
  'first_name_required',
  'city_required',
  'photo_required',
  'bio_too_long',
  'bio_has_link',
  'invalid_handle',
  'invalid_url',
  'invalid_year',
  'whatsapp_not_allowed',
  'invalid_role',
  'unknown_key',
];

describe('errors.ts: one map, every code', () => {
  it('types.ts lists exactly the INTERFACE codes plus `unknown`', () => {
    expect([...DANCER_ERROR_CODES].sort()).toEqual([...INTERFACE_CODES, 'unknown'].sort());
  });

  it.each([...DANCER_ERROR_CODES])('%s has its own copy', (code) => {
    const copy = copyFor(code);
    expect(copy, code).toBeTypeOf('string');
    expect(copy.length, code).toBeGreaterThan(10);
    // Copy never points at a control that may not be on screen.
    expect(copy, code).not.toMatch(/\b(tap|click|press)\b/i);
  });

  it('no two codes share copy (each tells the person something different)', () => {
    const all = DANCER_ERROR_CODES.map(copyFor);
    expect(new Set(all).size).toBe(all.length);
  });

  it('fields point at real save keys', () => {
    for (const code of DANCER_ERROR_CODES) {
      const f = fieldFor(code);
      if (f !== null) expect(SAVE_KEYS as readonly string[], code).toContain(f);
    }
  });

  it.each([
    ['area_closed', 'area_closed'],
    ['  bio_too_long  ', 'bio_too_long'],
    ['ERROR: bio_has_link (22023)', 'bio_has_link'],
    ['permission denied: area_closed', 'area_closed'],
    ['something else', 'unknown'],
    ['', 'unknown'],
    [null, 'unknown'],
    ['invalid_handle_extra', 'unknown'],
  ] as const)('codeFromMessage(%j) = %s', (msg, code) => {
    expect(codeFromMessage(msg)).toBe(code);
  });

  it('DancerApiError carries code, field and copy as message', () => {
    const e = new DancerApiError('bio_too_long', 'bio_too_long');
    expect(e.message).toBe(copyFor('bio_too_long'));
    expect(e.field).toBe('bio');
    expect(toDancerError(new Error('rate_limited')).code).toBe('rate_limited');
    expect(toDancerError('weird').code).toBe('unknown');
  });
});

describe('rpc.ts wrappers over the real backend (rpcLoose mocked)', () => {
  it('fetchGate calls dancer_area_gate_v1 and parses {open, allowed}', async () => {
    h.rpc.mockResolvedValue({ data: { open: false, allowed: true }, error: null });
    await expect(fetchGate()).resolves.toEqual({ open: false, allowed: true });
    expect(h.rpc).toHaveBeenCalledWith(DANCER_RPC.gate, undefined);
  });

  it.each([null, {}, { open: 'yes', allowed: true }, [true, true]])('fetchGate refuses an odd shape %j (fails closed)', async (data) => {
    h.rpc.mockResolvedValue({ data, error: null });
    await expect(fetchGate()).rejects.toMatchObject({ code: 'unknown' });
  });

  it('maps a server refusal to its code and copy', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'area_closed' } });
    await expect(fetchMyDancerEdit()).rejects.toMatchObject({ code: 'area_closed', message: copyFor('area_closed') });
  });

  it('a thrown network error becomes `unknown`', async () => {
    h.rpc.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(fetchGate()).rejects.toMatchObject({ code: 'unknown' });
  });

  it('save sends p_payload with only the delta', async () => {
    const profile = DANCER_SHAPES.fourFieldComplete.profile;
    h.rpc.mockResolvedValue({ data: { ...profile, bio: 'Hi' }, error: null });
    const out = await saveMyDancerProfile({ bio: 'Hi' });
    expect(h.rpc).toHaveBeenCalledWith(DANCER_RPC.save, { p_payload: { bio: 'Hi' } });
    expect(out.bio).toBe('Hi');
  });

  it('an empty delta with the current record sends NOTHING', async () => {
    const profile = DANCER_SHAPES.fourFieldComplete.profile;
    await expect(saveMyDancerProfile({}, profile)).resolves.toBe(profile);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('parses nulls into never-null arrays', async () => {
    h.rpc.mockResolvedValue({
      data: { profile_id: 'p', languages: null, favorite_styles: null, other_roles: null, strength: null },
      error: null,
    });
    const p = await fetchMyDancerEdit();
    expect(p.languages).toEqual([]);
    expect(p.favorite_styles).toEqual([]);
    expect(p.other_roles).toEqual([]);
    expect(p.strength).toEqual({ pct: 0, next_step: null, missing: [] });
  });

  it('public extras: SQL NULL -> null; shape -> parsed', async () => {
    h.rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(fetchPublicExtras('x')).resolves.toBeNull();
    h.rpc.mockResolvedValueOnce({ data: { bio: 'b', languages: ['en'], whatsapp: null }, error: null });
    await expect(fetchPublicExtras('x')).resolves.toEqual({ bio: 'b', languages: ['en'], whatsapp: null });
    expect(h.rpc).toHaveBeenLastCalledWith(DANCER_RPC.publicExtras, { p_profile_id: 'x' });
  });
});

describe('delta.ts', () => {
  const p = DANCER_SHAPES.completeAllExtras.profile;
  it('an untouched draft is an empty delta', () => {
    expect(diffDelta(p, { first_name: p.first_name, bio: p.bio, languages: [...p.languages] })).toEqual({});
    expect(isEmptyDelta(diffDelta(p, {}))).toBe(true);
  });
  it('"" equals null; whitespace is trimmed; arrays compare by content', () => {
    const blank = makeProfile();
    expect(diffDelta(blank, { bio: '', surname: '  ', languages: [] })).toEqual({});
    expect(diffDelta(p, { first_name: ` ${p.first_name} ` })).toEqual({});
    expect(diffDelta(p, { languages: ['Spanish', 'English'] })).toEqual({ languages: ['Spanish', 'English'] });
  });
  it('a real change and a clear both appear', () => {
    expect(diffDelta(p, { bio: null, dance_role: 'Leader' })).toEqual({ bio: null, dance_role: 'Leader' });
  });
});

describe('fakeBackend: the server mirror', () => {
  it('every plan section-3 shape is a named fixture', () => {
    expect(DANCER_SHAPE_NAMES).toEqual(
      expect.arrayContaining([
        'emptyStub',
        'nameCityOnly',
        'fourFieldComplete',
        'completeAllExtras',
        'adminUnclaimedPhotoless',
        'adminSurnameInDisplayName',
        'hiddenSurname',
        'claimedAdmin',
        'claimedIncompleteAdmin',
        'teacherWithWhatsapp',
        'organiserAlsoDancer',
        'paused',
        'eraseRequested',
        'archivedRetiredStub',
        'namelessProfile',
        'unconfirmedAccount',
        'authUserNoPersona',
        'bioLegacyOver280',
      ]),
    );
  });

  it.each(DANCER_SHAPE_NAMES)('%s: strength pct >= 70 <=> complete, missing in vocabulary order', (name) => {
    const p = DANCER_SHAPES[name].profile;
    if (!p) return;
    expect(p.strength.pct >= 70).toBe(p.complete);
    expect(p.complete).toBe(isCompleteProfile(p));
    expect(p.strength.missing).toEqual(STRENGTH_STEPS.filter((s) => p.strength.missing.includes(s)));
    expect(p.strength.next_step).toBe(p.strength.missing[0] ?? null);
    expect(p.strength.pct).toBeLessThanOrEqual(100);
    expect(p.whatsapp === null || p.other_roles.length > 0).toBe(true);
  });

  it('pct anchors: stub 10, four fields 70, all extras 100', () => {
    expect(DANCER_SHAPES.emptyStub.profile.strength.pct).toBe(10);
    expect(DANCER_SHAPES.fourFieldComplete.profile.strength.pct).toBe(70);
    expect(DANCER_SHAPES.completeAllExtras.profile.strength).toEqual({ pct: 100, next_step: null, missing: [] });
    // Extras without all four required fields never count (C6).
    expect(makeProfile({ first_name: 'A', dance_started_year: 2020, favorite_styles: ['x'] }).strength.pct).toBe(25);
  });

  it.each([
    ['archivedRetiredStub', 'no_profile'],
    ['authUserNoPersona', 'no_profile'],
    ['unconfirmedAccount', 'not_signed_in'],
  ] as const)('%s: my_dancer_edit refuses %s', async (shape, code) => {
    setFakeBackend(createFakeBackend({ shape, gate: { open: true, allowed: true } }));
    await expect(fetchMyDancerEdit()).rejects.toMatchObject({ code });
  });

  it('closed + unlisted: every member call refuses area_closed first', async () => {
    setFakeBackend(createFakeBackend({ gate: { open: false, allowed: false } }));
    await expect(fetchMyDancerEdit()).rejects.toMatchObject({ code: 'area_closed' });
    await expect(saveMyDancerProfile({ bio: 'x' })).rejects.toMatchObject({ code: 'area_closed' });
  });

  it('diff-first: an untouched save returns WITHOUT mutation (same object, no write, no rate slot)', async () => {
    const fake = createFakeBackend({ shape: 'completeAllExtras', rateLimit: 0 });
    setFakeBackend(fake);
    const before = fake.current();
    const out = await saveMyDancerProfile({ first_name: before?.first_name, bio: before?.bio, languages: [...(before?.languages ?? [])] });
    expect(out).toBe(before);
    expect(fake.current()).toBe(before);
    expect(fake.writes).toBe(0);
  });

  it('a real change is written once and returns the new shape', async () => {
    const fake = createFakeBackend({ shape: 'fourFieldComplete' });
    setFakeBackend(fake);
    const out = await saveMyDancerProfile({ based_city_id: CITY_MADRID.id, dance_started_year: 2018 });
    expect(out.city_name).toBe('Madrid');
    expect(out.strength.pct).toBe(80);
    expect(fake.writes).toBe(1);
  });

  it('saving the missing photo completes the profile (strength crosses 70)', async () => {
    const fake = createFakeBackend({ shape: 'claimedIncompleteAdmin' });
    setFakeBackend(fake);
    await saveMyDancerProfile({ dance_role: 'Leader' });
    const out = await saveMyDancerProfile({ avatar_url: 'https://img.example/new.jpg' });
    expect(out.complete).toBe(true);
    expect(out.strength.pct).toBe(70);
  });

  const cases: Array<[string, Record<string, unknown>, DancerErrorCode, Parameters<typeof createFakeBackend>[0]?]> = [
    ['unknown key', { email: 'x' }, 'unknown_key'],
    ['display name too long', { display_name: 'x'.repeat(41) }, 'invalid_display_name'],
    ['display name with a link', { display_name: 'see http://x' }, 'invalid_display_name'],
    ['display name with @', { display_name: 'ana@home' }, 'invalid_display_name'],
    ['clear first name', { first_name: '' }, 'first_name_required'],
    ['clear city', { based_city_id: null }, 'city_required'],
    ['unknown city', { based_city_id: 'c9999999-0000-4000-8000-000000000009' }, 'city_required'],
    ['clear photo', { avatar_url: null }, 'photo_required'],
    ['bio 281', { bio: 'x'.repeat(281) }, 'bio_too_long'],
    ['bio with www.', { bio: 'find me at www.example.com' }, 'bio_has_link'],
    ['bio with a .tld/ path', { bio: 'example.com/ana' }, 'bio_has_link'],
    ['bad instagram', { instagram: 'not a handle!' }, 'invalid_handle'],
    ['website not http', { website_url: 'ftp://x' }, 'invalid_url'],
    ['year 1949', { dance_started_year: 1949 }, 'invalid_year'],
    ['year next year', { dance_started_year: new Date().getFullYear() + 1 }, 'invalid_year'],
    ['whatsapp from a pure dancer', { whatsapp: '+447700900000' }, 'whatsapp_not_allowed'],
    ['whatsapp switch from a pure dancer', { show_whatsapp_publicly: false }, 'whatsapp_not_allowed'],
    ['role outside the CHECK set', { dance_role: 'Both' }, 'invalid_role'],
  ];
  it.each(cases)('%s -> %s, and nothing is written', async (_l, delta, code, opts) => {
    const fake = createFakeBackend(opts ?? { shape: 'fourFieldComplete' });
    setFakeBackend(fake);
    const before = fake.current();
    await expect(saveMyDancerProfile(delta as never)).rejects.toMatchObject({ code, message: copyFor(code) });
    expect(fake.writes).toBe(0);
    expect(fake.current()).toBe(before);
  });

  it('a person with another profile type may set WhatsApp', async () => {
    setFakeBackend(createFakeBackend({ shape: 'teacherWithWhatsapp' }));
    const out = await saveMyDancerProfile({ show_whatsapp_publicly: false });
    expect(out.show_whatsapp_publicly).toBe(false);
  });

  it('rate check runs only on non-empty deltas', async () => {
    const fake = createFakeBackend({ shape: 'fourFieldComplete', rateLimit: 1 });
    setFakeBackend(fake);
    await saveMyDancerProfile({ dance_started_year: 2015 });
    await saveMyDancerProfile({ dance_started_year: 2015 }); // untouched: fine
    await expect(saveMyDancerProfile({ dance_started_year: 2016 })).rejects.toMatchObject({ code: 'rate_limited' });
  });

  it('public extras: WhatsApp only with the switch on AND another profile type; null when paused', async () => {
    const teacher = createFakeBackend({ shape: 'teacherWithWhatsapp' });
    setFakeBackend(teacher);
    const id = teacher.current()!.profile_id;
    await expect(fetchPublicExtras(id)).resolves.toMatchObject({ whatsapp: '+447700900123' });
    setFakeBackend(createFakeBackend({ shape: 'paused' }));
    await expect(fetchPublicExtras(id)).resolves.toBeNull();
    setFakeBackend(createFakeBackend({ shape: 'fourFieldComplete' }));
    await expect(fetchPublicExtras('unknown-id')).resolves.toBeNull();
  });
});
