// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { SHAPES, type Shape } from './fixtures';
import { dataMock, load, show } from './harness';

/*
 * P89: Get paid honours ?returnTo=. The real useStartOnboarding runs here (only the edge call is
 * mocked) so the Stripe return/refresh URLs are checked as Stripe would receive them.
 */

const start = vi.hoisted(() => vi.fn());
vi.mock('../../../tickets/ticketsApi', async (orig) => ({ ...(await orig<typeof import('../../../tickets/ticketsApi')>()), startOnboarding: start }));
vi.mock('../data', async (orig) => {
  const o = await orig<typeof import('../data')>();
  return { ...(await dataMock(orig as never)), useStartOnboarding: o.useStartOnboarding };
});

import { GetPaidScreen } from '../GetPaid';

const shape = (over: Partial<Shape>): Shape => ({ ...SHAPES.bare, ...over });
const GP = (qs = '') => `/account/p3/you/get-paid${qs}`;
const EVENT = '/account/o/events/S1';
const enc = encodeURIComponent;

beforeEach(() => {
  start.mockReset();
  start.mockResolvedValue({ kind: 'not_configured' });
});
afterEach(cleanup);

describe.each(['none', 'started', 'waiting', 'connected'] as const)('returnTo = event, stripe %s', (stripe) => {
  it('shows the way back to the event; primary only when connected', () => {
    load(shape({ stripe, role: 'owner' }));
    show(<GetPaidScreen />, GP(`?o=org-1&returnTo=${enc(EVENT)}`));
    const a = screen.getByTestId('tix-getpaid-back-to');
    expect(a.getAttribute('href')).toBe(EVENT);
    expect(a.textContent).toBe('Back to your event');
    expect(a.className.includes('p3-btn')).toBe(stripe === 'connected');
    expect(a.className.includes('p3-link')).toBe(stripe !== 'connected');
    expect(a.style.minHeight).toBe('44px');
  });
});

it('non-owner still sees the back link (navigation only)', () => {
  load(shape({ stripe: 'none', role: 'manager' }));
  show(<GetPaidScreen />, GP(`?o=org-1&returnTo=${enc(EVENT)}`));
  expect(screen.getByTestId('tix-getpaid-back-to').getAttribute('href')).toBe(EVENT);
});

describe.each([
  ['/account/o/go-live?series=S1', 'Back to your event'],
  ['/account/p3/you', 'Go back'],
] as const)('returnTo %s', (back, label) => {
  it(`is labelled "${label}"`, () => {
    load(shape({ stripe: 'none', role: 'owner' }));
    show(<GetPaidScreen />, GP(`?o=org-1&returnTo=${enc(back)}`));
    expect(screen.getByTestId('tix-getpaid-back-to').textContent).toBe(label);
  });
});

describe.each([
  ['an external URL', `?o=org-1&returnTo=${enc('https://evil.test')}`],
  ['a // URL', `?o=org-1&returnTo=${enc('//evil.test')}`],
  ['Done', `?o=org-1&returnTo=${enc('/account/o/done')}`],
  ['no returnTo', '?o=org-1'],
])('%s', (_n, qs) => {
  it('draws no back link and sends the old two Stripe URLs', async () => {
    load(shape({ stripe: 'none', role: 'owner' }));
    show(<GetPaidScreen />, GP(qs));
    expect(screen.queryByTestId('tix-getpaid-back-to')).toBeNull();
    fireEvent.click(screen.getByTestId('tix-getpaid-go'));
    await waitFor(() => expect(start).toHaveBeenCalled());
    const [, ret, refresh] = start.mock.calls[0];
    expect(ret).toBe(`${window.location.origin}/account/p3/you/get-paid?o=org-1&stripe=return`);
    expect(refresh).toBe(`${window.location.origin}/account/p3/you/get-paid?o=org-1&stripe=refresh`);
  });
});

it('with returnTo, Connect sends Stripe back to Get paid carrying returnTo and the stripe kind', async () => {
  load(shape({ stripe: 'none', role: 'owner' }));
  show(<GetPaidScreen />, GP(`?o=org-1&returnTo=${enc(EVENT)}`));
  fireEvent.click(screen.getByTestId('tix-getpaid-go'));
  await waitFor(() => expect(start).toHaveBeenCalled());
  const [, ret, refresh] = start.mock.calls[0];
  for (const [u, kind] of [[ret, 'return'], [refresh, 'refresh']] as const) {
    expect(u).toContain('/you/get-paid?o=');
    expect(u).toContain(`returnTo=${enc(EVENT)}`);
    expect(u.endsWith(`&stripe=${kind}`)).toBe(true);
  }
});

it('arriving with returnTo and stripe=return keeps returnTo and drops stripe', async () => {
  load(shape({ stripe: 'started', role: 'owner' }));
  show(<GetPaidScreen />, GP(`?o=org-1&returnTo=${enc(EVENT)}&stripe=return`));
  expect(screen.getByTestId('tix-getpaid-back').textContent).toMatch(/^Back from Stripe\./);
  expect(screen.getByTestId('tix-getpaid-back-to').getAttribute('href')).toBe(EVENT);
});
