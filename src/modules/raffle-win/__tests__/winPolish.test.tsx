// @vitest-environment jsdom
// Raffle win polish: keep-list with the flag on and off.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const flagState = vi.hoisted(() => ({ on: false }));
vi.mock('@/lib/featureFlags', () => ({ flags: { get raffleWinPolish() { return flagState.on; } } }));

import GateScreen from '../screens/GateScreen';
import WonScreen from '../screens/WonScreen';
import StatusScreen from '../screens/StatusScreen';
import { EventCard } from '../pick/EventCard';

afterEach(cleanup);
beforeEach(() => { flagState.on = false; });
const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);
const ev = (posterUrl: string | null) => ({ key: 'k', title: 'Friday Bachata', venueName: 'Bar Luna', posterUrl, dates: [] }) as never;
const card = (posterUrl: string | null) =>
  render(<EventCard event={ev(posterUrl)} open={false} selection={null} onToggle={vi.fn()} onPickDate={vi.fn()} />);

describe.each([false, true])('flag %s keeps every control', (on) => {
  beforeEach(() => { flagState.on = on; });
  it('gate', () => {
    wrap(<GateScreen token="t" />);
    expect(screen.getByText('Free entry · one night')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'You won a free night' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign in to claim' })).toBeTruthy();
    expect(screen.getByText('The first account to sign in keeps the prize. Do not forward this link.')).toBeTruthy();
    expect(screen.queryByText('Why sign in?') !== null).toBe(on);
  });
  it('won', () => {
    const onChoose = vi.fn();
    render(<WonScreen onChoose={onChoose} />);
    expect(screen.getByText('You won!')).toBeTruthy();
    expect(screen.getByText('You are signed in, so no WhatsApp needed.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Choose my night' }));
    expect(onChoose).toHaveBeenCalled();
    expect(screen.queryByText('Your photo is how the venue recognises you at the door.') !== null).toBe(on);
    expect(screen.queryByText(/agree to your photo/) !== null).toBe(!on);
  });
  it.each(['other', 'cancel'] as const)('status %s', (kind) => {
    wrap(<StatusScreen kind={kind} />);
    expect(screen.getByRole('link', { name: 'See what is on' })).toBeTruthy();
    expect(screen.queryByTestId('win-message-organiser') !== null).toBe(on);
  });
  it('status none has no contact button', () => {
    wrap(<StatusScreen kind="none" />);
    expect(screen.getByRole('button', { name: 'Check again' })).toBeTruthy();
    expect(screen.queryByTestId('win-message-organiser')).toBeNull();
  });
  it('event card keeps title and venue', () => {
    card('https://x/p.jpg');
    expect(screen.getByText('Friday Bachata')).toBeTruthy();
    expect(screen.getByText('Bar Luna')).toBeTruthy();
  });
});

describe('flag on', () => {
  beforeEach(() => { flagState.on = true; });
  it('message button is a mailto', () => {
    wrap(<StatusScreen kind="other" />);
    expect(screen.getByTestId('win-message-organiser').getAttribute('href')).toMatch(/^mailto:/);
  });
  it('flyer missing or broken shows initials', () => {
    card(null);
    expect(screen.getByTestId('pick-flyer-fallback').textContent).toBe('FB');
    cleanup();
    const { container } = card('https://x/bad.jpg');
    fireEvent.error(container.querySelector('img')!);
    expect(screen.getByTestId('pick-flyer-fallback').textContent).toBe('FB');
  });
});
