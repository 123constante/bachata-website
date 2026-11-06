// @vitest-environment jsdom
/**
 * A failed save also shows its message under the Save button (edit-save-error), so a person on a
 * weak connection sees it where they tapped. The top card (edit-top-error, with Try again) stays.
 * Table: network failure / HTTP 500 / field error / success / untouched.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';

vi.mock('@/hooks/useAuth', async (importOriginal) => (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));
vi.mock('@/components/ui/city-picker', () => ({ CityPicker: () => <button type="button">City</button> }));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { createFakeBackend } from '@/modules/dancer-app/api/fakeBackend';
import { DANCER_SHAPES } from '@/modules/dancer-app/api/fixtures';
import { DancerApiError } from '@/modules/dancer-app/api/errors';

afterEach(() => {
  cleanup();
  resetShell();
  vi.restoreAllMocks();
});

const complete = DANCER_SHAPES.fourFieldComplete.profile!;
const saves = (b: ReturnType<typeof createFakeBackend>) => b.calls.filter((c) => c.fn === 'saveMyDancerProfile');

type Mode = 'network' | 'http500' | 'field' | 'success' | 'untouched';
const build = (mode: Mode) => {
  const backend = createFakeBackend({ profile: complete });
  const real = backend.saveMyDancerProfile.bind(backend);
  if (mode === 'network') backend.saveMyDancerProfile = async (d) => { await real(d); throw new TypeError('Failed to fetch'); };
  if (mode === 'http500') backend.saveMyDancerProfile = async (d) => { await real(d); throw new Error('HTTP 500 Internal Server Error'); };
  // A server code that names a field (stand-in for the Instagram-taken 23505): placed under the field.
  if (mode === 'field') backend.saveMyDancerProfile = async (d) => { await real(d); throw new DancerApiError('invalid_instagram', 'invalid_instagram'); };
  return backend;
};

const edit = async (mode: Mode) => {
  const backend = build(mode);
  renderInShell({ path: '/app/me/edit', backend });
  const bio = (await screen.findByLabelText(/about me/i, undefined, { timeout: 5000 })) as HTMLTextAreaElement;
  if (mode !== 'untouched') fireEvent.change(bio, { target: { value: `${bio.value} more` } });
  fireEvent.click(screen.getByTestId('edit-save'));
  return { backend, bio };
};

describe('save error at the Save button', () => {
  it.each([
    ['network', true, true, 1],
    ['http500', true, true, 1],
    ['field', false, false, 1],
    ['success', false, false, 1],
    ['untouched', false, false, 0],
  ] as const)('%s: line=%s top=%s saves=%s', async (mode, line, top, n) => {
    const { backend } = await edit(mode);
    if (line || top) await screen.findByTestId('edit-top-error').catch(() => screen.findByTestId('edit-save-error'));
    else await waitFor(() => expect(saves(backend)).toHaveLength(n));
    await new Promise((r) => setTimeout(r, 20));
    expect(!!screen.queryByTestId('edit-save-error')).toBe(line);
    expect(!!screen.queryByTestId('edit-top-error')).toBe(top);
    expect(saves(backend)).toHaveLength(n);
    if (mode === 'field') expect(screen.getByTestId('error-instagram')).toBeTruthy();
    if (line) {
      const el = screen.getByTestId('edit-save-error');
      expect(el.getAttribute('role')).toBe('alert');
      expect(el.textContent).toBe(screen.getByTestId('edit-top-error').querySelector('p')!.textContent);
      expect(screen.getByTestId('edit-retry')).toBeTruthy();
      expect(screen.getAllByText('Try again')).toHaveLength(1);
      expect(el.className).toMatch(/min-h-\[44px\]/);
    }
  });

  it('the line clears on the next edit', async () => {
    const { bio } = await edit('network');
    await screen.findByTestId('edit-save-error');
    fireEvent.change(bio, { target: { value: 'again' } });
    expect(screen.queryByTestId('edit-save-error')).toBeNull();
  });

  it('the line clears when Save is tapped again', async () => {
    const { backend } = await edit('network');
    await screen.findByTestId('edit-save-error');
    backend.saveMyDancerProfile = async () => new Promise(() => {}); // stays in flight
    fireEvent.click(screen.getByTestId('edit-save'));
    await waitFor(() => expect(screen.queryByTestId('edit-save-error')).toBeNull());
  });

  it('scrolls the Save area into view only when it is off screen, and never moves focus', async () => {
    const scroll = vi.fn();
    (Element.prototype as unknown as { scrollIntoView: unknown }).scrollIntoView = scroll;
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect');
    const save = (top: number) => rect.mockImplementation(function (this: HTMLElement) {
      return { top, bottom: top + 100, left: 0, right: 0, width: 0, height: 100, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
    });
    save(5000);
    const { bio } = await edit('network');
    bio.focus();
    await screen.findByTestId('edit-save-error');
    await waitFor(() => expect(scroll).toHaveBeenCalled());
    expect(document.activeElement).toBe(bio);
  });

  it('does not scroll when the Save area is already on screen', async () => {
    const scroll = vi.fn();
    (Element.prototype as unknown as { scrollIntoView: unknown }).scrollIntoView = scroll;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      () => ({ top: 100, bottom: 200, left: 0, right: 0, width: 0, height: 100, x: 0, y: 100, toJSON: () => ({}) }) as DOMRect,
    );
    await edit('network');
    await screen.findByTestId('edit-save-error');
    expect(scroll).not.toHaveBeenCalled();
  });
});
