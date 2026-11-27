// @vitest-environment jsdom
/** Sneak peek (brief C1): the real Home, visible and inert. Exact copy, lock behaviour, toast timing. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../../../api/useMyNumbers', () => ({ useMyNumbers: () => ({ data: { went: 0 } }) }));
vi.mock('../../../analytics/events', () => ({ trackDancerEvent: () => false }));
vi.mock('../homeGoing', () => ({ default: () => null }));
vi.mock('../homeRaffleWin', () => ({ default: () => null }));
vi.mock('../RateNudge', () => ({ RateNudge: () => null }));
vi.mock('../homeOptionA', () => ({
  HomeAView: () => (
    <div>
      <a href="/app/nights" data-testid="item-link" onClick={() => h.fired.push('link')}>Nights</a>
      <button type="button" data-testid="item-btn" onClick={() => h.fired.push('btn')}>Go</button>
    </div>
  ),
}));

const h = vi.hoisted(() => ({ fired: [] as string[] }));

import { LockedHome, LOCKED_TOAST_TEXT, TOAST_MS } from '../lockedMode';
import { makeProfile } from '../../../api/fixtures';
import { APP_WELCOME_PATH } from '@/lib/accountRouting';

const Where = () => <div data-testid="where">{useLocation().pathname}</div>;
const mount = (onFinish?: () => void) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/app/welcome?step=peek']}>
        <Routes>
          <Route path="*" element={<><LockedHome profile={makeProfile({ first_name: 'Ana' })} onFinish={onFinish} /><Where /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
const toast = () => screen.getByTestId('peek-toast');

beforeEach(() => { vi.useFakeTimers(); h.fired = []; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('LockedHome', () => {
  it('keeps the exact copy', () => {
    mount();
    expect(screen.getByTestId('peek-title').textContent).toBe('Hi Ana \u{1F44B}');
    expect(screen.getByTestId('peekbar').textContent).toContain('Almost there, Ana');
    expect(screen.getByTestId('peekbar').textContent).toContain('Add a photo, years dancing and styles to unlock everything.');
    expect(screen.getByText('Finish my profile')).toBeTruthy();
    expect(toast().textContent).toContain('\u{1F512} Finish your profile to unlock this');
    expect(LOCKED_TOAST_TEXT).toBe('\u{1F512} Finish your profile to unlock this');
  });

  it('a locked click neither navigates nor fires the item handler, and shakes it', () => {
    mount();
    const link = screen.getByTestId('item-link');
    fireEvent.click(link);
    fireEvent.click(screen.getByTestId('item-btn'));
    expect(h.fired).toEqual([]);
    expect(screen.getByTestId('where').textContent).toBe('/app/welcome');
    expect(link.classList.contains('shake')).toBe(true);
  });

  it('shows the toast, hides it after 2200ms, and a repeat tap restarts the timer', () => {
    mount();
    expect(TOAST_MS).toBe(2200);
    expect(toast().style.opacity).toBe('0');
    fireEvent.click(screen.getByTestId('item-btn'));
    expect(toast().style.opacity).toBe('1');
    act(() => { vi.advanceTimersByTime(2000); });
    fireEvent.click(screen.getByTestId('item-btn'));
    act(() => { vi.advanceTimersByTime(2000); });
    expect(toast().style.opacity).toBe('1');
    act(() => { vi.advanceTimersByTime(300); });
    expect(toast().style.opacity).toBe('0');
  });

  it('Finish (toast) and Finish my profile both go to the flow', () => {
    const onFinish = vi.fn();
    mount(onFinish);
    fireEvent.click(screen.getByTestId('peek-toast-finish'));
    fireEvent.click(screen.getByTestId('peek-finish'));
    expect(onFinish).toHaveBeenCalledTimes(2);
  });

  it('defaults Finish to the /app/welcome flow', () => {
    mount();
    fireEvent.click(screen.getByTestId('peek-finish'));
    expect(screen.getByTestId('where').textContent).toBe(APP_WELCOME_PATH);
  });

  it('applies no blur filter', () => {
    mount();
    const root = screen.getByTestId('locked-home');
    for (const el of [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]) {
      expect(el.style.filter).toBe('');
    }
  });
});
