// @vitest-environment jsdom
/**
 * instagram-refusal r2 fix1 (review F2): the two EditScreen ?returnTo= guards, each with a test.
 * (a) A save that comes back after a NEWER keystroke stays on the editor: leaving would throw that
 *     typing away (kills review mutant P7, navigate unconditionally). Control: the same held save
 *     with no newer typing does leave, so the hold is not what keeps it on the editor.
 * (b) ?returnTo= pointing at the editor itself does not self-loop (kills P5, drop the exclude).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';

vi.mock('@/hooks/useAuth', async (importOriginal) => (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));
vi.mock('@/components/ui/city-picker', () => ({ CityPicker: () => <button type="button">City</button> }));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { createFakeBackend, type FakeDancerBackend } from '@/modules/dancer-app/api/fakeBackend';
import { DANCER_SHAPES } from '@/modules/dancer-app/api/fixtures';

afterEach(() => { cleanup(); resetShell(); });

const REVIEW = '/account/p3/start?o=o1&at=review';
const EDIT_BACK = `/app/me/edit?focus=instagram&returnTo=${encodeURIComponent(REVIEW)}`;

/** A backend whose save waits until release() is called. */
function heldBackend(): { backend: FakeDancerBackend; release: () => void; sent: () => number } {
  const backend = createFakeBackend({ profile: DANCER_SHAPES.fourFieldComplete.profile! });
  const real = backend.saveMyDancerProfile.bind(backend);
  let open: () => void = () => {};
  const gate = new Promise<void>((r) => { open = r; });
  let sent = 0;
  backend.saveMyDancerProfile = async (delta) => { sent += 1; await gate; return real(delta); };
  return { backend, release: () => open(), sent: () => sent };
}

const instagramBox = () => waitFor(() => {
  const el = document.querySelector<HTMLInputElement>('#instagram');
  expect(el).not.toBeNull();
  return el!;
});

describe('EditScreen ?returnTo=: a save leaves only when nothing newer was typed', () => {
  it('control: a held save with no newer typing goes back to returnTo when it returns', async () => {
    const { backend, release, sent } = heldBackend();
    const { location } = renderInShell({ path: EDIT_BACK, backend });
    fireEvent.change(await instagramBox(), { target: { value: 'sam.dances' } });
    fireEvent.click(screen.getByTestId('edit-save'));
    await waitFor(() => expect(sent()).toBe(1));
    expect(location()).toBe(EDIT_BACK);
    await act(async () => { release(); });
    await waitFor(() => expect(location()).toBe(REVIEW));
  });

  it('save, then a newer keystroke before the save returns: the editor stays and keeps the newer input', async () => {
    const { backend, release, sent } = heldBackend();
    const { location } = renderInShell({ path: EDIT_BACK, backend });
    const box = await instagramBox();
    fireEvent.change(box, { target: { value: 'sam.dances' } });
    fireEvent.click(screen.getByTestId('edit-save'));
    await waitFor(() => expect(sent()).toBe(1));
    fireEvent.change(box, { target: { value: 'sam.dances.more' } });
    await act(async () => { release(); });
    await waitFor(() => expect(backend.current()?.instagram).toBe('sam.dances'));
    // Give onSuccess time to run (the control above leaves well inside this).
    await act(async () => { await new Promise((r) => setTimeout(r, 200)); });
    expect(location()).toBe(EDIT_BACK);
    expect((document.querySelector('#instagram') as HTMLInputElement).value).toBe('sam.dances.more');
  });
});

describe('EditScreen ?returnTo= pointing at the editor itself', () => {
  it('?returnTo=%2Fapp%2Fme%2Fedit does not self-loop: Save stays exactly where it was', async () => {
    const path = '/app/me/edit?returnTo=%2Fapp%2Fme%2Fedit';
    const { location, backend } = renderInShell({ path, backend: { profile: DANCER_SHAPES.fourFieldComplete.profile! } });
    fireEvent.change(await instagramBox(), { target: { value: 'sam.dances' } });
    fireEvent.click(screen.getByTestId('edit-save'));
    await waitFor(() => expect(backend.current()?.instagram).toBe('sam.dances'));
    await screen.findAllByText('Your changes are live.');
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(location()).toBe(path);
  });
});
