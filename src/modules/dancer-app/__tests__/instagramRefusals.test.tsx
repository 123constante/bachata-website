// @vitest-environment jsdom
/**
 * instagram-refusal r2, commit C: the Instagram refusals of save_my_dancer_profile_v2,
 * explained under the Instagram field of the /app Edit screen.
 * - invalid_handle (v2, DETAIL instagram) and invalid_instagram (trigger, 22023): the owner's invalid words.
 * - 23505 on dancer_profiles_instagram_normalized_uidx: `instagram_taken`, the owner's taken words.
 *   Matched on the index name in the message (api/rpc.ts keeps only the message); another index stays unknown.
 * api/errors.ts is the ONE owner of these words for the dancer path.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';

const rpc = vi.hoisted(() => ({ result: { data: null as unknown, error: null as unknown } }));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: vi.fn(async () => rpc.result) }));
vi.mock('@/hooks/useAuth', async (importOriginal) => (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));
vi.mock('@/components/ui/city-picker', () => ({ CityPicker: () => <button type="button">City</button> }));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { createFakeBackend } from '@/modules/dancer-app/api/fakeBackend';
import { DANCER_SHAPES } from '@/modules/dancer-app/api/fixtures';
import { saveMyDancerProfile, setFakeBackend } from '@/modules/dancer-app/api/rpc';
import { DancerApiError, codeFromMessage, copyFor, fieldFor } from '@/modules/dancer-app/api/errors';
import { checkInstagramField } from '@/lib/instagramHandle';
import type { MyDancerEdit } from '@/modules/dancer-app/api/types';

afterEach(() => { cleanup(); resetShell(); rpc.result = { data: null, error: null }; });

// The owner's words (brief r2, decision 4), copied so a drifted constant fails here.
const INVALID = 'Enter your Instagram handle (like @yourname) or a full instagram.com link.';
const TAKEN = 'That Instagram is already on another profile. Check the spelling, or message us if it is yours.';
const dup = (index: string) => `duplicate key value violates unique constraint "${index}"`;
const IG_DUP = dup('dancer_profiles_instagram_normalized_uidx');
const SLUG_DUP = dup('dancer_profiles_slug_uidx');

const base: MyDancerEdit = { ...DANCER_SHAPES.fourFieldComplete.profile!, instagram: null };

describe('the ONE map (api/errors.ts)', () => {
  it.each([
    ['invalid_instagram (trigger 22023)', 'invalid_instagram', null, INVALID, 'instagram'],
    ['invalid_handle, DETAIL instagram (v2)', 'invalid_handle', 'instagram', INVALID, 'instagram'],
    ['invalid_handle, DETAIL facebook still says Facebook', 'invalid_handle', 'facebook',
      'That does not look like a valid Facebook handle. Use letters, numbers, dots or underscores.', 'facebook'],
    ['instagram_taken', 'instagram_taken', null, TAKEN, 'instagram'],
  ] as const)('%s', (_n, code, detail, words, field) => {
    expect(copyFor(code, detail)).toBe(words);
    expect(fieldFor(code, detail)).toBe(field);
  });

  it.each([
    ['23505 on the Instagram index', IG_DUP, 'instagram_taken'],
    ['23505 on the slug index stays unknown', SLUG_DUP, 'unknown'],
    ['23505 on an unnamed constraint stays unknown', 'duplicate key value violates unique constraint', 'unknown'],
    ['the trigger code', 'invalid_instagram', 'invalid_instagram'],
  ] as const)('codeFromMessage: %s', (_n, message, code) => {
    expect(codeFromMessage(message)).toBe(code);
  });

  it('the field check says the same words for a link that is not an instagram.com profile link', () => {
    for (const raw of ['https://m.instagram.com/simon', 'https://example.com/simon']) {
      expect(checkInstagramField(raw)).toEqual({ ok: false, error: INVALID });
    }
  });
});

describe('through the real call() (PostgREST-shaped error)', () => {
  const save = async () => {
    setFakeBackend(null);
    return saveMyDancerProfile({ instagram: 'simon.bachata' }, base).then(
      () => { throw new Error('expected a refusal'); },
      (e: unknown) => e as DancerApiError,
    );
  };
  it.each([
    ['23505 on dancer_profiles_instagram_normalized_uidx', { code: '23505', message: IG_DUP, details: 'Key (instagram_normalized)=(simon.bachata) already exists.' }, 'instagram_taken', 'instagram', TAKEN],
    ['23505 on dancer_profiles_slug_uidx', { code: '23505', message: SLUG_DUP, details: 'Key (slug)=(simon) already exists.' }, 'unknown', null, copyFor('unknown')],
    ['22023 invalid_instagram', { code: '22023', message: 'invalid_instagram', details: null }, 'invalid_instagram', 'instagram', INVALID],
    ['22023 invalid_handle DETAIL instagram', { code: '22023', message: 'invalid_handle', details: 'instagram' }, 'invalid_handle', 'instagram', INVALID],
  ] as const)('%s', async (_n, error, code, field, words) => {
    rpc.result = { data: null, error };
    const e = await save();
    expect(e).toBeInstanceOf(DancerApiError);
    expect([e.code, e.field, e.message]).toEqual([code, field, words]);
  });
});

describe('the Edit screen puts it under Instagram', () => {
  const open = async (thrown: () => DancerApiError) => {
    const backend = createFakeBackend({ profile: base });
    backend.saveMyDancerProfile = async () => {
      throw thrown();
    };
    renderInShell({ path: '/app/me/edit', backend });
    await screen.findByTestId('edit-save', undefined, { timeout: 5000 });
    return backend;
  };

  it.each([
    ['taken (23505 on the Instagram index)', () => new DancerApiError(codeFromMessage(IG_DUP), IG_DUP), TAKEN],
    ['invalid_instagram', () => new DancerApiError('invalid_instagram', 'invalid_instagram'), INVALID],
    ['invalid_handle DETAIL instagram', () => new DancerApiError('invalid_handle', 'invalid_handle', 'instagram'), INVALID],
  ] as const)('%s', async (_n, thrown, words) => {
    await open(thrown);
    fireEvent.change(document.querySelector('#instagram input, input#instagram')!, { target: { value: 'simon.bachata' } });
    fireEvent.click(screen.getByTestId('edit-save'));
    await waitFor(() => expect(screen.getByTestId('error-instagram').textContent).toBe(words));
    expect(screen.queryByTestId('edit-top-error')).toBeNull();
  });

  it('a 23505 on another index is NOT shown as the Instagram message: it goes to the top', async () => {
    await open(() => new DancerApiError(codeFromMessage(SLUG_DUP), SLUG_DUP));
    fireEvent.change(document.querySelector('#instagram input, input#instagram')!, { target: { value: 'simon.bachata' } });
    fireEvent.click(screen.getByTestId('edit-save'));
    await waitFor(() => expect(screen.getByTestId('edit-top-error').textContent).toContain(copyFor('unknown')));
    expect(screen.queryByTestId('error-instagram')).toBeNull();
  });

  it('untouched: Save is off and nothing is sent', async () => {
    const backend = createFakeBackend({ profile: base });
    renderInShell({ path: '/app/me/edit', backend });
    await screen.findByTestId('edit-save', undefined, { timeout: 5000 });
    expect((screen.getByTestId('edit-save') as HTMLButtonElement).disabled).toBe(true);
    expect(backend.calls.filter((c) => c.fn === 'saveMyDancerProfile')).toEqual([]);
  });
});
