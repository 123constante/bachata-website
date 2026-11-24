// W4a keep-list: every prototype element of the winner screens, asserted.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GateScreen, { FROM_AUTH_KEY } from '../screens/GateScreen';
import WonScreen from '../screens/WonScreen';
import HonestySheet from '../screens/HonestySheet';
import StatusScreen from '../screens/StatusScreen';
import { winAuthHref } from '../model';

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);
const night = { title: 'Friday Bachata', startLocal: '2026-12-04T20:00:00', venueName: 'Bar Luna' };
const sheet = (o: Partial<React.ComponentProps<typeof HonestySheet>> = {}) => {
  const p = { night, ticked: false, busy: false, nudge: false, onTick: vi.fn(), onConfirm: vi.fn(), onBack: vi.fn(), ...o };
  render(<HonestySheet {...p} />);
  return p;
};

beforeEach(() => sessionStorage.clear());

describe('GateScreen', () => {
  it('shows every prototype line and signs in via winAuthHref', () => {
    wrap(<GateScreen token="tok1" />);
    expect(screen.getByText('Free entry · one night')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'You won a free night' })).toBeTruthy();
    expect(screen.getByText('Sealed. Sign in to open it.')).toBeTruthy();
    expect(screen.getByText('Sign in to claim it. This link works until an organiser cancels it, so keep it private.')).toBeTruthy();
    expect(screen.getByText('The first account to sign in keeps the prize. Do not forward this link.')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Sign in to claim' });
    expect(link.getAttribute('href')).toBe(winAuthHref('tok1'));
    expect(sessionStorage.getItem(FROM_AUTH_KEY)).toBeNull();
    fireEvent.click(link);
    expect(sessionStorage.getItem(FROM_AUTH_KEY)).toBe('1');
  });
});

describe('WonScreen', () => {
  it('shows every prototype line; Choose my night fires onChoose', () => {
    const onChoose = vi.fn();
    wrap(<WonScreen onChoose={onChoose} />);
    expect(screen.getByRole('heading', { name: 'You won!' })).toBeTruthy();
    expect(screen.getByText('Free entry · one night')).toBeTruthy();
    expect(screen.getByText('Free entry to a bachata night you have never been to. Pick which one.')).toBeTruthy();
    expect(screen.getByText('Night')).toBeTruthy();
    expect(screen.getByText('your pick goes here')).toBeTruthy();
    expect(screen.getByText('You are signed in, so no WhatsApp needed.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Choose my night' }));
    expect(onChoose).toHaveBeenCalledTimes(1);
  });
});

describe('HonestySheet', () => {
  it('shows the dialog, mini card, checkbox, fine print and buttons', () => {
    sheet();
    const d = screen.getByRole('dialog', { name: 'One last thing' });
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByRole('heading', { name: 'One last thing' })).toBeTruthy();
    const card = screen.getByTestId('honesty-night');
    expect(card.textContent).toContain('4');
    expect(card.textContent).toContain('Dec');
    expect(card.textContent).toContain('Friday Bachata');
    expect(card.textContent).toContain('Friday 4 Dec');
    expect(card.textContent).toContain('Bar Luna');
    expect(screen.getByRole('checkbox', { name: /I have never been to this event\./ }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('Once you lock it, only the organiser can change it.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Confirm and get my QR' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
  });
  it('tick toggles via onTick; untick confirm nudges and does not lock', () => {
    const p = sheet();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(p.onTick).toHaveBeenCalledTimes(1);
    const confirm = screen.getByRole('button', { name: 'Confirm and get my QR' });
    expect(confirm.getAttribute('aria-disabled')).toBe('true');
  });
  it('confirm without the tick calls onConfirm (parent nudges, never locks)', () => {
    const p = sheet({ ticked: false });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and get my QR' }));
    expect(p.onConfirm).toHaveBeenCalledTimes(1);
  });
  it('nudge highlights the hint as an alert', () => {
    sheet({ nudge: true });
    expect(screen.getByRole('alert').textContent).toBe('Once you lock it, only the organiser can change it.');
  });
  it('ticked: confirm is enabled and fires', () => {
    const p = sheet({ ticked: true });
    const confirm = screen.getByRole('button', { name: 'Confirm and get my QR' });
    expect(confirm.getAttribute('aria-disabled')).toBe('false');
    fireEvent.click(confirm);
    expect(p.onConfirm).toHaveBeenCalledTimes(1);
  });
  it('in flight: spinner copy, both buttons inert', () => {
    const p = sheet({ ticked: true, busy: true });
    const locking = screen.getByRole('button', { name: /Locking your night/ });
    expect(locking.textContent).toContain('Locking your night…');
    expect(locking.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(locking);
    expect(p.onConfirm).not.toHaveBeenCalled();
    const back = screen.getByRole('button', { name: 'Back' }) as HTMLButtonElement;
    expect(back.disabled).toBe(true);
    fireEvent.click(back);
    expect(p.onBack).not.toHaveBeenCalled();
    expect((screen.getByRole('checkbox') as HTMLButtonElement).disabled).toBe(true);
  });
  it('Back closes (selection kept by the parent)', () => {
    const p = sheet();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(p.onBack).toHaveBeenCalledTimes(1);
  });
});

describe('StatusScreen', () => {
  it('none: copy and Check again', () => {
    const onAction = vi.fn();
    wrap(<StatusScreen kind="none" onAction={onAction} />);
    expect(screen.getByRole('heading', { name: 'No nights open right now' })).toBeTruthy();
    expect(screen.getByText('Check back soon. Your prize is kept.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
  it('error: copy, Retry, no lock line', () => {
    const onAction = vi.fn();
    wrap(<StatusScreen kind="error" onAction={onAction} />);
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeTruthy();
    expect(screen.getByText('Check your connection and try again.')).toBeTruthy();
    expect(screen.queryByText('If your night did lock, Retry brings up your QR.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
  it('error after lock failure adds the QR line', () => {
    wrap(<StatusScreen kind="error" afterLock onAction={() => {}} />);
    expect(screen.getByText('If your night did lock, Retry brings up your QR.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });
  it.each([
    ['other', 'Already claimed', 'This prize was claimed by a different account. Message the organiser if that was not you.'],
    ['cancel', 'This link is no longer valid', 'The organiser cancelled this prize. Message them if you think this is a mistake.'],
  ] as const)('%s: copy and See what is on goes to events home', (kind, h, p) => {
    wrap(<StatusScreen kind={kind} />);
    expect(screen.getByRole('heading', { name: h })).toBeTruthy();
    expect(screen.getByText(p)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'See what is on' }).getAttribute('href')).toBe('/');
  });
});
