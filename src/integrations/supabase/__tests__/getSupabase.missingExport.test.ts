// Unit test -- a client module that RESOLVES without a usable `supabase` export.
//
// The nastiest of the failure shapes, and the one the accessor exists beside:
// client.ts carries a "do not edit it directly" banner and is regenerated
// wholesale, so a regeneration that renamed or dropped the export leaves an
// import that SUCCEEDS. Without the presence check the accessor memoises
// `undefined` on a resolved promise -- invisible to any catch, surfacing far
// away as "cannot read properties of undefined (reading 'rpc')".
//
// `supabase: undefined` rather than an absent key on purpose: vitest's mock
// proxy throws its own "No export is defined" before module code runs, so an
// absent key would be testing vitest, not this accessor.
//
// Its own file because vitest CACHES a successful mock instantiation (unlike a
// throwing one), so this shape cannot be sequenced with the recovery case --
// every retry in this file re-reads the same bad module, which is precisely
// what the second assertion pins down.
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: undefined }));

describe('getSupabase -- unusable client export', () => {
  it('rejects with a diagnosis rather than memoising undefined', async () => {
    const { getSupabase } = await import('../getSupabase');

    const first = getSupabase();
    await expect(first).rejects.toThrow(/without a .?supabase.? export/);

    // The memo was dropped even though the underlying import RESOLVED: a fresh
    // promise, not the cached rejection. It rejects again here only because the
    // module itself is still broken.
    const second = getSupabase();
    expect(second).not.toBe(first);
    await expect(second).rejects.toThrow(/without a .?supabase.? export/);
  });
});
