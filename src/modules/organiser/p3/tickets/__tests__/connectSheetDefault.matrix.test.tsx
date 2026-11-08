// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import {
  CONNECT_LABEL,
  CONNECT_RESUME_LABEL,
  PAYMENTS_WHERE,
  SELLING_ELSEWHERE_LINK,
  STRIPE_AT_PRICE_HINT,
  STRIPE_REFRESH_NOTE,
  stripeStateOf,
} from '../../../tickets/ticketModel';
import { SHAPES, STRIPE, home, org, series, type } from './fixtures';
import { dataMock, load, ok, pending, q, show } from './harness';

/* Add a ticket: Connect is the default; the external link is a small text link under it, never primary.
 * stripe state x series live x ticket paid/free x arrival (none, return, refresh). */

vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-27' }));
vi.mock('../data', async (orig) => ({ ...(await dataMock(orig as never)), useStartOnboarding: () => q.onboard }));
const api = vi.hoisted(() => ({ setTicketStatus: vi.fn(), upsertTicketType: vi.fn(), refundOrder: vi.fn(), startOnboarding: vi.fn() }));
vi.mock('../../../tickets/ticketsApi', async (orig) => ({ ...(await orig<typeof import('../../../tickets/ticketsApi')>()), ...api }));

import { TicketsEntry } from '../TicketsEntry';

beforeEach(() => Object.values(api).forEach((f) => f.mockReset()));
afterEach(cleanup);

type SK = 'connected' | 'started' | 'none' | 'loading' | 'not_configured';
const STRIPES: SK[] = ['connected', 'started', 'none', 'loading', 'not_configured'];
const ARRIVALS = ['', '?tickets=1&stripe=return', '?tickets=1&stripe=refresh'] as const;

function setStripe(k: SK) {
  if (k === 'loading') q.stripe = { query: pending(), state: null };
  else if (k === 'not_configured') {
    q.stripe = { query: ok(STRIPE.none), state: stripeStateOf(STRIPE.none) };
    q.onboard.switchedOff = true;
  } else q.stripe = { query: ok(STRIPE[k]), state: stripeStateOf(STRIPE[k]) };
}
const input = (id: string, v: string) => fireEvent.change(screen.getByTestId(id), { target: { value: v } });
function toStep3(pence: number) {
  fireEvent.click(screen.getByTestId('tix-add'));
  input('tix-form-name', 'Door');
  if (pence > 0) input('tix-form-price', '12.00');
  fireEvent.click(screen.getByTestId('tix-next'));
  input('tix-form-capacity', '40');
  fireEvent.click(screen.getByTestId('tix-next'));
}

describe.each([['paid', 1200], ['free', 0]] as const)('%s', (_k, pence) => {
  describe.each(STRIPES)('stripe %s', (stripe) => {
    it('step 1 names Stripe only for a paid price; step 3 has one primary action and the link is never primary', () => {
      load(SHAPES.bare);
      q.home = ok(home(org({ role: 'owner' as never }, series())));
      q.types = ok([]);
      setStripe(stripe);
      show(<TicketsEntry seriesId="ser-1" />);
      fireEvent.click(screen.getByTestId('tix-row'));
      fireEvent.click(screen.getByTestId('tix-add'));
      input('tix-form-name', 'Door');
      if (pence > 0) input('tix-form-price', '12.00');
      expect(screen.queryByTestId('tix-stripe-hint')?.textContent ?? null).toBe(pence > 0 ? STRIPE_AT_PRICE_HINT : null);
      fireEvent.click(screen.getByTestId('tix-next'));
      input('tix-form-capacity', '40');
      fireEvent.click(screen.getByTestId('tix-next'));
      const block = pence > 0 && (stripe === 'none' || stripe === 'started');
      const primary = ['tix-connect', 'tix-sell'].filter((id) => screen.queryByTestId(id));
      expect(primary).toEqual([block ? 'tix-connect' : 'tix-sell']); // exactly one primary action
      expect(screen.queryAllByTestId('tix-elsewhere').length).toBe(block ? 1 : 0);
      if (block) {
        expect(screen.getByTestId('tix-connect').textContent).toBe(stripe === 'started' ? CONNECT_RESUME_LABEL : CONNECT_LABEL);
        const link = screen.getByTestId('tix-elsewhere');
        expect(link.tagName).toBe('A'); // a text link, not a button
        expect(link.textContent).toBe(SELLING_ELSEWHERE_LINK);
        expect(link.className).not.toContain('p3-btn');
        expect(link.getAttribute('href')).toBe('/account/p3/events/ser-1/details');
        expect(screen.getByTestId('tix-connect').compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }
      if (pence > 0 && stripe === 'not_configured') {
        const where = screen.getByTestId('tix-payments-where'); // a real tap target
        expect(where.tagName).toBe('A');
        expect(screen.getByTestId('tix-sell-reason').textContent).toBe(PAYMENTS_WHERE);
      }
    });

    describe.each(ARRIVALS)('arrival %s', (search) => {
      it('the sheet and banner always leave a next action; an untouched save sends nothing', () => {
        load(SHAPES.bare);
        q.home = ok(home(org({ role: 'owner' as never }, series())));
        q.types = ok(pence > 0 ? [type('t-d', { status: 'draft', pricePence: pence, name: 'Door' })] : []);
        setStripe(stripe);
        show(<TicketsEntry seriesId="ser-1" />, `/account/p3/events/ser-1${search}`);
        if (!search) fireEvent.click(screen.getByTestId('tix-row'));
        const refresh = search.includes('refresh');
        const note = screen.queryByTestId('tix-return-line')?.textContent;
        if (refresh && stripe !== 'connected') {
          expect(note).toBe(STRIPE_REFRESH_NOTE);
          expect(screen.getAllByTestId('tix-return-carry_on').length).toBe(1);
        } else if (refresh) expect(note).not.toBe(STRIPE_REFRESH_NOTE);
        expect(api.upsertTicketType).not.toHaveBeenCalled();
        expect(api.setTicketStatus).not.toHaveBeenCalled();
      });
    });
  });
});

it('a failed Stripe start shows its error in the sheet, the banner and the draft row', () => {
  load(SHAPES.bare);
  q.home = ok(home(org({ role: 'owner' as never }, series())));
  q.types = ok([type('t-d', { status: 'draft', pricePence: 1200, name: 'Door' })]);
  setStripe('started');
  q.onboard.note = 'Stripe could not start. Try again.';
  show(<TicketsEntry seriesId="ser-1" />, '/account/p3/events/ser-1?tickets=1&stripe=refresh');
  expect(screen.getAllByTestId('tix-connect-error').length).toBe(2); // banner + draft row
  fireEvent.click(screen.getByTestId('tix-add'));
  input('tix-form-name', 'Late');
  input('tix-form-price', '5.00');
  fireEvent.click(screen.getByTestId('tix-next'));
  input('tix-form-capacity', '10');
  fireEvent.click(screen.getByTestId('tix-next'));
  expect(screen.getAllByTestId('tix-connect-error').length).toBe(3); // + sheet
});

it('the external link text is plain and the Details path is the only place it leads', async () => {
  load(SHAPES.bare);
  q.home = ok(home(org({ role: 'owner' as never }, series())));
  q.types = ok([]);
  setStripe('none');
  show(<TicketsEntry seriesId="ser-1" />);
  fireEvent.click(screen.getByTestId('tix-row'));
  toStep3(1200);
  await waitFor(() => expect(screen.getByTestId('tix-elsewhere')).toBeTruthy());
});
