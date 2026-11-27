// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const net = vi.hoisted(() => ({ set: vi.fn() }));
vi.mock('../../../shared/selfServeApi', () => ({
  dateDetailQueryKey: (id: string) => ['d', id],
  setNightNoDoor: (id: string, v: boolean) => net.set(id, v),
}));
import { SkipDoorSheet } from '../SkipDoorSheet';
import { getGate, closeGate, subscribeGate } from '../../onboarding/gate';

const dates = [
  { id: 'a', label: 'Saturday 6 December', noDoor: false },
  { id: 'b', label: 'Saturday 13 December', noDoor: true },
  { id: 'c', label: 'Saturday 20 December', noDoor: false },
];
const show = () => {
  const onClose = vi.fn(); const onSaved = vi.fn();
  render(<QueryClientProvider client={new QueryClient()}><SkipDoorSheet dates={dates} onClose={onClose} onSaved={onSaved} /></QueryClientProvider>);
  return { onClose, onSaved };
};
beforeEach(() => { net.set.mockReset().mockResolvedValue(undefined); });
afterEach(() => { cleanup(); closeGate(); });

describe('SkipDoorSheet', () => {
  it('renders the title, sub line and every date', () => {
    show();
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('Skip the door on one night');
    expect(screen.getByText(/Pick the nights with no/).textContent).toContain('“Pay at the door”');
    for (const d of dates) expect(screen.getByText(d.label)).toBeTruthy();
  });
  it('ticks reflect noDoor', () => {
    show();
    expect(screen.getByTestId('skip-door-a').getAttribute('aria-checked')).toBe('false');
    expect(screen.getByTestId('skip-door-b').getAttribute('aria-checked')).toBe('true');
  });
  it('Done writes only the changed dates, then closes', async () => {
    const { onClose, onSaved } = show();
    fireEvent.click(screen.getByTestId('skip-door-a'));
    fireEvent.click(screen.getByTestId('skip-door-b'));
    fireEvent.click(screen.getByTestId('skip-door-done'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(net.set.mock.calls).toEqual([['a', true], ['b', false]]);
    expect(onSaved).toHaveBeenCalledWith(2);
  });
  it('a failed write keeps the sheet open with the line and the ticks', async () => {
    net.set.mockRejectedValueOnce(new Error('x'));
    const { onClose } = show();
    fireEvent.click(screen.getByTestId('skip-door-c'));
    fireEvent.click(screen.getByTestId('skip-door-done'));
    expect((await screen.findByTestId('skip-door-err')).textContent).toBe('Could not save. Try again.');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('skip-door-c').getAttribute('aria-checked')).toBe('true');
  });
  it('an onboarding refusal opens the gate, shows no error line, keeps the ticks', async () => {
    const unsub = subscribeGate(() => {});
    net.set.mockRejectedValueOnce({ message: 'onboarding_incomplete', details: '{"missing":["photo"],"organiser_id":"o1"}' });
    const { onClose } = show();
    fireEvent.click(screen.getByTestId('skip-door-c'));
    fireEvent.click(screen.getByTestId('skip-door-done'));
    await waitFor(() => expect(getGate()).not.toBeNull());
    await waitFor(() => expect((screen.getByTestId('skip-door-done') as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByTestId('skip-door-err')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('skip-door-c').getAttribute('aria-checked')).toBe('true');
    unsub();
  });
  it('busy disables the cards and Done', async () => {
    net.set.mockReturnValue(new Promise(() => {}));
    show();
    fireEvent.click(screen.getByTestId('skip-door-a'));
    fireEvent.click(screen.getByTestId('skip-door-done'));
    await waitFor(() => expect((screen.getByTestId('skip-door-done') as HTMLButtonElement).disabled).toBe(true));
    expect((screen.getByTestId('skip-door-a') as HTMLButtonElement).disabled).toBe(true);
  });
});
