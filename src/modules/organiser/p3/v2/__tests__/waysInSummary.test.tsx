// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WaysInSummaryView, untilWords, type SummaryTicket, type WaysInSummaryViewProps } from '../WaysInSummary';
import { soldKeep } from '../copy';
import { NOT_SWITCHED_ON } from '../../../tickets/ticketModel';

afterEach(cleanup);

const NOW = Date.parse('2026-11-27T10:00:00Z');
const tk = (o: Partial<SummaryTicket> = {}): SummaryTicket => ({ id: 't1', name: 'Entry', line: '', sold: 0, pence: 0, qty: 100, perDate: [], pricePence: 1000, ...o });
const view = (o: Partial<WaysInSummaryViewProps> = {}) => {
  const on = { ticket: vi.fn(), early: vi.fn(), newTicket: vi.fn(), door: vi.fn(), link: vi.fn(), free: vi.fn(), stripe: vi.fn(), skipDoor: vi.fn(), rerun: vi.fn() };
  render(<MemoryRouter><WaysInSummaryView name="Thursday Social" oneOff={false} day="Thursday" backTo="/x" stripe tickets={[tk()]} door={false} free={false} link={null} festival={false} now={NOW} on={on} {...o} /></MemoryRouter>);
  return on;
};
const text = (id: string) => screen.getByTestId(`ws-text-${id}`).textContent;
const has = (id: string) => screen.queryByTestId(`ws-${id}`) !== null;

describe('wi-page margin + nudge style', () => {
  it('root carries wi-page and the nudge is orange', () => {
    view({ stripe: false, tickets: [], door: true });
    expect(screen.getByTestId('ways-in-summary').className).toContain('wi-page');
    expect(screen.getByTestId('ws-stripe-nudge').style.color).toBe('rgb(194, 65, 12)');
  });
});

