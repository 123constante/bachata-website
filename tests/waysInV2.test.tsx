// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { EventWorkspace } from '@/modules/organiser/events/eventModel';
import { WaysInView, withMethod, type WaysInViewProps } from '@/modules/organiser/p3/v2/WaysIn';

afterEach(cleanup);

const ws = (payment_methods: string | null, format = 'recurring') =>
  ({ series: { id: 's1', format, name: 'Thursdays', payment_methods } }) as unknown as EventWorkspace;

describe('withMethod', () => {
  it('adds a code', () => expect(withMethod(ws('ticket_link'), 'door', true)).toBe('ticket_link,door'));
  it('removes a code', () => expect(withMethod(ws('ticket_link,door'), 'door', false)).toBe('ticket_link'));
  it('keeps cash and bank_transfer', () => expect(withMethod(ws('door,bank_transfer,cash'), 'free', true)).toBe('door,bank_transfer,cash,free'));
  it('keeps cash when removing another code', () => expect(withMethod(ws('door,cash'), 'door', false)).toBe('cash'));
  it('never duplicates a code', () => expect(withMethod(ws('door,door'), 'door', true)).toBe('door'));
  it('null stored', () => {
    expect(withMethod(ws(null), 'door', true)).toBe('door');
    expect(withMethod(ws(null), 'door', false)).toBe('');
  });
});

const base: WaysInViewProps = {
  name: 'Thursdays', oneOff: true, day: 'Thursday', backTo: '/e', stripe: true, stripeReady: true, tickets: [], dates: [],
  door: false, free: false, link: null, festival: false,
};
const ticket = (id: string) => ({ id, name: `Ticket ${id}`, line: '£8', sold: 1, pence: 800, qty: 10, perDate: [], early: null });
const view = (p: Partial<WaysInViewProps> = {}) => render(<MemoryRouter><WaysInView {...base} {...p} /></MemoryRouter>);

describe('WaysInView', () => {
  it('title and sub', () => {
    view();
    expect(screen.getByTestId('wi-title').textContent).toBe('Ways in');
    expect(screen.getByTestId('wi-sub').textContent).toBe('How dancers get in. Pick at least one.');
  });
  it('Stripe loading: no Connect button', () => {
    view({ stripe: false, stripeReady: false });
    expect(screen.getByTestId('tk-loading')).toBeTruthy();
    expect(screen.queryByTestId('tk-stripe')).toBeNull();
  });
  it('not connected: Sell tickets here and the new warn', () => {
    const f = vi.fn();
    view({ stripe: false, stripeWarn: true, on: { stripe: f } });
    fireEvent.click(screen.getByTestId('tk-stripe'));
    expect(f).toHaveBeenCalled();
    expect(screen.getByTestId('tk-warn').textContent).toContain('tick another way in');
  });
  it('connected with 0 tickets: Add a ticket only', () => {
    const f = vi.fn();
    view({ on: { newTicket: f } });
    fireEvent.click(screen.getByTestId('tk-new'));
    expect(f).toHaveBeenCalled();
    expect(screen.queryAllByTestId(/^tk-ticket-/)).toHaveLength(0);
  });
  it('connected with 2 tickets: both cards, tap passes the id', () => {
    const f = vi.fn();
    view({ tickets: [ticket('a'), ticket('b')], on: { ticket: f } });
    expect(screen.getAllByTestId(/^tk-ticket-/)).toHaveLength(2);
    fireEvent.click(screen.getByTestId('tk-ticket-b'));
    expect(f).toHaveBeenCalledWith('b');
  });
  it('door ticked: aria-checked, sub, no price field; tap calls door', () => {
    const f = vi.fn();
    view({ door: true, on: { door: f } });
    const d = screen.getByTestId('wi-door');
    expect(d.getAttribute('role')).toBe('checkbox');
    expect(d.getAttribute('aria-checked')).toBe('true');
    expect(d.textContent).toContain('Dancers see Pay at the door.');
    expect(d.textContent).not.toMatch(/£/);
    fireEvent.click(d);
    expect(f).toHaveBeenCalled();
  });
  it('free toggles', () => {
    const f = vi.fn();
    view({ on: { free: f } });
    expect(screen.getByTestId('wi-free').getAttribute('aria-checked')).toBe('false');
    fireEvent.click(screen.getByTestId('wi-free'));
    expect(f).toHaveBeenCalled();
  });
  it('link: Add a link when none, the URL when set', () => {
    view();
    expect(screen.getByTestId('wi-link').textContent).toContain('Add a link');
    cleanup();
    const f = vi.fn();
    view({ link: 'https://x.test/t', on: { link: f } });
    expect(screen.getByTestId('wi-link').textContent).toContain('https://x.test/t');
    fireEvent.click(screen.getByTestId('wi-link'));
    expect(f).toHaveBeenCalled();
  });
  it('festival hides door and free, keeps the link', () => {
    view({ festival: true });
    expect(screen.queryByTestId('wi-door')).toBeNull();
    expect(screen.queryByTestId('wi-free')).toBeNull();
    expect(screen.getByTestId('wi-link')).toBeTruthy();
  });
  it('festival series: withMethod drops a stored door', () => {
    expect(withMethod(ws('door,ticket_link', 'festival'), 'ticket_link', true)).toBe('ticket_link');
  });
});
