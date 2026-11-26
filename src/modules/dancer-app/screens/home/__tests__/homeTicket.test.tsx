// @vitest-environment jsdom
/** HomeTicket: golden look (flag homeGoldenLook) draws a prototype A row unless a real ticket with a QR shows. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({ look: true, view: { kind: 'none' } as { kind: string }, retry: vi.fn() }));
vi.mock('@/lib/featureFlags', async (orig) => {
  const real = (await orig()) as { flags: Record<string, unknown> };
  return { ...real, flags: new Proxy(real.flags, { get: (t, k) => (k === 'homeGoldenLook' ? h.look : t[k as string]) }) };
});
vi.mock('../../tickets/useTicketCard', () => ({ useTicketCard: () => ({ view: h.view, retry: h.retry }) }));
vi.mock('../../tickets/TicketCard', () => ({ default: () => <section data-testid="tickets-card">card</section> }));

import HomeTicket from '../homeTicket';

const show = () => render(<MemoryRouter><HomeTicket /></MemoryRouter>);
beforeEach(() => { h.look = true; h.view = { kind: 'none' }; h.retry.mockReset(); });
afterEach(cleanup);

describe('HomeTicket', () => {
  it.each([
    ['loading', 'Getting your tickets…'],
    ['none', 'No order found yet'],
  ])('flag on, %s: one row with title, line and Open to the Tickets tab', (kind, line) => {
    h.view = { kind };
    show();
    const row = screen.getByTestId('home-c-ticket-row');
    expect(row.textContent).toContain('Your ticket');
    expect(row.textContent).toContain(line);
    expect(row.textContent).toContain('Open');
    expect(row.getAttribute('href')).toBe('/app/tickets');
    expect(screen.getByTestId('home-c-ticket')).toBeTruthy();
    expect(screen.queryByTestId('tickets-card')).toBeNull();
  });
  it('flag on, error: Try again calls retry, no navigation', () => {
    h.view = { kind: 'qr_error' };
    show();
    const row = screen.getByTestId('home-c-ticket-row');
    expect(row.textContent).toContain('Could not load your ticket');
    expect(row.getAttribute('href')).toBeNull();
    fireEvent.click(row);
    expect(h.retry).toHaveBeenCalledTimes(1);
  });
  it('flag on, real ticket: the TicketCard stays (QR on home)', async () => {
    h.view = { kind: 'tickets' };
    show();
    expect(await screen.findByTestId('tickets-card')).toBeTruthy();
    expect(screen.queryByTestId('home-c-ticket-row')).toBeNull();
  });
  it('flag off: today, the old card and no row', async () => {
    h.look = false;
    h.view = { kind: 'none' };
    show();
    expect(await screen.findByTestId('tickets-card')).toBeTruthy();
    expect(screen.queryByTestId('home-c-ticket-row')).toBeNull();
    expect(screen.getByText('Your ticket')).toBeTruthy();
  });
});
