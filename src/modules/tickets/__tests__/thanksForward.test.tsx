// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const auth = vi.hoisted(() => ({ user: null as { id: string } | null, authStatus: 'ready' as string }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: auth.user, authStatus: auth.authStatus, retryAuth: () => {} }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: vi.fn(() => Promise.resolve({ data: { status: 'pending' }, error: null })) } }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: unknown }) => children }));
vi.mock('@/lib/seo', () => ({ useSeo: () => undefined }));

import TicketThanksPage from '../TicketThanksPage';

const ORDER = '3f2b8c1e-5a47-4d1b-9c2e-7a6b5c4d3e2f';
const KEY = 'bc.ticketOrderId';

function Where() {
  const l = useLocation();
  return <div data-testid="where">{l.pathname + l.search}</div>;
}
function go(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/tickets/thanks" element={<TicketThanksPage />} />
        <Route path="/app/tickets" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  auth.user = null;
  auth.authStatus = 'ready';
});

describe('/tickets/thanks forwards a signed-in buyer to the Tickets tab', () => {
  it('signed in + ?o= -> /app/tickets?o=', () => {
    auth.user = { id: 'u' };
    go(`/tickets/thanks?o=${ORDER}`);
    expect(screen.getByTestId('where').textContent).toBe(`/app/tickets?o=${ORDER}`);
  });
  it('keeps free=1 only alongside a real order id', () => {
    auth.user = { id: 'u' };
    go(`/tickets/thanks?o=${ORDER}&free=1`);
    expect(screen.getByTestId('where').textContent).toBe(`/app/tickets?o=${ORDER}&free=1`);
  });
  it('signed in + stored id only (bare Stripe return) -> carries the stored id, not yet cleared', () => {
    auth.user = { id: 'u' };
    window.sessionStorage.setItem(KEY, ORDER);
    go('/tickets/thanks');
    expect(screen.getByTestId('where').textContent).toBe(`/app/tickets?o=${ORDER}`);
    expect(window.sessionStorage.getItem(KEY)).toBe(ORDER);
  });
  it('signed in, garbled id, nothing stored -> stays on the thank-you page', () => {
    auth.user = { id: 'u' };
    go('/tickets/thanks?o=nope');
    expect(screen.getByTestId('tickets-thanks')).toBeTruthy();
  });
  it('signed out -> today’s thank-you page, no forward', () => {
    go(`/tickets/thanks?o=${ORDER}`);
    expect(screen.getByTestId('tickets-thanks')).toBeTruthy();
    expect(screen.queryByTestId('where')).toBeNull();
  });
  it('auth still resolving -> placeholder, neither page', () => {
    auth.authStatus = 'resolving';
    go(`/tickets/thanks?o=${ORDER}`);
    expect(screen.getByTestId('tickets-thanks-resolving')).toBeTruthy();
    expect(screen.queryByTestId('tickets-thanks')).toBeNull();
  });
});
