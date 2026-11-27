// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { TOAST_PLAIN_MS, V2Toast } from '../V2Toast';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('V2Toast timer', () => {
  it('re-renders with a new inline onDone do not restart the timer', () => {
    const calls: number[] = [];
    const toast = { seq: 7, text: 'Saved' };
    const { rerender } = render(<V2Toast toast={toast} onDone={(q) => { calls.push(q); }} />);
    expect(screen.getByTestId('v2-toast').textContent).toBe('Saved');
    for (let i = 0; i < 4; i += 1) {
      act(() => { vi.advanceTimersByTime(TOAST_PLAIN_MS / 5); });
      rerender(<V2Toast toast={toast} onDone={(q) => { calls.push(q); }} />);
    }
    expect(calls).toEqual([]);
    act(() => { vi.advanceTimersByTime(TOAST_PLAIN_MS / 5 + 1); });
    expect(calls).toEqual([7]);
  });
  it('calls the latest onDone', () => {
    const first = vi.fn();
    const second = vi.fn();
    const toast = { seq: 1, text: 'Saved' };
    const { rerender } = render(<V2Toast toast={toast} onDone={first} />);
    rerender(<V2Toast toast={toast} onDone={second} />);
    act(() => { vi.advanceTimersByTime(TOAST_PLAIN_MS); });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(1);
  });
});
