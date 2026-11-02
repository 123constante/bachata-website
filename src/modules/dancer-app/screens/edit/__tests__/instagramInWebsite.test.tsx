// @vitest-environment jsdom
/**
 * instagram-refusal r2, commit B (owner decision 2): an instagram.com PROFILE link typed
 * into Website moves to Instagram on save, in ONE save_my_dancer_profile_v2 call.
 * Table: Website value x Instagram value -> the delta sent + the message under Website.
 * Only a Website the person touched moves (N6); handles compare normalised.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';

vi.mock('@/hooks/useAuth', async (importOriginal) => (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));
vi.mock('@/components/ui/city-picker', () => ({ CityPicker: () => <button type="button">City</button> }));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { createFakeBackend } from '@/modules/dancer-app/api/fakeBackend';
import { DANCER_SHAPES } from '@/modules/dancer-app/api/fixtures';
import { saveMyDancerProfile, setFakeBackend } from '@/modules/dancer-app/api/rpc';
import { copyFor } from '@/modules/dancer-app/api/errors';
import type { MyDancerEdit } from '@/modules/dancer-app/api/types';
import { buildDelta, draftFromProfile, validateDraft } from '@/modules/dancer-app/screens/me/model';

afterEach(() => { cleanup(); resetShell(); });

// The owner's words (brief r2, Commit B), copied here so a drifted constant fails the test.
const CONFLICT = 'This looks like an Instagram link. Your Instagram is already set, so remove it here or replace your Instagram.';
const OLD_SITE = 'https://old.example.com';
const base = DANCER_SHAPES.fourFieldComplete.profile!;
const person = (over: Partial<MyDancerEdit>): MyDancerEdit => ({ ...base, website_url: OLD_SITE, ...over });

const WEBSITES = [
  ['profile link', 'https://instagram.com/simon.bachata', 'move'],
  ['www profile link', 'https://www.instagram.com/simon.bachata', 'move'],
  ['m. link (not a profile link by the field rule: stays)', 'https://m.instagram.com/simon.bachata', 'stay'],
  ['query string + trailing slash, mixed case', 'https://www.instagram.com/Simon.Bachata/?igsh=abc123', 'move'],
  ['/p/ post link (stays)', 'https://www.instagram.com/p/Cxyz123/', 'stay'],
  ['scheme-less instagram.com/x', 'instagram.com/simon.bachata', 'move'],
  ['https non-instagram site', 'https://simonbachata.com', 'stay'],
  ['plain site, no scheme', 'simonbachata.com', 'invalid'],
  ['bare word (not a link: never read as a name)', 'simon.bachata', 'invalid'],
  ['empty (clears Website)', '', 'stay'],
] as const;

const INSTAGRAMS = [
  ['Instagram empty', null, 'empty'],
  ['same handle (stored as @Simon.Bachata)', '@Simon.Bachata', 'same'],
  ['different handle', 'other.dancer', 'different'],
] as const;

const cells = WEBSITES.flatMap(([wn, website, wk]) => INSTAGRAMS.map(([inn, ig, ik]) => [`${wn} x ${inn}`, website, wk, ig, ik] as const));

describe('Website value x Instagram value -> what is sent, what Website says', () => {
  it.each(cells)('%s', (_n, website, wk, ig, ik) => {
    const p = person({ instagram: ig });
    const d = { ...draftFromProfile(p), website_url: website };
    const delta = buildDelta(p, d);
    const errors = validateDraft(d, p);
    const typed = website.trim() === '' ? null : website;
    if (wk === 'move' && ik === 'empty') {
      expect(delta).toEqual({ instagram: 'simon.bachata', website_url: null });
      expect(errors).toEqual({});
    } else if (wk === 'move' && ik === 'same') {
      expect(delta).toEqual({ website_url: null });
      expect(errors).toEqual({});
    } else if (wk === 'move') {
      expect(errors.website_url).toBe(CONFLICT);
      expect(delta.instagram).toBeUndefined();
    } else if (wk === 'invalid') {
      expect(delta).toEqual({ website_url: typed });
      expect(errors).toEqual({ website_url: copyFor('invalid_url', 'website_url') });
    } else {
      expect(delta).toEqual({ website_url: typed });
      expect(errors).toEqual({});
    }
  });
});

describe('only a Website the person touched moves (N6)', () => {
  const simon = person({ instagram: null, website_url: 'https://www.instagram.com/simon.bachata/' });
  it('a stored Instagram link left untouched: an untouched save sends nothing, no error', () => {
    const d = draftFromProfile(simon);
    expect(buildDelta(simon, d)).toEqual({});
    expect(validateDraft(d, simon)).toEqual({});
  });
  it('a stored Instagram link untouched while another field changes: only that field is sent', () => {
    const d = { ...draftFromProfile(simon), bio: 'Bachata in London' };
    expect(buildDelta(simon, d)).toEqual({ bio: 'Bachata in London' });
  });
  it('the same person retyping the link: it moves', () => {
    const d = { ...draftFromProfile(simon), website_url: 'https://instagram.com/simon.bachata' };
    expect(buildDelta(simon, d)).toEqual({ instagram: 'simon.bachata', website_url: null });
  });
  it('the Instagram box typed in the same draft is what the link is compared with', () => {
    const p = person({ instagram: null });
    const d = { ...draftFromProfile(p), instagram: 'another.name', website_url: 'https://instagram.com/simon.bachata' };
    expect(validateDraft(d, p).website_url).toBe(CONFLICT);
  });
  it('a stored Website of null with a moved link sends only Instagram (no null for an already-empty column)', () => {
    const p = person({ instagram: null, website_url: null });
    const d = { ...draftFromProfile(p), website_url: 'https://instagram.com/simon.bachata' };
    expect(buildDelta(p, d)).toEqual({ instagram: 'simon.bachata' });
  });
});

describe('the save wrapper (save_my_dancer_profile_v2)', () => {
  it('a pure dancer: a WhatsApp key is dropped, the move is sent whole', async () => {
    const p = person({ instagram: null, other_roles: [] });
    const backend = createFakeBackend({ profile: p });
    setFakeBackend(backend);
    const next = await saveMyDancerProfile({ instagram: 'simon.bachata', website_url: null, whatsapp: '+447700900123' }, p);
    expect(backend.calls.filter((c) => c.fn === 'saveMyDancerProfile').map((c) => c.args)).toEqual([{ instagram: 'simon.bachata', website_url: null }]);
    expect(next.instagram).toBe('simon.bachata');
    expect(next.website_url).toBeNull();
  });
});

describe('the Edit screen', () => {
  const open = async (p: MyDancerEdit) => {
    const backend = createFakeBackend({ profile: p });
    renderInShell({ path: '/app/me/edit', backend });
    await screen.findByTestId('edit-save', undefined, { timeout: 5000 });
    return backend;
  };
  const saves = (b: ReturnType<typeof createFakeBackend>) => b.calls.filter((c) => c.fn === 'saveMyDancerProfile');

  it('move: one save, then Instagram holds the name and Website is empty', async () => {
    const backend = await open(person({ instagram: null }));
    fireEvent.change(document.getElementById('website_url')!, { target: { value: 'https://www.instagram.com/simon.bachata/' } });
    expect(screen.getByTestId('note-website_url').textContent).toMatch(/Instagram/);
    fireEvent.click(screen.getByTestId('edit-save'));
    await waitFor(() => expect(saves(backend)).toHaveLength(1));
    expect(saves(backend)[0].args).toEqual({ instagram: 'simon.bachata', website_url: null });
    await waitFor(() => expect((document.getElementById('website_url') as HTMLInputElement).value).toBe(''));
    expect((document.querySelector('#instagram input, input#instagram') as HTMLInputElement).value).toBe('simon.bachata');
  });

  it('different handle: Save is off and the owner wording is under Website; nothing is sent', async () => {
    const backend = await open(person({ instagram: 'other.dancer' }));
    fireEvent.change(document.getElementById('website_url')!, { target: { value: 'https://instagram.com/simon.bachata' } });
    expect(screen.getByTestId('error-website_url').textContent).toBe(CONFLICT);
    expect((screen.getByTestId('edit-save') as HTMLButtonElement).disabled).toBe(true);
    expect(saves(backend)).toEqual([]);
  });

  it('untouched: Save is off, nothing is sent', async () => {
    const backend = await open(person({ instagram: null, website_url: 'https://www.instagram.com/simon.bachata/' }));
    expect((screen.getByTestId('edit-save') as HTMLButtonElement).disabled).toBe(true);
    expect(saves(backend)).toEqual([]);
  });

  it('v2 invalid_url on Website: the refusal is shown under Website', async () => {
    const backend = await open(person({ instagram: null }));
    fireEvent.change(document.getElementById('website_url')!, { target: { value: 'https://simonbachata.com' } });
    backend.failNextWith('invalid_url');
    fireEvent.click(screen.getByTestId('edit-save'));
    await waitFor(() => expect(screen.getByTestId('error-website_url').textContent).toBe(copyFor('invalid_url')));
  });
});