describe('WaysInSummaryView lines', () => {
  it('header: back, title, sub, weekly line', () => {
    view();
    expect(screen.getByTestId('ws-back').textContent).toBe('← Thursday Social');
    expect(screen.getByTestId('ws-title').textContent).toBe('Tickets');
    expect(screen.getByTestId('ws-sub').textContent).toBe('What dancers see.');
    expect(screen.getByTestId('ws-weekly-sub').textContent).toBe('The usual prices, for every Thursday.');
  });
  it('one-off has no weekly line and says tickets', () => {
    view({ oneOff: true });
    expect(screen.queryByTestId('ws-weekly-sub')).toBeNull();
    expect(text('ticket-t1')).toBe('Online £10, 100 tickets');
  });
  it('weekly one ticket: a night', () => { view(); expect(text('ticket-t1')).toBe('Online £10, 100 a night'); });
  it('two tickets use the names', () => {
    view({ tickets: [tk(), tk({ id: 't2', name: 'VIP', pricePence: 1500, qty: 20 })] });
    expect(text('ticket-t1')).toBe('Entry £10, 100 a night');
    expect(text('ticket-t2')).toBe('VIP £15, 20 a night');
  });
  it('sold 0 shows nothing, sold 12 shows 12 sold', () => {
    view();
    expect(screen.queryByTestId('ws-sold-ticket-t1')).toBeNull();
    cleanup();
    view({ tickets: [tk({ sold: 12 })] });
    expect(screen.getByTestId('ws-sold-ticket-t1').textContent).toBe('12 sold');
  });
  it('date early bird: near uses the weekday, far adds the date (the last early day)', () => {
    view({ tickets: [tk({ pricePence: 800, nextStep: { pricePence: 1000, effectiveFrom: '2026-12-02T00:00:00Z' } })] });
    expect(text('ticket-t1')).toBe('Online £10, 100 a night');
    expect(text('early-t1')).toBe('Early buyers £8 until Tuesday');
    cleanup();
    view({ tickets: [tk({ pricePence: 800, nextStep: { pricePence: 1000, effectiveFrom: '2026-12-06T00:00:00Z' } })] });
    expect(text('early-t1')).toBe('Early buyers £8 until Saturday 5 December');
    expect(untilWords('2026-12-04T12:00:00Z', NOW)).toBe('Friday 4 December');
  });
  // P94: walk draft b9a36466 stored price_pence 800 + step 1200 from 1 Dec; the summary showed "Online £8" / "Early buyers £12 until Tuesday"
  it('P94 date early bird: main is the step price, early is today\'s price, until the day before the step', () => {
    view({ tickets: [tk({ pricePence: 800, nextStep: { pricePence: 1200, effectiveFrom: '2026-12-01T00:00:00Z' } })] });
    expect(text('ticket-t1')).toBe('Online £12, 100 a night');
    expect(text('early-t1')).toBe('Early buyers £8 until Monday');
  });
  it('P94 summer step (BST midnight) still names the London day before', () => {
    view({ now: Date.parse('2027-06-01T10:00:00Z'), tickets: [tk({ pricePence: 800, nextStep: { pricePence: 1200, effectiveFrom: '2027-06-04T23:00:00Z' } })] });
    expect(text('early-t1')).toBe('Early buyers £8 until Friday');
  });
  it('P94 several coming steps: the main price is the last one', () => {
    view({ tickets: [tk({ pricePence: 600, nextStep: { pricePence: 900, effectiveFrom: '2026-12-01T00:00:00Z' }, mainPence: 1200 })] });
    expect(text('ticket-t1')).toBe('Online £12, 100 a night');
    expect(text('early-t1')).toBe('Early buyers £6 until Monday');
  });
  it('a step DOWN is no early bird: today\'s price, no early line', () => {
    view({ tickets: [tk({ pricePence: 1200, nextStep: { pricePence: 800, effectiveFrom: '2026-12-01T00:00:00Z' } })] });
    expect(text('ticket-t1')).toBe('Online £12, 100 a night');
    expect(has('early-t1')).toBe(false);
  });
  it('a past step shows no early line and today\'s price', () => {
    view({ tickets: [tk({ pricePence: 800, nextStep: { pricePence: 1200, effectiveFrom: '2026-11-01T00:00:00Z' } })] });
    expect(text('ticket-t1')).toBe('Online £8, 100 a night');
    expect(has('early-t1')).toBe(false);
  });
  it('count early bird', () => {
    view({ tickets: [tk({ early: { pill: 'Early bird 4 left', price: '' }, earlyPence: 800, earlyFirst: 20 })] });
    expect(text('early-t1')).toBe('Early buyers £8, first 20');
  });
  it('door on / off', () => {
    view({ door: true }); expect(text('door')).toBe('Pay at the door');
    cleanup(); view(); expect(has('door')).toBe(false);
  });
  it('link and free', () => {
    view({ link: 'https://x.test/t', free: true });
    expect(text('link')).toBe('Your ticket site: https://x.test/t');
    expect(text('free')).toBe('Free entry');
    cleanup(); view(); expect(has('link')).toBe(false); expect(has('free')).toBe(false);
  });
  it('festival hides door, free and skip-door', () => {
    view({ festival: true, door: true, free: true, link: 'https://x.test' });
    expect(has('door')).toBe(false); expect(has('free')).toBe(false); expect(has('skip-door')).toBe(false); expect(has('link')).toBe(true);
  });
  it('skip-door: weekly with door only', () => {
    view({ door: true }); expect(text('skip-door')).toBe('Skip the door on one night'); expect(screen.getByTestId('ws-skip-door').textContent).toBe('Choose');
    cleanup(); view({ door: true, oneOff: true }); expect(has('skip-door')).toBe(false);
    cleanup(); view({ door: false }); expect(has('skip-door')).toBe(false);
  });
  it('rerun row', () => { view(); expect(text('rerun')).toBe('Run the questions again'); expect(screen.getByTestId('ws-rerun').textContent).toBe('Start'); });
});

describe('Stripe states', () => {
  it('online picked, not connected: Connect line plus warnings', () => {
    view({ stripe: false, online: true, tickets: [], stripeOff: true, stripeNote: 'Stripe said no', stripeWarn: true, onCheckAgain: vi.fn() });
    expect(text('stripe')).toBe('Online, by card');
    expect(screen.getByTestId('ws-stripe').textContent).toBe('Connect');
    expect(screen.getByTestId('ws-stripe-off').textContent).toBe(NOT_SWITCHED_ON);
    expect(screen.getByTestId('ws-stripe-note').textContent).toBe('Stripe said no');
    expect(screen.getByTestId('ws-warn').textContent).toBe('Dancers can’t buy yet. Connect Stripe or tick another way in.');
    expect(screen.getByTestId('ws-check-again').textContent).toBe('Check again');
  });
  it('no warnings unless asked', () => {
    view({ stripe: false, online: true, tickets: [] });
    for (const id of ['stripe-off', 'stripe-note', 'warn', 'check-again']) expect(has(id)).toBe(false);
  });
  it('not online and not connected: no online line', () => { view({ stripe: false, tickets: [] }); expect(has('stripe')).toBe(false); });
  it('loading does not flash Connect', () => {
    view({ stripe: false, stripeReady: false, online: true, tickets: [], door: true });
    expect(has('stripe')).toBe(false); expect(screen.getByTestId('ws-loading')).toBeTruthy(); expect(has('stripe-nudge')).toBe(false);
  });
  it('connected, no ticket: add your price, no chip', () => {
    view({ tickets: [] });
    expect(text('add')).toBe('Online, by card: add your price');
    expect(screen.getByTestId('ws-add').textContent).toBe('Add');
    expect(has('another')).toBe(false);
  });
  it('chip only when connected with a ticket', () => {
    view(); expect(screen.getByTestId('ws-another').textContent).toBe('+ Another ticket');
    cleanup(); view({ stripe: false, online: true, tickets: [] }); expect(has('another')).toBe(false);
  });
  it('nudge: door on, no tickets, not connected, not festival', () => {
    view({ stripe: false, tickets: [], door: true });
    expect(screen.getByTestId('ws-stripe-nudge').textContent).toBe('Sell online and get paid in seconds. No commission from us.');
    cleanup(); view({ stripe: false, tickets: [], door: true, festival: true }); expect(has('stripe-nudge')).toBe(false);
    cleanup(); view({ stripe: false, tickets: [], door: false }); expect(has('stripe-nudge')).toBe(false);
  });
});

