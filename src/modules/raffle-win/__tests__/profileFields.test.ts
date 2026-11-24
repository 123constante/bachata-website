import { describe, expect, it } from 'vitest';
import { PROFILE_STEP_ORDER, introLineFor, missingProfileFields, stepCount, type ProfileField } from '../profileFields';
import { parseLock } from '../model';

const full = { avatar_url: 'https://x/a.png', first_name: 'Maya', dance_role: 'Lead and Follow', based_city_id: 'c1', nationality: 'ES', languages: ['en'] };

describe('missingProfileFields', () => {
  it('none empty', () => expect(missingProfileFields(full)).toEqual([]));
  it.each(PROFILE_STEP_ORDER)('%s empty alone', (f) => {
    expect(missingProfileFields({ ...full, [f]: f === 'languages' ? null : null })).toEqual([f]);
    expect(missingProfileFields({ ...full, [f]: f === 'languages' ? [] : '  ' })).toEqual([f]);
  });
  it('all empty, in step order', () => {
    expect(missingProfileFields({})).toEqual([...PROFILE_STEP_ORDER]);
    expect(missingProfileFields(null)).toEqual([...PROFILE_STEP_ORDER]);
  });
  it('order is fixed', () => {
    expect(PROFILE_STEP_ORDER).toEqual(['avatar_url', 'first_name', 'dance_role', 'based_city_id', 'nationality', 'languages']);
  });
});

describe('introLineFor / stepCount', () => {
  const m: ProfileField[] = ['avatar_url'];
  it('new account', () => expect(introLineFor({ isNewAccount: true, missing: m })).toBe('We need a few details before we can give you your QR.'));
  it('existing account', () => expect(introLineFor({ isNewAccount: false, missing: m })).toBe('Almost there. We need a few more details.'));
  it('nothing missing', () => {
    expect(introLineFor({ isNewAccount: true, missing: [] })).toBeNull();
    expect(introLineFor({ isNewAccount: false, missing: [] })).toBeNull();
  });
  it('count', () => { expect(stepCount([])).toBe(0); expect(stepCount([...PROFILE_STEP_ORDER])).toBe(6); });
});

describe('parseLock reasons', () => {
  it('new reason', () => expect(parseLock({ ok: false, reason: 'profile_incomplete', missing: ['nationality'] })).toEqual({ kind: 'profile', missing: ['nationality'] }));
  it('unknown reason unchanged', () => expect(parseLock({ ok: false, reason: 'weird' })).toEqual({ kind: 'error' }));
});
