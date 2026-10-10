// @vitest-environment jsdom
/**
 * The profile id is NOT auth.uid(). `_my_dancer_profile_id_v1` resolves the
 * caller's persona (a linked admin-made profile through claimed_by, else the
 * caller's own row), and profile_complete_v1 must be asked about THAT id. Every
 * read here is mocked; nothing touches a network.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const h = vi.hoisted(() => ({
  user: null as null | { id: string; is_anonymous?: boolean },
  rpc: vi.fn(),
  readRow: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: h.rpc }));
vi.mock('@/integrations/supabase/getSupabase', () => ({
  getSupabase: async () => ({
    from: (table: string) => ({
      select: () => ({ eq: (col: string, id: string) => ({ maybeSingle: () => h.readRow(table, col, id) }) }),
    }),
  }),
}));

import { fetchProfileCompletion, useProfileCompletion } from '../useProfileCompletion';

const AUTH_ID = 'auth-user-A';
const PERSONA = 'linked-persona-B';
const FULL = { first_name: 'Ana', based_city_id: 'c1', dance_role: 'Follower', avatar_url: 'https://x/a.jpg' };

const arrange = (opts: { persona: string | null; complete: boolean; row?: Record<string, unknown> | null }) => {
  h.rpc.mockImplementation(async (fn: string) => {
    if (fn === '_my_dancer_profile_id_v1') return { data: opts.persona, error: null };
    if (fn === 'profile_complete_v1') return { data: opts.complete, error: null };
    return { data: null, error: { message: `unexpected ${fn}` } };
  });
  h.readRow.mockResolvedValue({ data: opts.row ?? null, error: null });
};

beforeEach(() => {
  h.user = { id: AUTH_ID };
  h.rpc.mockReset();
  h.readRow.mockReset();
});
afterEach(cleanup);

describe('fetchProfileCompletion', () => {
  it('asks profile_complete_v1 about the RESOLVED persona, never auth.uid()', async () => {
    arrange({ persona: PERSONA, complete: false, row: { ...FULL, avatar_url: null } });
    const c = await fetchProfileCompletion();
    expect(h.rpc).toHaveBeenCalledWith('profile_complete_v1', { p_person: PERSONA });
    expect(h.readRow).toHaveBeenCalledWith('dancer_profiles', 'id', PERSONA);
    const ids = [...h.rpc.mock.calls.flatMap((c) => Object.values(c[1] ?? {})), ...h.readRow.mock.calls.map((c) => c[2])];
    expect(ids).not.toContain(AUTH_ID);
    expect(c).toEqual({ status: 'incomplete', missing: ['avatar_url'], profileId: PERSONA });
  });

  it('complete: no row read at all', async () => {
    arrange({ persona: PERSONA, complete: true });
    expect(await fetchProfileCompletion()).toEqual({ status: 'complete', missing: [], profileId: PERSONA });
    expect(h.readRow).not.toHaveBeenCalled();
  });

  it('no profile row (resolver NULL): profile_complete_v1 is not called', async () => {
    arrange({ persona: null, complete: false });
    const c = await fetchProfileCompletion();
    expect(c.status).toBe('no_profile');
    expect(h.rpc).not.toHaveBeenCalledWith('profile_complete_v1', expect.anything());
  });

  it('server says incomplete but the row reads full (RLS or drift): ask for every field rather than show an empty form', async () => {
    arrange({ persona: PERSONA, complete: false, row: FULL });
    expect((await fetchProfileCompletion()).missing).toEqual(['first_name', 'based_city_id', 'dance_role', 'avatar_url']);
  });

  it('a failed resolver call is an error, not "no profile"', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'network' } });
    await expect(fetchProfileCompletion()).rejects.toBeTruthy();
  });
});

describe('useProfileCompletion', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
  );

  it('signed out: no call, status signed_out', () => {
    h.user = null;
    const { result } = renderHook(() => useProfileCompletion(), { wrapper });
    expect(result.current.status).toBe('signed_out');
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('anonymous session counts as signed out', () => {
    h.user = { id: AUTH_ID, is_anonymous: true };
    const { result } = renderHook(() => useProfileCompletion(), { wrapper });
    expect(result.current.status).toBe('signed_out');
  });

  it('signed in: loading, then the resolved shape', async () => {
    arrange({ persona: PERSONA, complete: false, row: { ...FULL, dance_role: null } });
    const { result } = renderHook(() => useProfileCompletion(), { wrapper });
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('incomplete'));
    expect(result.current.missing).toEqual(['dance_role']);
    expect(result.current.profileId).toBe(PERSONA);
  });

  it('a failed check reads as error (fail-open everywhere)', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { result } = renderHook(() => useProfileCompletion(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('error'));
  });
});
