import { describe, expect, it } from 'vitest';
import { legacyTicketsTarget } from '../legacyRedirect';

/* The old /account/tickets screens are gone (T6). Stripe links they minted still return to
   /account/tickets?o=..&stripe=..; each must land on the P3 screen that does the same job. */
describe('legacyTicketsTarget: every old /account/tickets URL -> its P3 screen', () => {
  it.each([
    ['/account/tickets', '?o=org1&stripe=return', '/account/p3/you/get-paid?o=org1&stripe=return'],
    ['/account/tickets', '?o=org1&stripe=refresh', '/account/p3/you/get-paid?o=org1&stripe=refresh'],
    ['/account/tickets/', '?stripe=return&o=org1', '/account/p3/you/get-paid?o=org1&stripe=return'],
    ['/account/tickets', '?o=org%201&stripe=return', '/account/p3/you/get-paid?o=org%201&stripe=return'],
    ['/account/tickets', '?o=org1', '/account/p3/you/get-paid?o=org1'],
    ['/account/tickets', '', '/account/p3/you/get-paid'],
    ['/account/tickets', '?o=org1&stripe=bogus', '/account/p3/you/get-paid?o=org1'],
    ['/account/tickets', '?stripe=return', '/account/p3/you/get-paid'],
    ['/account/tickets/events/s1', '?o=org1', '/account/p3/events/s1'],
    ['/account/tickets/events/s%201', '', '/account/p3/events/s%201'],
    ['/account/tickets/events/s1/', '?o=org1&add=1', '/account/p3/events/s1'],
    ['/account/tickets/events', '?o=org1', '/account/p3/you/get-paid?o=org1'],
    ['/account/tickets/whatever/else', '?o=org1', '/account/p3/you/get-paid?o=org1'],
    ['/account/tickets/events/%E0', '', '/account/p3/events/%25E0'],
  ] as const)('%s%s -> %s', (path, search, to) => expect(legacyTicketsTarget(path, search)).toBe(to));
});
