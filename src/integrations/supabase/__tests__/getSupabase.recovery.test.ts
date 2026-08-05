// Unit tests -- the accessor's failure recovery (supabase-defer arc, P1).
//
// Its own file with ONE hoisted mock: sharing a file with the happy-path mock
// would need doMock/doUnmock, which leaks across tests when an assertion throws.
//
// This covers the THROWING failure, which vitest does not cache -- a module
// whose factory throws is re-instantiated on the next import, so the recovery
// really is observable. The resolve-without-an-export failure behaves
// differently for exactly that reason and lives in its own sibling file.
import { describe, it, expect, vi } from 'vitest';

const state = vi.hoisted(() => ({ attempts: 0 }));

vi.mock('@/integrations/supabase/client', () => {
  state.attempts += 1;
  // Deliberately NOT a stale-chunk message: this is the plain-rejection path,
  // where safeDynamicImport rethrows and the memo must be dropped.
  if (state.attempts === 1) throw new Error('transient module failure');
  return { supabase: { marker: 'recovered' } };
});

describe('getSupabase -- failure recovery', () => {
  it('clears the memo on a failed load, so a later call recovers', async () => {
    // A cached rejection would turn one transient failure into a client that
    // stays dead for the rest of the session.
    const { getSupabase } = await import('../getSupabase');

    const failed = getSupabase();
    // Asserted without matching the message: vitest wraps a throw from a mock
    // factory in its own diagnostic. The property is that it rejects and the
    // memo is dropped, not the wording.
    await expect(failed).rejects.toThrow();

    const retry = getSupabase();
    // A different promise, i.e. the memo really was cleared rather than reserved.
    expect(retry).not.toBe(failed);

    const client = (await retry) as unknown as { marker: string };
    expect(client.marker).toBe('recovered');
    expect(state.attempts).toBe(2);
  });
});
