// @vitest-environment jsdom
/** W5b-2: primitives promoted into ui/ (Field, FIELD_CLASS, useDebounced) and the ErrorState primary retry. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { ErrorState, Field, FIELD_CLASS, useDebounced } from '../ui';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Field', () => {
  it('labels its input, shows help, and reads an error out', () => {
    const { rerender } = render(<Field label="Name" htmlFor="n" help="Your public name"><input id="n" className={FIELD_CLASS} /></Field>);
    expect(screen.getByLabelText('Name')).toBeTruthy();
    expect(screen.getByTestId('n-help').textContent).toBe('Your public name');
    rerender(<Field label="Name" htmlFor="n" help="Your public name" error="Give a name."><input id="n" /></Field>);
    expect(screen.getByRole('alert').textContent).toBe('Give a name.');
    expect(screen.queryByText('Your public name')).toBeNull();
  });
});

describe('useDebounced', () => {
  it('settles after the wait', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebounced(v, 250), { initialProps: { v: 'a' } });
    rerender({ v: 'ab' });
    expect(result.current).toBe('a');
    act(() => { vi.advanceTimersByTime(250); });
    expect(result.current).toBe('ab');
  });
});

describe('ErrorState retry', () => {
  it('is the cream primary by default and a ghost when quiet', () => {
    render(<ErrorState onRetry={() => {}} testId="a" />);
    expect(screen.getByTestId('a-retry').className).toContain('bg-[var(--btn)]');
    cleanup();
    render(<ErrorState quiet onRetry={() => {}} testId="b" />);
    expect(screen.getByTestId('b-retry').className).toContain('bg-[var(--card2)]');
  });
});
