// @vitest-environment jsdom
/**
 * Going P2 settings switch "Show my photo when I'm going" (show_going_photo, OFF by
 * default), saved through the existing profile save (save_my_dancer_profile_v2,
 * absent key = unchanged). Table-driven: default off / stored on x untouched /
 * toggled / toggled twice x the going switch. An untouched save sends no
 * show_going_photo key (and the screen sends nothing at all for an untouched form).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({ on: true }));
vi.mock('@/lib/goingCheckin', () => ({ get GOING_CHECKIN_ENABLED() { return h.on; } }));
vi.mock('@/hooks/useAuth', async (importOriginal) => (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));
vi.mock('@/components/ui/city-picker', () => ({ CityPicker: () => <button type="button">City</button> }));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { createFakeBackend } from '@/modules/dancer-app/api/fakeBackend';
import { DANCER_SHAPES } from '@/modules/dancer-app/api/fixtures';
import { parseMyDancerEdit } from '@/modules/dancer-app/api/rpc';
import { buildDelta, draftFromProfile } from '@/modules/dancer-app/screens/me/model';
import { GOING_COPY } from '@/modules/going';

beforeEach(() => { h.on = true; });
afterEach(() => { cleanup(); resetShell(); });

const complete = DANCER_SHAPES.fourFieldComplete.profile!;

describe('show_going_photo: the read', () => {
  it.each([
    ['absent (older server)', {}, false],
    ['false', { show_going_photo: false }, false],
    ['true', { show_going_photo: true }, true],
    ['junk', { show_going_photo: 'yes' }, false],
  ] as const)('%s -> %s (OFF unless the server says true)', (_n, over, want) => {
    expect(parseMyDancerEdit({ profile_id: 'p', ...over }).show_going_photo).toBe(want);
  });
});

describe('show_going_photo: the delta (one rule, buildDelta)', () => {
  it.each([
    ['default off, untouched', false, [], null],
    ['default off, toggled on', false, [true], true],
    ['default off, on then off again', false, [true, false], null],
    ['stored on, untouched', true, [], null],
    ['stored on, toggled off', true, [false], false],
  ] as const)('%s', (_n, stored, steps, sent) => {
    const p = { ...complete, show_going_photo: stored };
    const d = draftFromProfile(p);
    for (const v of steps) d.show_going_photo = v;
    const delta = buildDelta(p, d);
    if (sent === null) expect('show_going_photo' in delta).toBe(false);
    else expect(delta).toEqual({ show_going_photo: sent });
  });

  it('switch off: the key is never sent, even from a changed draft', () => {
    h.on = false;
    const d = draftFromProfile(complete);
    d.show_going_photo = true;
    expect(buildDelta(complete, d)).toEqual({});
  });
});

describe('the Edit screen switch', () => {
  it('default OFF, with its one line, a 44px+ explicit-px control and an accessible name', async () => {
    renderInShell({ path: '/app/me/edit', backend: { profile: { ...complete, show_going_photo: false } } });
    const sw = await screen.findByRole('switch', { name: GOING_COPY.photoSwitchLabel });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(sw.className).toMatch(/h-\[44px\]/);
    expect(sw.className).toMatch(/w-\[56px\]/);
    const line = document.getElementById(sw.getAttribute('aria-describedby')!);
    expect(line?.textContent).toBe(GOING_COPY.photoSwitchLine);
  });

  it('untouched: Save stays off with its reason, nothing is sent', async () => {
    const backend = createFakeBackend({ profile: complete });
    renderInShell({ path: '/app/me/edit', backend });
    await screen.findByRole('switch', { name: GOING_COPY.photoSwitchLabel });
    expect((screen.getByTestId('edit-save') as HTMLButtonElement).disabled).toBe(true);
    expect(backend.calls.filter((c) => c.fn === 'saveMyDancerProfile')).toEqual([]);
  });

  it('toggled on: Save sends ONLY { show_going_photo: true }', async () => {
    const backend = createFakeBackend({ profile: complete });
    renderInShell({ path: '/app/me/edit', backend });
    const sw = await screen.findByRole('switch', { name: GOING_COPY.photoSwitchLabel });
    fireEvent.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('true');
    const save = screen.getByTestId('edit-save') as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() => expect(backend.calls.filter((c) => c.fn === 'saveMyDancerProfile')).toHaveLength(1));
    expect(backend.calls.find((c) => c.fn === 'saveMyDancerProfile')?.args).toEqual({ show_going_photo: true });
  });

  it('toggled twice: back to untouched, Save is off again', async () => {
    renderInShell({ path: '/app/me/edit', backend: { profile: complete } });
    const sw = await screen.findByRole('switch', { name: GOING_COPY.photoSwitchLabel });
    fireEvent.click(sw);
    fireEvent.click(sw);
    expect((screen.getByTestId('edit-save') as HTMLButtonElement).disabled).toBe(true);
  });

  it('going switch off: the photo switch is not on screen', async () => {
    h.on = false;
    renderInShell({ path: '/app/me/edit', backend: { profile: complete } });
    await screen.findByTestId('edit-save');
    expect(screen.queryByTestId('edit-going-photo')).toBeNull();
    expect(screen.queryByRole('switch', { name: GOING_COPY.photoSwitchLabel })).toBeNull();
  });
});
