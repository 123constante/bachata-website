// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { YoureIn, YOURE_IN_ROWS } from '../neon/YoureIn';
import { boom } from '../neon/neonConfetti';

const media = (reduce: boolean) => vi.stubGlobal('matchMedia', () => ({ matches: reduce, addEventListener() {}, removeEventListener() {} }));

beforeEach(() => {
  vi.useFakeTimers();
  media(false);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('YoureIn', () => {
  it('shows the keep-list copy and no buttons', () => {
    render(<YoureIn firstName="Ana" onDone={vi.fn()} />);
    expect(screen.getByRole('heading').textContent).toBe('You’re in, Ana! \u{1F389}');
    expect(screen.getByTestId('youre-in-sub').textContent).toBe('Welcome to the London bachata scene.');
    expect(screen.getAllByTestId('youre-in-row').map((r) => r.textContent)).toEqual(YOURE_IN_ROWS.map((r) => `${r.emoji}${r.title}${r.sub}`));
    expect(screen.getByTestId('youre-in-bar').textContent).toContain('Make your profile shine');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('advances after 2000ms, not before', () => {
    const done = vi.fn();
    render(<YoureIn firstName="Ana" onDone={done} />);
    act(() => void vi.advanceTimersByTime(1999));
    expect(done).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(done).toHaveBeenCalledTimes(1);
  });
});

describe('neon confetti', () => {
  it('small burst makes 28 pieces, big makes 90 plus the banner, both removed later', () => {
    expect(boom(false)).toBe(28);
    expect(document.querySelectorAll('[data-piece]')).toHaveLength(28);
    act(() => void vi.advanceTimersByTime(3200));
    expect(document.querySelectorAll('[data-piece]')).toHaveLength(0);
    expect(boom(true)).toBe(90);
    expect(screen.getByTestId('neon-banner').textContent).toBe('PROFILE COMPLETE!');
    act(() => void vi.advanceTimersByTime(3200));
    expect(screen.queryByTestId('neon-banner')).toBeNull();
  });

  it('reduced motion: zero pieces, banner still shows', () => {
    media(true);
    expect(boom(false)).toBe(0);
    expect(boom(true)).toBe(0);
    expect(document.querySelectorAll('[data-piece]')).toHaveLength(0);
    expect(screen.getByTestId('neon-banner')).toBeTruthy();
  });
});
