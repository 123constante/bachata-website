// @vitest-environment jsdom
/**
 * Tickets block and thank-you page x every type status x free/paid x remaining x error
 * reason. Prod has 0 ticket_types today (shape survey in docs/ticketing-buyer-journey.md),
 * so rows are built from the live ticket_types_public_v1 body.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: vi.fn() } }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: unknown }) => children }));
vi.mock('@/lib/seo', () => ({ useSeo: () => undefined }));

const api = vi.hoisted(() => ({ fetchPublicTicketTypes: vi.fn(), postTicketCheckout: vi.fn() }));
vi.mock('../ticketCheckoutApi', async (orig) => ({ ...(await orig<typeof import('../ticketCheckoutApi')>()), ...api }));

import { TicketsBlock } from '../TicketsBlock';
import TicketThanksPage from '../TicketThanksPage';
import { REASON_COPY, WAY_LABEL, type PublicTicketType } from '../ticketCheckoutModel';

const NOW = new Date('2026-10-27T12:00:00Z');
const PROD = 'https://www.bachatacalendar.co.uk';
const mk = (id: string, p: Partial<PublicTicketType> = {}): PublicTicketType => ({
  id, name: `Type ${id}`, pricePence: 1200, status: 'on_sale', remaining: 30, salesOpenAt: null, salesCloseAt: null, ...p,
});

function renderBlock(types: PublicTicketType[], opts: { origin?: string; path?: string; organiserId?: string | null } = {}) {
  api.fetchPublicTicketTypes.mockResolvedValue(types);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[opts.path ?? '/event/e1']}>
        <Routes>
          <Route path="/event/:id" element={<TicketsBlock seriesId="e1" organiserId={'organiserId' in opts ? opts.organiserId ?? null : 'org1'} now={NOW} origin={opts.origin ?? PROD} />} />
          <Route path="/tickets/thanks" element={<TicketThanksPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function fillAndBuy() {
  fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'a@b.co' } });
  fireEvent.click(screen.getByRole('checkbox'));
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.sessionStorage.clear();
});

describe('empty: no types = no block at all', () => {
  it('renders nothing', async () => {
    const { container } = renderBlock([]);
    await waitFor(() => expect(api.fetchPublicTicketTypes).toHaveBeenCalledWith('e1'));
    expect(container.querySelector('[data-testid="tickets-block"]')).toBeNull();
  });
});

describe('row states x free/paid', () => {
  const cases: [string, Partial<PublicTicketType>, RegExp, boolean][] = [
    ['on sale, few left', { remaining: 5 }, /5 left/, true],
    ['on sale, plenty', { remaining: 30 }, /On sale/, true],
    ['sold out status', { status: 'sold_out', remaining: 0 }, /Sold out/, false],
    ['remaining 0', { remaining: 0 }, /Sold out/, false],
    ['not open yet', { salesOpenAt: '2026-11-01T18:00:00Z' }, /On sale .*Nov/, false],
    ['sales closed', { salesCloseAt: '2026-10-01T18:00:00Z' }, /Sales closed/, false],
  ];
  for (const price of [0, 1250]) for (const [label, patch, re, pickable] of cases) {
    it(`${label} ${price ? 'paid' : 'free'}`, async () => {
      renderBlock([mk('a', { ...patch, pricePence: price })]);
      const row = await screen.findByRole('button', { name: /Type a/ });
      expect(row.textContent).toMatch(re);
      expect(row.textContent).toMatch(price ? /£12\.50/ : /Free/);
      expect((row as HTMLButtonElement).disabled).toBe(!pickable);
      if (pickable) {
        // The only buyable type is picked for the buyer.
        expect(await screen.findByRole('button', { name: price ? 'Buy tickets' : 'Get free ticket' })).toBeTruthy();
        const totals = screen.getByTestId('ticket-totals').textContent ?? '';
        if (price) expect(totals).toMatch(/\+ 50p booking fee per ticket.*£0\.50.*Total.*£13/);
        else expect(totals).not.toMatch(/booking fee/);
      } else {
        expect(screen.getByText(/No tickets can be bought right now/)).toBeTruthy();
        expect(screen.queryByRole('button', { name: /Buy tickets|Get free ticket/ })).toBeNull();
      }
    });
  }
});

describe('stepper caps at 20 and at remaining', () => {
  it.each([[3, 3, /Only 3 left/], [20, 20, /Up to 20/], [45, 20, /Up to 20/]])('remaining %s -> max %s', async (remaining, max, note) => {
    renderBlock([mk('a', { remaining })]);
    const plus = await screen.findByRole('button', { name: 'One more ticket' });
    for (let i = 0; i < 25; i++) fireEvent.click(plus);
    expect(screen.getByTestId('ticket-qty').textContent).toBe(String(max));
    expect((plus as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(note)).toBeTruthy();
    expect(screen.getByTestId('ticket-totals').textContent).toContain(`£${(1200 * max + 50 * max) / 100}`);
  });
});

describe('Buy is disabled with a reason until valid', () => {
  it('walks every reason in order', async () => {
    renderBlock([mk('a'), mk('b')]);
    await screen.findByText(/Pick a ticket to choose how many/);
    fireEvent.click(screen.getByRole('button', { name: /Type b/ }));
    const buy = screen.getByRole('button', { name: 'Buy tickets' }) as HTMLButtonElement;
    expect(buy.disabled).toBe(true);
    expect(screen.getByText(/Enter your email/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'nope' } });
    expect(screen.getByText(/does not look right/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'a@b.co' } });
    expect(screen.getByText(/Tick the box/)).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(buy.disabled).toBe(false);
    expect(api.postTicketCheckout).not.toHaveBeenCalled();
  });
  it('on a preview origin it says why and never calls the server', async () => {
    renderBlock([mk('a')], { origin: 'https://bachata-website-git-x.vercel.app' });
    await screen.findByRole('button', { name: 'Buy tickets' });
    await fillAndBuy();
    expect((screen.getByRole('button', { name: 'Buy tickets' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/only works on bachatacalendar\.co\.uk/)).toBeTruthy();
  });
  it('terms text opens and is the draft copy', async () => {
    renderBlock([mk('a')]);
    fireEvent.click(await screen.findByRole('button', { name: 'Read the terms of sale' }));
    expect(screen.getByTestId('terms-text').textContent).toMatch(/50p per ticket/);
  });
});

describe('server replies', () => {
  it('paid: redirects to Stripe and keeps the order id', async () => {
    const assign = vi.fn();
    Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, assign } });
    api.postTicketCheckout.mockResolvedValue({ kind: 'redirect', orderId: 'ord-1', url: 'https://checkout.stripe.com/c/x' });
    renderBlock([mk('a')]);
    await screen.findByRole('button', { name: 'Buy tickets' });
    await fillAndBuy();
    fireEvent.click(screen.getByRole('button', { name: 'Buy tickets' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/x'));
    expect(api.postTicketCheckout.mock.calls[0][0]).toMatchObject({
      quantity: 1, buyer_email: 'a@b.co', success_url: `${PROD}/tickets/thanks`, cancel_url: `${PROD}/event/e1?tickets=cancelled`,
    });
    expect(window.sessionStorage.getItem('bc.ticketOrderId')).toBe('ord-1');
  });
  it('free: goes to the thank-you state without Stripe', async () => {
    api.postTicketCheckout.mockResolvedValue({ kind: 'free', orderId: 'ord-free-123' });
    renderBlock([mk('a', { pricePence: 0 })]);
    await screen.findByRole('button', { name: 'Get free ticket' });
    await fillAndBuy();
    fireEvent.click(screen.getByRole('button', { name: 'Get free ticket' }));
    expect(await screen.findByText('Your free tickets are on their way')).toBeTruthy();
    expect(screen.getByText(/ord-free/)).toBeTruthy();
  });
  for (const reason of [...Object.keys(REASON_COPY), 'something_new']) {
    for (const organiserId of ['org1', null]) {
      it(`error ${reason} (organiser ${organiserId ? 'known' : 'unknown'}) shows copy and a way forward`, async () => {
        api.postTicketCheckout.mockResolvedValue({ kind: 'error', reason, message: null });
        renderBlock([mk('a')], { organiserId });
        await screen.findByRole('button', { name: 'Buy tickets' });
        await fillAndBuy();
        fireEvent.click(screen.getByRole('button', { name: 'Buy tickets' }));
        const alert = await screen.findByRole('alert');
        const copy = REASON_COPY[reason] ?? { text: /could not be booked/, way: 'retry' };
        expect(alert.textContent).toMatch(copy.text instanceof RegExp ? copy.text : new RegExp(copy.text.slice(0, 20)));
        if (copy.way === 'contact_organiser') {
          const link = within(alert).queryByRole('link', { name: WAY_LABEL.contact_organiser });
          if (organiserId) expect(link?.getAttribute('href')).toBe('/organisers/org1');
          else expect(link).toBeNull();
        } else {
          fireEvent.click(within(alert).getByRole('button', { name: WAY_LABEL[copy.way] }));
          expect(screen.queryByRole('alert')).toBeNull();
        }
      });
    }
  }
});

describe('cancel state and thank-you page', () => {
  it('cancelled return says nobody was charged, form ready', async () => {
    renderBlock([mk('a')], { path: '/event/e1?tickets=cancelled' });
    expect(await screen.findByText(/Checkout cancelled. You have not been charged/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Buy tickets' })).toBeTruthy();
  });
  it.each([
    ['/tickets/thanks?o=abcdef12-0000', /Payment received, your tickets are being emailed/, /abcdef12/],
    ['/tickets/thanks', /Payment received, your tickets are being emailed/, null],
    ['/tickets/thanks?o=ff00ff00-1&free=1', /free tickets are on their way/, /ff00ff00/],
  ])('%s', (path, title, ref) => {
    render(<MemoryRouter initialEntries={[path]}><TicketThanksPage /></MemoryRouter>);
    const page = screen.getByTestId('tickets-thanks');
    expect(page.textContent).toMatch(title);
    expect(page.textContent).not.toMatch(/issued/i);
    if (ref) expect(page.textContent).toMatch(ref);
    else expect(page.textContent).not.toMatch(/Order reference/);
  });
  it('falls back to the stored order id after the Stripe redirect', () => {
    window.sessionStorage.setItem('bc.ticketOrderId', '99887766-aaaa');
    render(<MemoryRouter initialEntries={['/tickets/thanks']}><TicketThanksPage /></MemoryRouter>);
    expect(screen.getByText(/99887766/)).toBeTruthy();
  });
});
