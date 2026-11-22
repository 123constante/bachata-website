// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { createElement } from 'react';
import { doorPriceOf, payModeOf } from '../payMode';
import { TicketsView, ticketLine, type TicketRow, type TicketsViewProps } from '../TicketsV2';

afterEach(cleanup);
const t = (status: string) => ({ status });

describe('payModeOf', () => {
  it('live types win over a link', () => expect(payModeOf({ ticketTypes: [t('on_sale')], defaultTicketUrl: 'https://x.y' })).toBe('here'));
  it('a link wins over door', () => expect(payModeOf({ ticketTypes: [], defaultTicketUrl: 'https://x.y' })).toBe('link'));
  it('none = door', () => expect(payModeOf({ ticketTypes: [], defaultTicketUrl: null })).toBe('door'));
  it('blank link = door', () => expect(payModeOf({ ticketTypes: [], defaultTicketUrl: '  ' })).toBe('door'));
  it.each(['draft', 'paused', 'closed', 'sold_out'])('%s does not count', (s) => expect(payModeOf({ ticketTypes: [t(s)], defaultTicketUrl: null })).toBe('door'));
  it('stripe state never changes the mode', () => expect(payModeOf({ ticketTypes: [t('on_sale')], stripeConnected: false })).toBe('here'));
});

describe('doorPriceOf', () => {
  const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
  it('first pass price', () => expect(doorPriceOf([{ id: id(1), name: 'Entry', price: 10 }, { id: id(2), name: 'VIP', price: 20 }])).toBe(10));
  it('null when none', () => { expect(doorPriceOf(null)).toBeNull(); expect(doorPriceOf([])).toBeNull(); });
  it('null for a free-text entry', () => expect(doorPriceOf([{ id: id(1), name: 'Entry', price: null }])).toBeNull());
});

describe('ticketLine', () => {
  const now = Date.parse('2026-11-22T12:00:00Z');
  it('fixed and free', () => { expect(ticketLine(800, undefined, now)).toBe('£8'); expect(ticketLine(0, undefined, now)).toBe('Free'); });
  it('early bird', () => expect(ticketLine(1000, { steps: [{ id: 's', effectiveFrom: '2026-12-01T00:00:00Z', pricePence: 1200, isLive: false }] }, now)).toBe('£10 until Tuesday 1 December, then £12'));
  it('a live step is not a coming change', () => expect(ticketLine(1200, { steps: [{ id: 's', effectiveFrom: '2026-11-01T00:00:00Z', pricePence: 1200, isLive: true }] }, now)).toBe('£12'));
});

const row = (over: Partial<TicketRow> = {}): TicketRow => ({ id: 't1', name: 'General', line: '£10', sold: 3, pence: 3000, qty: 50, perDate: [3, 0], ...over });
const view = (over: Partial<TicketsViewProps> = {}) => render(createElement(MemoryRouter, null, createElement(TicketsView, {
  name: 'Thursdays', oneOff: false, day: 'Thursday', backTo: '/app/events/s1', stripe: true, mode: 'here', tickets: [row()],
  dates: ['Thursday 26 November', 'Thursday 3 December'], doorPrice: null, link: null, ...over,
})));

describe('TicketsView', () => {
  it('not connected: big button, line, no warning unless stripeWarn', () => {
    view({ stripe: false, mode: 'door' });
    expect(screen.getByTestId('tk-stripe').textContent).toBe('Sell tickets here');
    expect(screen.getByText(/Connect Stripe and get paid in seconds/)).toBeTruthy();
    expect(screen.queryByTestId('tk-warn')).toBeNull();
  });
  it('stripeWarn shows the box only when selling here', () => {
    view({ stripe: false, mode: 'here', stripeWarn: true });
    expect(screen.getByTestId('tk-warn').textContent).toContain('Dancers can’t buy yet.');
  });
  it('here with tickets: hint, card lines, weekly date list, footer', () => {
    view();
    expect(screen.getByTestId('tk-hint').textContent).toBe('Tap a ticket to change it.');
    expect(screen.getByTestId('tk-weekly-sub').textContent).toBe('The usual prices, for every Thursday.');
    expect(screen.getByText('3 sold across all dates, £30')).toBeTruthy();
    expect(screen.getByText('3 of 50')).toBeTruthy();
    expect(screen.getByText('Thursday 3 December')).toBeTruthy();
    expect(screen.getByTestId('tk-foot').textContent).toBe('Not selling here? Pay at the door or add a link instead.');
    expect(screen.getByTestId('tk-new').textContent).toBe('Add a ticket');
  });
  it('here without tickets', () => {
    view({ tickets: [] });
    expect(screen.getByTestId('tk-hint').textContent).toBe('No tickets yet. Add your first ticket.');
  });
  it('one-off: no weekly sub line, no date list', () => {
    view({ oneOff: true });
    expect(screen.queryByTestId('tk-weekly-sub')).toBeNull();
    expect(screen.queryByText('3 of 50')).toBeNull();
  });
  it('door: price line and both links', () => {
    view({ mode: 'door', tickets: [], doorPrice: 10 });
    expect(screen.getByTestId('tk-foot').textContent).toBe('Dancers pay £10 at the door. Change the usual price');
    expect(screen.getByTestId('tk-howPay').textContent).toBe('Change how dancers pay');
    expect(screen.getByTestId('tk-sellHere').textContent).toBe('Sell tickets here');
  });
  it('link: shows the link', () => {
    view({ mode: 'link', tickets: [], link: 'https://tix.example/x' });
    expect(screen.getByTestId('tk-foot').textContent).toBe('Dancers buy at https://tix.example/x. Change');
  });
  it('back link goes to the first screen; taps do nothing without a handler, and call one when given', () => {
    view();
    expect((screen.getByTestId('tk-back') as HTMLAnchorElement).getAttribute('href')).toBe('/app/events/s1');
    fireEvent.click(screen.getByTestId('tk-new'));
    cleanup();
    let got: string | undefined;
    view({ on: { ticket: (id) => { got = id; } } });
    fireEvent.click(screen.getByTestId('tk-ticket-t1'));
    expect(got).toBe('t1');
  });
});
