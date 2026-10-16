// @vitest-environment jsdom
/**
 * The landing matrix: every login shape x {no returnTo, returnTo}. ONE mapping
 * (lib/accountGate composeAccountGate + lib/accountRouting signInLanding):
 * useAccountGate() and fetchAccountGate() must give the SAME answer for each row,
 * and the landing reads the gate's `deletion`.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const state = vi.hoisted(() => ({
  user: null as { id: string; is_anonymous?: boolean } | null,
  deletion: 'none' as 'none' | 'pending' | 'expired' | 'fail',
  persona: null as string | null,
  complete: false,
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('@/integrations/supabase/rpcLoose', () => ({
  rpcLoose: async (fn: string) => {
    if (fn === 'my_account_deletion_status_v1') {
      if (state.deletion === 'fail') return { data: null, error: { message: 'boom' } };
      return { data: { state: state.deletion, requested_at: null, restore_until: null }, error: null };
    }
    if (fn === '_my_dancer_profile_id_v1') return { data: state.persona, error: null };
    if (fn === 'profile_complete_v1') return { data: state.complete, error: null };
    return { data: null, error: { message: `unexpected ${fn}` } };
  },
}));
vi.mock('@/integrations/supabase/getSupabase', () => ({
  getSupabase: async () => ({
    auth: { getSession: async () => ({ data: { session: state.user ? { user: state.user } : null } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { first_name: 'Ana', based_city_id: null, dance_role: null, avatar_url: null }, error: null }) }) }) }),
  }),
}));

import { fetchAccountGate, useAccountGate, type SettledAccountGate } from '@/lib/accountGate';
import { APP_HOME_PATH, APP_WELCOME_PATH, ORGANISER_HOME_PATH, restorePathFor, signInLanding, type SidesFacts } from '@/lib/accountRouting';

const ORG_A = { id: 'org-a', name: 'Bachata Nights', avatar_url: null };
const ORG_B = { id: 'org-b', name: 'Sensual Sundays', avatar_url: null };
const RETURN_TO = '/event/abc';

type Row = {
  name: string;
  signedIn: boolean;
  deletion: 'none' | 'pending' | 'expired';
  persona: string | null;
  complete: boolean;
  gate: Pick<SettledAccountGate, 'status' | 'deletion'>;
  /** The sides facts the screen reads (everything the gate does not). */
  sides: Partial<SidesFacts>;
  /** Landing with no returnTo: a path, or the chooser's keys. */
  landing: string | string[];
  /** Landing with a returnTo. */
  landingReturn: string | string[];
};

