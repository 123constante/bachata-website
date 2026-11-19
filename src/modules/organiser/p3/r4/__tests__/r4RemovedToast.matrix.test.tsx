// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { RemovedToast } from '../r4Notices';

afterEach(() => { cleanup(); vi.useRealTimers(); });

const WORDS = 'Removed from your events.';
const mount = (state: unknown) => {
  const router = createMemoryRouter([{ path: '/account/p3/events', element: <RemovedToast /> }], { initialEntries: [{ pathname: '/account/p3/events', state }] });
  render(<RouterProvider router={router} />);
  return router;
};

describe('R4 Events: "Removed from your events." after Remove', () => {
  it('shows once as a status line, 44px tall, after a Remove', () => {
    mount({ p3Toast: WORDS });
    const t = screen.getByRole('status');
    expect(t.textContent).toBe(WORDS);
  });
  it('is not shown on a plain visit', () => {
    mount(null);
    expect(screen.queryByRole('status')).toBeNull();
  });
  it.each([[''], ['   '], [42], [{}]])('ignores a carried value that is not words: %j', (v) => {
    mount({ p3Toast: v });
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('drops the words from the history entry, so Back and reload do not repeat them', () => {
    const router = mount({ p3Toast: WORDS });
    expect(router.state.location.state).toBeNull();
    cleanup();
    render(<RouterProvider router={router} />);
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('goes away after a few seconds', () => {
    vi.useFakeTimers();
    mount({ p3Toast: WORDS });
    expect(screen.getByRole('status')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(6100); });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
