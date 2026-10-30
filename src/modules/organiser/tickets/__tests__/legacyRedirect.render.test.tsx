// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import LegacyTicketsRedirect from '../LegacyTicketsRedirect';
import { LEGACY_TICKETS_BASE } from '../legacyRedirect';

/* Review 1165 F1/F2: the matrix test proves the pure mapping; this one proves the mounted route
   hands it the real URL (query included) and replaces the old entry, so Back never loops. */
function Where() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <p data-testid="at">{pathname + search}</p>
      <button type="button" onClick={() => navigate(-1)}>Back</button>
    </>
  );
}

const mount = (url: string) =>
  render(
    <MemoryRouter initialEntries={['/before', url]} initialIndex={1}>
      <Routes>
        {/* The same route element AnimatedRoutes mounts (flagOff.test pins that literal). */}
        <Route path={`${LEGACY_TICKETS_BASE}/*`} element={<LegacyTicketsRedirect />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

afterEach(cleanup);

describe('LegacyTicketsRedirect mounted in a router: the FINAL location', () => {
  it.each([
    ['/account/tickets?o=org1&stripe=return', '/account/p3/you/get-paid?o=org1&stripe=return'],
    ['/account/tickets?o=org1&stripe=refresh', '/account/p3/you/get-paid?o=org1&stripe=refresh'],
    ['/account/tickets/events/s1?o=org1', '/account/p3/events/s1'],
  ])('%s -> %s', (from, to) => {
    mount(from);
    expect(screen.getByTestId('at').textContent).toBe(to);
  });

  it('replaces the old entry: Back from the P3 screen goes to the page before, not to /account/tickets', () => {
    mount('/account/tickets?o=org1&stripe=return');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByTestId('at').textContent).toBe('/before');
  });
});
