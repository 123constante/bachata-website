// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { AccountGateStatus } from '@/lib/accountGate';
import { finishProfileHref } from '@/lib/profileCompletion';

const gate = vi.hoisted(() => ({ status: 'loading' as AccountGateStatus }));

vi.mock('@/lib/accountGate', () => ({
  useAccountGate: () => ({ status: gate.status, dancerProfileId: gate.status === 'complete' ? 'p1' : null, deletion: gate.status === 'deleted' ? 'deleted-card' : null }),
}));
// AuthGuard is today's signed-out answer (sign-in with returnTo); here it only marks that it wraps the area.
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <div data-testid="auth-guard">{children}</div> }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: () => new Promise(() => {}), from: () => ({}) } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'me@x.example' }, session: null }) }));
// If anything still read the old dancer gate it would see "incomplete" and redirect:
// the account gate is the ONE answer the module listens to.
vi.mock('@/hooks/useProfileCompletion', () => ({
  useProfileCompletion: () => ({ status: 'incomplete', missing: ['city'], profileId: 'p1', refetch: async () => ({ status: 'incomplete', missing: ['city'], profileId: 'p1' }) }),
}));

import OrganiserRoutes from '../OrganiserRoutes';

vi.setConfig({ testTimeout: 20_000 });

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-16T12:00:00Z'));
});
afterAll(() => {
  vi.useRealTimers();
});
afterEach(cleanup);

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{`${pathname}${search}`}</p>;
}

const ASKED = '/account/o/team?o=org-1';

function at(status: AccountGateStatus) {
  gate.status = status;
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[ASKED]}>
        <Routes>
          <Route path="/account/o/*" element={<OrganiserRoutes />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('account gate in front of the organiser area (4.1, 4.3 #1)', () => {
  it.each<[AccountGateStatus, string]>([
    ['loading', 'skeleton'],
    ['signed-out', 'AuthGuard only'],
    ['deleted', 'nothing'],
    ['incomplete', '/finish-profile'],
    ['complete', 'the shell'],
  ])('%s -> %s', async (status) => {
    const { container } = at(status);
    if (status === 'incomplete') {
      // Navigate replace: the area (AuthGuard included) is left for the Finish screen.
      expect((await screen.findByTestId('where')).textContent).toBe(finishProfileHref(ASKED));
      return;
    }
    expect(screen.getByTestId('auth-guard')).toBeTruthy();
    if (status === 'complete') {
      expect(await screen.findByTestId('org-page-team', {}, { timeout: 10_000 })).toBeTruthy();
      expect(screen.queryByTestId('where')).toBeNull();
      return;
    }
    // Let anything lazy settle before asserting absence.
    await waitFor(() => expect(container.querySelector('[data-testid^="org-page-"]')).toBeNull());
    expect(screen.queryByTestId('where')).toBeNull();
    if (status === 'loading') {
      expect(screen.getByTestId('org-route-loading')).toBeTruthy();
      return;
    }
    expect(screen.queryByTestId('org-shell')).toBeNull();
    expect(screen.queryByTestId('org-route-loading')).toBeNull();
    expect(screen.getByTestId('auth-guard').innerHTML).toBe('');
  });
});
