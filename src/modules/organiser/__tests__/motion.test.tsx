// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Collapse, SHAKE_CLASS, useShake } from '../ui';

function mockReducedMotion(reduce: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: reduce && q.includes('reduce'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('Collapse', () => {
  it('animates height and opacity to 0, then unmounts and reports it', () => {
    mockReducedMotion(false);
    const onExited = vi.fn();
    const { rerender } = render(<Collapse show testId="c"><p>Ana Ruiz</p></Collapse>);
    rerender(<Collapse show={false} onExited={onExited} testId="c"><p>Ana Ruiz</p></Collapse>);
    const el = screen.getByTestId('c');
    expect(el.style.height).toBe('0px');
    expect(el.style.opacity).toBe('0');
    expect(el.style.transition).toContain('300ms ease-in-out');
    expect(el.getAttribute('data-state')).toBe('closing');
    act(() => vi.advanceTimersByTime(400));
    expect(screen.queryByTestId('c')).toBeNull();
    expect(onExited).toHaveBeenCalledTimes(1);
  });
  it('unmounts at once under reduced motion', () => {
    mockReducedMotion(true);
    const onExited = vi.fn();
    const { rerender } = render(<Collapse show testId="c"><p>x</p></Collapse>);
    rerender(<Collapse show={false} onExited={onExited} testId="c"><p>x</p></Collapse>);
    expect(screen.queryByTestId('c')).toBeNull();
    expect(onExited).toHaveBeenCalledTimes(1);
  });
  it('renders nothing when mounted hidden, and expands when shown', () => {
    mockReducedMotion(false);
    const { rerender } = render(<Collapse show={false} testId="c"><p>x</p></Collapse>);
    expect(screen.queryByTestId('c')).toBeNull();
    rerender(<Collapse show testId="c"><p>x</p></Collapse>);
    expect(screen.getByTestId('c').style.opacity).toBe('1');
    act(() => vi.advanceTimersByTime(400));
    expect(screen.getByTestId('c').style.height).toBe('');
  });
});

function ShakeHarness() {
  const { shake, shakeProps } = useShake();
  return (
    <div>
      <button onClick={shake}>save</button>
      <div data-testid="target" {...shakeProps} />
    </div>
  );
}

describe('useShake', () => {
  it('adds the shake class on failure and clears it at animation end', () => {
    mockReducedMotion(false);
    render(<ShakeHarness />);
    fireEvent.click(screen.getByText('save'));
    act(() => vi.advanceTimersByTime(20));
    const t = screen.getByTestId('target');
    expect(t.className).toBe(SHAKE_CLASS);
    // jsdom has no AnimationEvent, so React listens for the webkit-prefixed name.
    act(() => {
      t.dispatchEvent(new Event('animationend', { bubbles: true }));
      t.dispatchEvent(new Event('webkitAnimationEnd', { bubbles: true }));
    });
    expect(t.className).toBe('');
  });
  it('never shakes under reduced motion', () => {
    mockReducedMotion(true);
    render(<ShakeHarness />);
    fireEvent.click(screen.getByText('save'));
    act(() => vi.advanceTimersByTime(20));
    expect(screen.getByTestId('target').className).toBe('');
  });
});
