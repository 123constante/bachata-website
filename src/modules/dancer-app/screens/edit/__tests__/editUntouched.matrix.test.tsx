// @vitest-environment jsdom
/**
 * Dancer dashboard slice 1 (admin #1534, fix 5): Edit screen x every signed-in profile shape.
 * Untouched: Save is disabled WITH a visible reason, a programmatic submit sends NO command, no copy
 * points at a control that is not on screen, and every disabled control has a reason.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';

vi.mock('@/hooks/useAuth', async (importOriginal) => (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));
vi.mock('@/components/ui/city-picker', () => ({ CityPicker: () => <button type="button">City</button> }));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { createFakeBackend } from '@/modules/dancer-app/api/fakeBackend';
import { DANCER_SHAPES, DANCER_SHAPE_NAMES } from '@/modules/dancer-app/api/fixtures';
import { SAVE_REASON_UNTOUCHED } from '@/modules/dancer-app/screens/me/model';
import { disabled, pointers } from '../../../__tests__/journeyChecks';

afterEach(() => { cleanup(); resetShell(); });

const SHAPES = DANCER_SHAPE_NAMES.filter((n) => DANCER_SHAPES[n].signedIn && DANCER_SHAPES[n].profile);

describe('Edit, untouched, every profile shape', () => {
  it.each(SHAPES)('%s', async (name) => {
    const backend = createFakeBackend({ profile: DANCER_SHAPES[name].profile! });
    renderInShell({ path: '/app/me/edit', backend });
    const save = (await screen.findByTestId('edit-save', undefined, { timeout: 5000 })) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(screen.getByTestId('edit-save-reason').textContent).toBe(SAVE_REASON_UNTOUCHED);
    fireEvent.submit(screen.getByTestId('dancer-screen-edit'));
    fireEvent.click(save);
    await new Promise((r) => setTimeout(r, 20));
    expect(backend.calls.filter((c) => c.fn === 'saveMyDancerProfile')).toHaveLength(0);
    expect(pointers(document.body), 'copy points at a control that is not on screen').toEqual([]);
    expect(disabled(document.body)).toEqual([]);
  });
});
