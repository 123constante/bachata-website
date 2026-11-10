// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { connectBlock, connectReturnBanner, moveBlock, nextStep, paymentsLink, stripeStateOf } from '../../../tickets/ticketModel';
import { PROMPT_BODY, PROMPT_TITLE, getPaidRowTag, showPrompt } from '../model';
import { STRIPE, SHAPES, home, org, series, type, type Shape } from './fixtures';
import { dataMock, load, ok, pending, q, show } from './harness';

/*
 * Ticketing S2 gap G2: "started" (Stripe still needs details) is NOT "waiting" (every form sent, Stripe is
 * checking). One mapping, every screen. Stripe shape x paid/free x arrival x screen. Copy is written out
 * literally here, not imported from the code under test.
 */

vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-27' }));
vi.mock('../data', async (orig) => ({ ...(await dataMock(orig as never)), useStartOnboarding: () => q.onboard }));
const api = vi.hoisted(() => ({ setTicketStatus: vi.fn(), upsertTicketType: vi.fn(), refundOrder: vi.fn(), startOnboarding: vi.fn() }));
vi.mock('../../../tickets/ticketsApi', async (orig) => ({ ...(await orig<typeof import('../../../tickets/ticketsApi')>()), ...api }));

import { TicketsEntry } from '../TicketsEntry';
import { GetPaidPrompt, GetPaidRow, GetPaidScreen, GetPaidStart } from '../GetPaid';

beforeEach(() => Object.values(api).forEach((f) => f.mockReset()));
afterEach(cleanup);

const WAITING_REASON = 'Stripe is still checking your details. Paid tickets can go on sale as soon as it is done.';
const WAITING_BANNER = 'Stripe is checking your details. This is usually quick, and you can sell as soon as it is done.';
const STARTED_BANNER = 'A few details are still needed.';
const WAITING_TITLE = 'Stripe is checking your details';

describe('one mapping: account row to state', () => {
  it.each([
    ['no row', null, 'none'],
    ['row, forms not finished', { charges_enabled: false, payouts_enabled: false, details_submitted: false }, 'started'],
    ['row, details null', { charges_enabled: null, details_submitted: null }, 'started'],
    ['row, details sent, charges off', { charges_enabled: false, payouts_enabled: false, details_submitted: true }, 'waiting'],
    ['row, details sent, payouts on, charges off', { charges_enabled: false, payouts_enabled: true, details_submitted: true }, 'waiting'],
    ['charges on', { charges_enabled: true, payouts_enabled: true, details_submitted: true }, 'connected'],
    ['charges on, details flag lagging', { charges_enabled: true, details_submitted: false }, 'connected'],
  ])('%s -> %s', (_n, row, want) => expect(stripeStateOf(row as never)).toBe(want));
});