describe('note', () => {
  it('renders only when given', () => {
    view(); expect(has('note')).toBe(false);
    cleanup(); view({ note: soldKeep(1200, 12, 1000) });
    const n = screen.getByTestId('ws-note');
    expect(n.getAttribute('role')).toBe('status');
    expect(n.textContent).toBe('Changed to £12. The 12 people who bought keep their £10 ticket.');
  });
  it('soldKeep singular', () => { expect(soldKeep(1200, 1, 1000)).toBe('Changed to £12. The 1 person who bought keeps their £10 ticket.'); });
});

describe('skip-door line with skipped nights', () => {
  it('two nights: names them and says Change', () => {
    view({ door: true, noDoorNights: ['Friday 5 December', 'Friday 12 December'] });
    expect(text('skip-door')).toBe('No door on Friday 5 December and Friday 12 December');
    expect(screen.getByTestId('ws-skip-door').textContent).toBe('Change');
    expect(screen.getByTestId('ws-skip-door').getAttribute('aria-label')).toBe('Change the night to skip the door');
  });
  it('one night, three nights, and empty list', () => {
    view({ door: true, noDoorNights: ['Friday 5 December'] });
    expect(text('skip-door')).toBe('No door on Friday 5 December');
    cleanup(); view({ door: true, noDoorNights: ['A', 'B', 'C'] });
    expect(text('skip-door')).toBe('No door on A, B and C');
    cleanup(); view({ door: true, noDoorNights: [] });
    expect(text('skip-door')).toBe('Skip the door on one night');
    expect(screen.getByTestId('ws-skip-door').textContent).toBe('Choose');
  });
  it('tap still calls skipDoor and other lines are unchanged', () => {
    const on = view({ door: true, noDoorNights: ['Friday 5 December'] });
    fireEvent.click(screen.getByTestId('ws-skip-door')); expect(on.skipDoor).toHaveBeenCalledTimes(1);
    expect(text('door')).toBe('Pay at the door'); expect(text('rerun')).toBe('Run the questions again');
  });
});

describe('callbacks', () => {
  it('every button calls its callback with the right id', () => {
    const on = view({ tickets: [tk({ pricePence: 800, nextStep: { pricePence: 1000, effectiveFrom: '2026-12-02T00:00:00Z' } })], door: true, link: 'https://x.test', free: true });
    const tap = (id: string) => fireEvent.click(screen.getByTestId(`ws-${id}`));
    tap('ticket-t1'); expect(on.ticket).toHaveBeenCalledWith('t1');
    tap('early-t1'); expect(on.early).toHaveBeenCalledWith('t1');
    tap('another'); expect(on.newTicket).toHaveBeenCalledTimes(1);
    tap('door'); expect(on.door).toHaveBeenCalledTimes(1);
    tap('link'); expect(on.link).toHaveBeenCalledTimes(1);
    tap('free'); expect(on.free).toHaveBeenCalledTimes(1);
    tap('skip-door'); expect(on.skipDoor).toHaveBeenCalledTimes(1);
    tap('rerun'); expect(on.rerun).toHaveBeenCalledTimes(1);
  });
  it('Add, Connect and the nudge call stripe / newTicket', () => {
    const a = view({ tickets: [] }); fireEvent.click(screen.getByTestId('ws-add')); expect(a.newTicket).toHaveBeenCalledTimes(1);
    cleanup();
    const b = view({ stripe: false, online: true, tickets: [], door: true });
    fireEvent.click(screen.getByTestId('ws-stripe')); fireEvent.click(screen.getByTestId('ws-stripe-nudge'));
    expect(b.stripe).toHaveBeenCalledTimes(2);
  });
  it('every button has a ws- test id and a 44px target', () => {
    view({ door: true, link: 'https://x.test', free: true, tickets: [tk({ sold: 3 })] });
    for (const b of screen.getAllByRole('button')) {
      expect(b.getAttribute('data-testid')).toMatch(/^ws-/);
      expect(parseInt(b.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
    }
  });
});
