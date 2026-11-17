// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BUZZ, ConfirmSheet, V2Toast, vibrate } from '../feedback';

afterEach(() => { cleanup(); vi.useRealTimers(); delete (navigator as { vibrate?: unknown }).vibrate; });

describe('vibrate: a feature check, nothing depends on it', () => {
  it('no navigator.vibrate: a no-op that says false', () => expect(vibrate('tap')).toBe(false));
  it('a throwing vibrate never throws', () => {
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: () => { throw new Error('nope'); } });
    expect(vibrate('error')).toBe(false);
  });
  it.each([['tap', 10], ['error', [30, 60, 30]]] as const)('%s buzzes %j', (kind, pattern) => {
    const fn = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: fn });
    expect(vibrate(kind)).toBe(true);
    expect(fn).toHaveBeenCalledWith(pattern);
    expect(BUZZ[kind]).toEqual(pattern);
  });
});

describe('ConfirmSheet: one sentence, one action, Cancel', () => {
  it('renders exactly two buttons besides the sheet close, and wires them', () => {
    const go = vi.fn(); const cancel = vi.fn();
    render(<div className="p3-theme"><ConfirmSheet title="Close the raffle?" sentence="Nobody else can enter." action="Close the raffle" onConfirm={go} onCancel={cancel} /></div>);
    const box = screen.getByTestId('v2-confirm');
    expect(box.querySelectorAll('p').length).toBe(1);
    expect(box.querySelectorAll('button').length).toBe(2);
    fireEvent.click(screen.getByTestId('v2-confirm-go'));
    fireEvent.click(screen.getByTestId('v2-confirm-cancel'));
    expect(go).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it('busy: both locked', () => {
    render(<ConfirmSheet title="t" sentence="s" action="Go" busy onConfirm={() => undefined} onCancel={() => undefined} />);
    expect((screen.getByTestId('v2-confirm-go') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('v2-confirm-cancel') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('V2Toast: no Undo, closes itself', () => {
  it('has no Undo and closes after its time', () => {
    vi.useFakeTimers();
    const close = vi.fn();
    render(<V2Toast text="Saved" onClose={close} ms={1000} />);
    expect(screen.getByTestId('v2-toast').textContent).not.toMatch(/undo/i);
    vi.advanceTimersByTime(1000);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