const ROWS: Row[] = [
  { name: 'signed out', signedIn: false, deletion: 'none', persona: null, complete: false, gate: { status: 'signed-out', deletion: null }, sides: {}, landing: '', landingReturn: '' },
  {
    name: 'deleted < 30 days (restorable)', signedIn: true, deletion: 'pending', persona: null, complete: false,
    gate: { status: 'deleted', deletion: 'restore' }, sides: { dancer: 'no_profile' },
    landing: restorePathFor(null), landingReturn: restorePathFor(RETURN_TO),
  },
  {
    name: 'deleted > 30 days (the deleted card)', signedIn: true, deletion: 'expired', persona: 'p1', complete: true,
    gate: { status: 'deleted', deletion: 'deleted-card' }, sides: { dancer: 'complete', organisers: [ORG_A] },
    landing: restorePathFor(null), landingReturn: restorePathFor(RETURN_TO),
  },
  {
    name: 'empty (no dancer profile, no organiser)', signedIn: true, deletion: 'none', persona: null, complete: false,
    gate: { status: 'incomplete', deletion: null }, sides: { dancer: 'no_profile', isAdmin: false },
    landing: APP_WELCOME_PATH, landingReturn: RETURN_TO,
  },
  {
    name: 'dancer incomplete', signedIn: true, deletion: 'none', persona: 'p1', complete: false,
    gate: { status: 'incomplete', deletion: null }, sides: { dancer: 'incomplete' },
    landing: APP_WELCOME_PATH, landingReturn: RETURN_TO,
  },
  {
    name: 'dancer complete', signedIn: true, deletion: 'none', persona: 'p1', complete: true,
    gate: { status: 'complete', deletion: null }, sides: { dancer: 'complete' },
    landing: APP_HOME_PATH, landingReturn: RETURN_TO,
  },
  {
    name: 'organiser 1 (no dancer profile)', signedIn: true, deletion: 'none', persona: null, complete: false,
    gate: { status: 'incomplete', deletion: null }, sides: { dancer: 'no_profile', organisers: [ORG_A] },
    landing: ORGANISER_HOME_PATH, landingReturn: RETURN_TO,
  },
  {
    name: 'organiser 1 + dancer complete (Continue as)', signedIn: true, deletion: 'none', persona: 'p1', complete: true,
    gate: { status: 'complete', deletion: null }, sides: { dancer: 'complete', organisers: [ORG_A] },
    landing: ['organiser:org-a', 'dancer'], landingReturn: RETURN_TO,
  },
  {
    name: 'organisers 2+ + dancer (Continue as)', signedIn: true, deletion: 'none', persona: 'p1', complete: true,
    gate: { status: 'complete', deletion: null }, sides: { dancer: 'complete', organisers: [ORG_A, ORG_B] },
    landing: ['organiser:org-a', 'organiser:org-b', 'dancer'], landingReturn: RETURN_TO,
  },
  {
    name: 'organiser-intent, finished dancer (claim screen)', signedIn: true, deletion: 'none', persona: 'p1', complete: true,
    gate: { status: 'complete', deletion: null }, sides: { dancer: 'complete', organiserIntent: true, openRequestCount: 0 },
    landing: ORGANISER_HOME_PATH, landingReturn: RETURN_TO,
  },
  {
    name: 'admin (no side): the site home, as today', signedIn: true, deletion: 'none', persona: null, complete: false,
    gate: { status: 'incomplete', deletion: null }, sides: { dancer: 'no_profile', isAdmin: true },
    landing: '/', landingReturn: RETURN_TO,
  },
];

const wrapper = ({ children }: { children: ReactNode }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

const setWorld = (row: Row) => {
  state.user = row.signedIn ? { id: 'u1' } : null;
  state.deletion = row.deletion;
  state.persona = row.persona;
  state.complete = row.complete;
};

const facts = (row: Row, gate: { deletion: SettledAccountGate['deletion'] }): SidesFacts => ({
  organisers: [],
  dancer: 'no_profile',
  areaAllowed: true,
  ...row.sides,
  deletion: gate.deletion,
});

const landOf = (f: SidesFacts, returnTo: string | null): string | string[] => {
  const l = signInLanding(f, returnTo);
  if (l.kind === 'choose') return l.sides.map((s) => s.key);
  if (l.kind === 'go') return l.to;
  return 'wait';
};

beforeEach(() => setWorld(ROWS[0]));

describe.each(ROWS)('$name', (row) => {
  it('fetchAccountGate and useAccountGate give the same answer', async () => {
    setWorld(row);
    const fetched = await fetchAccountGate();
    expect({ status: fetched.status, deletion: fetched.deletion }).toEqual(row.gate);

    const { result } = renderHook(() => useAccountGate(), { wrapper });
    await waitFor(() => expect(result.current.status).not.toBe('loading'));
    expect(result.current).toEqual(fetched);
    // status 'deleted' exactly when a deletion landing exists
    expect(fetched.status === 'deleted').toBe(fetched.deletion !== null);
  });

  if (row.signedIn) {
    it('lands: no returnTo', () => {
      expect(landOf(facts(row, row.gate), null)).toEqual(row.landing);
    });
    it('lands: with a returnTo (deleted first, else the link the person followed)', () => {
      expect(landOf(facts(row, row.gate), RETURN_TO)).toEqual(row.landingReturn);
    });
  }
});

describe('the gate itself', () => {
  it('a failed deletion read never strands a sign-in: it reads as not deleted', async () => {
    state.user = { id: 'u1' };
    state.deletion = 'fail';
    state.persona = 'p1';
    state.complete = true;
    expect((await fetchAccountGate()).status).toBe('complete');
  });
  it('a loading deletion read waits the landing', () => {
    expect(signInLanding({ organisers: [], dancer: 'complete', areaAllowed: true, deletion: 'loading' }, null)).toEqual({ kind: 'wait' });
  });
});