describe('model: block, reason, banner, prompt, steps', () => {
  const draft = { id: 'a', name: 'Door', pricePence: 1200, status: 'draft' as const };
  const off = { switchedOff: false, note: null };
  it('waiting: Put on sale is blocked with the waiting reason, and the block offers Check again, never Finish connecting', () => {
    const ctx = { role: 'owner', stripe: 'waiting' as never, seriesLive: true };
    expect(moveBlock({ pricePence: 1200, reserved: 0, capacity: 10 }, 'on_sale', ctx)).toBe(WAITING_REASON);
    expect(moveBlock({ pricePence: 0, reserved: 0, capacity: 10 }, 'on_sale', ctx)).toBeNull();
    const b = connectBlock(1200, ctx, off) as never as { button: string; line: string };
    expect(b.button).toBe('Check again');
    expect(b.line).toBe(WAITING_REASON);
    expect(JSON.stringify(b)).not.toMatch(/Finish connecting|Carry on/);
    expect(connectBlock(0, ctx, off)).toBeNull();
  });
  it('started keeps Carry on with Stripe', () => {
    expect(connectBlock(1200, { role: 'owner', stripe: 'started' }, off)?.button).toBe('Carry on with Stripe');
  });
  it.each([
    ['waiting', false, 'waiting', WAITING_BANNER, ['Check again', 'Open Stripe']],
    ['started', false, 'needs_more', STARTED_BANNER, ['Carry on with Stripe']],
    ['waiting', true, 'checking', 'Checking your payment set-up…', []],
  ])('return banner: %s polling=%s', (stripe, polling, kind, line, buttons) => {
    const b = connectReturnBanner({ arrivedFromStripe: true, stripe: stripe as never, role: 'owner', drafts: [draft], polling });
    expect([b?.kind, b?.line, b?.actions.map((a) => a.label)]).toEqual([kind, line, buttons]);
  });
  it('refresh arrival while waiting says waiting, not "link ran out"', () => {
    const b = connectReturnBanner({ arrivedFromStripe: false, refresh: true, stripe: 'waiting' as never, role: 'owner', drafts: [draft] });
    expect(b?.line).toBe(WAITING_BANNER);
  });
  it('Home prompt shows for waiting with its own words; row tag; next step; payments link', () => {
    expect(showPrompt('owner', true, 'waiting' as never)).toBe(true);
    expect(showPrompt('owner', true, 'connected')).toBe(false);
    expect((PROMPT_TITLE as Record<string, string>).waiting).toBe(WAITING_TITLE);
    expect((PROMPT_BODY as Record<string, string>).waiting).toMatch(/^Stripe is checking the details you sent\. This is usually quick\./);
    expect(getPaidRowTag('waiting' as never)?.label).toBe('Stripe is checking');
    expect(nextStep('owner', 'waiting' as never, [{ id: 's', name: 'N' }], [])).toMatchObject({ kind: 'connect', stripe: 'waiting' });
    expect(paymentsLink('owner', 'waiting' as never, null)?.action).toBe('Check again');
    expect(paymentsLink('owner', 'started', null)?.action).toBe('Finish connecting');
  });
});

const shape = (over: Partial<Shape>): Shape => ({ ...SHAPES.bare, ...over });

describe('Get paid screen x state', () => {
  it.each([
    ['started', 'Not finished', 'Finish connecting payments', 'Finish connecting', false],
    ['waiting', 'Stripe is checking', WAITING_TITLE, 'Check again', true],
  ] as const)('%s', (stripe, tag, title, action, hasOpen) => {
    load(shape({ stripe: stripe as never }));
    show(<GetPaidScreen />, '/account/p3/you/get-paid');
    expect(screen.getByTestId('tix-getpaid-tag').textContent).toBe(tag);
    expect(screen.getByTestId('tix-getpaid-title').textContent).toBe(title);
    expect(screen.getByTestId('tix-getpaid-go').textContent).toBe(action);
    expect(!!screen.queryByTestId('tix-getpaid-open')).toBe(hasOpen);
    if (hasOpen) {
      expect(screen.getByTestId('tix-getpaid-open').textContent).toBe('Open Stripe');
      fireEvent.click(screen.getByTestId('tix-getpaid-go'));
      expect((q.stripe as { query: { refetch: ReturnType<typeof vi.fn> } }).query.refetch).toHaveBeenCalled();
      expect(q.onboard.go).not.toHaveBeenCalled();
      fireEvent.click(screen.getByTestId('tix-getpaid-open'));
      expect(q.onboard.go).toHaveBeenCalled();
    }
  });
  it('waiting body never says a few details are needed', () => {
    load(shape({ stripe: 'waiting' as never }));
    show(<GetPaidScreen />, '/account/p3/you/get-paid?o=org-1&stripe=return');
    expect(document.body.textContent).not.toMatch(/still needs a few details|Finish connecting|It can take a minute to show as connected; reload/);
  });
});

