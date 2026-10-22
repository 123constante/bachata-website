// @vitest-environment jsdom
/** D89: prod admin_is_admin() RAISES admin_only (42501, HTTP 403) for a non-admin. That is an ANSWER (false), not an error. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

const h = vi.hoisted(() => ({
  auth: { user: { id: 'u1' } as null | { id: string }, authStatus: 'ready' as 'ready' | 'resolving' },
  rpc: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => h.auth }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => h.rpc(...a) } }));

import { fetchIsAdmin } from '../adminApi';
import AdminOrganisersPage from '../AdminOrganisersPage';
import { useEventLock } from '@/modules/organiser/events/ProfileLock';
import type { EventWorkspace } from '@/modules/organiser/events/eventModel';

// The REAL non-admin shape, as measured on prod.
const NOT_ADMIN = { code: '42501', message: 'admin_only' };
const progress = { percent: 40, required_left: 3, publish_ready: false, steps: [], declined: [] };
const ws = { organiserIds: ['o1'] } as unknown as EventWorkspace;

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient(); // default retry on purpose: a retry storm must show up
  return <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>;
}
const adminCalls = () => h.rpc.mock.calls.filter((c) => c[0] === 'admin_is_admin').length;

beforeEach(() => { h.rpc.mockReset(); h.auth.user = { id: 'u1' }; h.auth.authStatus = 'ready'; });
afterEach(cleanup);

describe('fetchIsAdmin', () => {
  it('42501 / admin_only is false, not a throw', async () => {
    h.rpc.mockResolvedValue({ data: null, error: NOT_ADMIN });
    await expect(fetchIsAdmin()).resolves.toBe(false);
  });
  it('data: true is true', async () => {
    h.rpc.mockResolvedValue({ data: true, error: null });
    await expect(fetchIsAdmin()).resolves.toBe(true);
  });
  it('a network / 500 error still throws', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { code: '500', message: 'boom' } });
    await expect(fetchIsAdmin()).rejects.toMatchObject({ message: 'boom' });
    h.rpc.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } });
    await expect(fetchIsAdmin()).rejects.toMatchObject({ message: 'Failed to fetch' });
  });
});

describe('AdminGate with the non-admin error shape', () => {
  it('shows NotAvailable (not the check error) and asks once', async () => {
    h.rpc.mockResolvedValue({ data: null, error: NOT_ADMIN });
    render(<AdminOrganisersPage />, { wrapper });
    expect(await screen.findByTestId('admin-not-available', undefined, { timeout: 1500 })).toBeTruthy();
    expect(screen.queryByTestId('admin-check-error')).toBeNull();
    expect(adminCalls()).toBe(1);
  });
});

describe('useEventLock with the non-admin error shape', () => {
  it('locks once both reads settle, and never opens after progress arrived', async () => {
    h.rpc.mockImplementation((fn: string) => (fn === 'admin_is_admin'
      ? Promise.resolve({ data: null, error: NOT_ADMIN })
      : Promise.resolve({ data: progress, error: null })));
    const seen: boolean[] = [];
    const { result } = renderHook(() => { const l = useEventLock(ws); seen.push(l.locked); return l; }, { wrapper });
    await waitFor(() => expect(result.current.locked).toBe(true), { timeout: 1500 });
    expect(result.current.reason).toContain('3 answers left');
    expect(seen.slice(seen.indexOf(true))).not.toContain(false);
    expect(adminCalls()).toBe(1);
  });
});
