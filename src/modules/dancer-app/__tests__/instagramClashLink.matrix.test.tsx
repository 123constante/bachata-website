// @vitest-environment jsdom
/**
 * profile-save-instagram-link: a changed Instagram handle asks the claim to link BEFORE it is written.
 * handle (unchanged, changed-new, changed-clashes) x claim status (7). Asserts call order, exact args, copy.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

const calls = vi.hoisted(() => ({ log: [] as Array<[string, unknown]>, claim: { data: null as unknown, error: null as unknown } }));
vi.mock('@/integrations/supabase/rpcLoose', () => ({
  rpcLoose: vi.fn(async (fn: string, args?: unknown) => {
    calls.log.push([fn, args]);
    if (fn === 'claim_my_dancer_profile_v1') return calls.claim;
    if (fn === 'my_dancer_edit_v1') return { data: { ...linkedProfile }, error: null };
    return { data: { ...linkedProfile, instagram: 'saved' }, error: null };
  }),
}));

import { DANCER_SHAPES } from '@/modules/dancer-app/api/fixtures';
import { saveMyDancerProfile, setFakeBackend } from '@/modules/dancer-app/api/rpc';
import { INSTAGRAM_REVIEW_COPY } from '@/modules/dancer-app/api/errors';
import { DancerApiError } from '@/modules/dancer-app/api/errors';
import type { MyDancerEdit } from '@/modules/dancer-app/api/types';

const base: MyDancerEdit = { ...DANCER_SHAPES.fourFieldComplete.profile!, instagram: 'old.handle' };
const linkedProfile = { ...base, profile_id: 'admin-1' };

beforeEach(() => { calls.log = []; setFakeBackend(null); });
afterEach(cleanup);

const CLAIM = 'claim_my_dancer_profile_v1';
const names = () => calls.log.map(([f]) => f);
const reply = (status: string | 'unavailable') => {
  calls.claim = status === 'unavailable'
    ? { data: null, error: { message: 'function not found' } }
    : { data: { ok: true, status, profile_id: status === 'linked' || status === 'already_linked' ? 'admin-1' : null }, error: null };
};

describe('unchanged handle: no claim, nothing extra', () => {
  it.each([['no instagram key', { bio: 'hi' }], ['same handle', { instagram: 'old.handle', bio: 'hi' }], ['cleared', { instagram: null }]] as const)('%s', async (_n, delta) => {
    reply('linked');
    await saveMyDancerProfile(delta as never, base);
    expect(names()).not.toContain(CLAIM);
  });
  it('an untouched save sends nothing at all', async () => {
    await saveMyDancerProfile({}, base);
    expect(calls.log).toEqual([]);
  });
});

describe.each([['changed-new', 'new.handle'], ['changed-clashes', 'taken.handle']])('handle %s', (_h, handle) => {
  it.each([
    ['linked', ['claim', 'edit', 'save']],
    ['already_linked', ['claim', 'edit', 'save']],
    ['no_match', ['claim', 'save']],
    ['email_unproven', ['claim', 'save']],
    ['not_applicable', ['claim', 'save']],
    ['unavailable', ['claim', 'save']],
  ] as const)('claim %s', async (status, order) => {
    reply(status);
    const onLinked = vi.fn(async () => { calls.log.push(['persona-refetch', null]); });
    const out = await saveMyDancerProfile({ instagram: handle, bio: 'hi' }, base, { onLinked });
    expect(out.instagram).toBe('saved');
    const map = { claim: CLAIM, edit: 'my_dancer_edit_v1', save: 'save_my_dancer_profile_v2' } as const;
    const expected = order.flatMap((k) => (k === 'edit' ? ['persona-refetch', map.edit] : [map[k]]));
    // claim first, the persona refetch before the save, the save last
    expect(names()).toEqual(expected);
    expect(calls.log[0]).toEqual([CLAIM, { p_instagram: handle }]);
    expect(calls.log[calls.log.length - 1]).toEqual(['save_my_dancer_profile_v2', { p_payload: { instagram: handle, bio: 'hi' } }]);
    expect(onLinked).toHaveBeenCalledTimes(status === 'linked' || status === 'already_linked' ? 1 : 0);
  });

  it('claim ambiguous: nothing is saved, the copy is the owner words, and it names no control', async () => {
    reply('ambiguous');
    const err = await saveMyDancerProfile({ instagram: handle, bio: 'hi' }, base).then(() => null, (e: unknown) => e as DancerApiError);
    expect(err).toBeInstanceOf(DancerApiError);
    expect(err!.code).toBe('instagram_review');
    expect(err!.message).toBe('We could not tell which profile is yours. We have asked the team to check.');
    expect(err!.message).toBe(INSTAGRAM_REVIEW_COPY);
    expect(err!.message).not.toMatch(/button|tap|click|press/i);
    expect(names()).toEqual([CLAIM]);
  });

  it('carrying on without the handle saves the rest and makes no second claim', async () => {
    reply('ambiguous');
    await saveMyDancerProfile({ bio: 'hi' }, base);
    expect(names()).toEqual(['save_my_dancer_profile_v2']);
  });
});

it('a claim that hangs behaves as unavailable', async () => {
  vi.useFakeTimers();
  calls.claim = new Promise(() => {}) as never;
  const p = saveMyDancerProfile({ instagram: 'x.y' }, base);
  await vi.advanceTimersByTimeAsync(4100);
  await p;
  vi.useRealTimers();
  expect(names()).toEqual([CLAIM, 'save_my_dancer_profile_v2']);
});