describe('Get paid start screen x state x arrival', () => {
  it.each([['fresh'], ['return'], ['refresh']] as const)('waiting, arrival %s: Check again primary, Open Stripe secondary', (arrival) => {
    load(shape({ stripe: 'waiting' as never }));
    show(<GetPaidStart />, `/account/p3/get-paid?o=org-1${arrival === 'fresh' ? '' : `&stripe=${arrival}`}`);
    expect(screen.queryByTestId('getpaid-start-go')?.textContent ?? null).not.toBe('Carry on with Stripe');
    if (arrival !== 'return') {
      expect(screen.getByTestId('getpaid-start-check').textContent).toBe('Check again');
      expect(screen.getByTestId('getpaid-start-open').textContent).toBe('Open Stripe');
    }
    expect(document.body.textContent).not.toMatch(/Finish connecting|Connect Stripe/);
  });
  it('started fresh keeps Carry on with Stripe', () => {
    load(shape({ stripe: 'started' }));
    show(<GetPaidStart />, '/account/p3/get-paid?o=org-1');
    expect(screen.getByTestId('getpaid-start-go').textContent).toBe('Carry on with Stripe');
  });
});

describe('Home prompt and You row', () => {
  it('waiting prompt: waiting words, Check again, Open Stripe, no Finish connecting', () => {
    load(shape({ stripe: 'waiting' as never }));
    show(<GetPaidPrompt />, '/account/p3');
    expect(screen.getByTestId('tix-prompt-title').textContent).toBe(WAITING_TITLE);
    expect(screen.getByTestId('tix-prompt-go').textContent).toBe('Check again');
    expect(screen.getByTestId('tix-prompt-open').textContent).toBe('Open Stripe');
    expect(document.body.textContent).not.toMatch(/Finish connecting/);
  });
  it('You row tag', () => {
    load(shape({ stripe: 'waiting' as never }));
    show(<GetPaidRow />, '/account/p3/you');
    expect(screen.getByTestId('tix-you-getpaid-tag').textContent).toBe('Stripe is checking');
  });
});

describe('Tickets sheet x state x paid/free x arrival', () => {
  const ARR = [['none', ''], ['return', '?tickets=1&stripe=return'], ['refresh', '?tickets=1&stripe=refresh']] as const;
  describe.each([['paid', 1200], ['free', 0]] as const)('%s draft', (_k, pence) => {
    it.each(ARR)('waiting, arrival %s', (arrival, qs) => {
      load(shape({ types: [type('d1', { status: 'draft', pricePence: pence, name: 'Door' })], stripe: 'waiting' as never }));
      show(<TicketsEntry seriesId="ser-1" />, `/account/p3/events/ser-1${qs}`);
      if (!qs) fireEvent.click(screen.getByTestId('tix-row'));
      const body = document.body.textContent ?? '';
      expect(body).not.toMatch(/Finish connecting|A few details are still needed|Carry on with Stripe/);
      const sw = screen.getByTestId('tix-switch') as HTMLButtonElement;
      if (pence > 0) {
        expect(sw.disabled).toBe(true);
        expect(body).toContain(WAITING_REASON.slice(0, 40));
        expect(screen.getByTestId('tix-connect-btn').textContent).toBe('Check again');
        expect(screen.getByTestId('tix-connect-open').textContent).toBe('Open Stripe');
        fireEvent.click(screen.getByTestId('tix-connect-btn'));
        expect((q.stripe as { query: { refetch: ReturnType<typeof vi.fn> } }).query.refetch).toHaveBeenCalled();
      } else {
        expect(sw.disabled).toBe(false);
        expect(screen.queryByTestId('tix-connect')).toBeNull();
      }
      if (qs && pence > 0) {
        expect(screen.getByTestId('tix-return-line').textContent).toBe(arrival === 'return' ? 'Checking your payment set-up…' : WAITING_BANNER);
      }
    });
  });
  it('loading and error states stay "checking"', () => {
    load(shape({ types: [type('d1', { status: 'draft', pricePence: 1200 })] }));
    q.stripe = { query: pending(), state: null };
    show(<TicketsEntry seriesId="ser-1" />, '/account/p3/events/ser-1');
    fireEvent.click(screen.getByTestId('tix-row'));
    expect((screen.getByTestId('tix-switch') as HTMLButtonElement).disabled).toBe(true);
    expect(document.body.textContent).toContain('Checking your payment set-up');
  });
});
void ok; void home; void org; void series; void STRIPE;
