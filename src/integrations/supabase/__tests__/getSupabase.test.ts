// Unit tests -- the lazy Supabase accessor, happy path (supabase-defer arc, P1).
//
// WHAT IS AND IS NOT PROVABLE HERE. Counting client CONSTRUCTIONS through a
// vi.mock factory does not work: vitest caches the mocked module, so the factory
// runs once whatever the accessor does, and a counter-based assertion passes
// either way. Asserting the RESOLVED VALUE is identical is equally hollow, for
// the same reason -- the module registry hands back the same object to every
// import. The honest discriminator is PROMISE IDENTITY: `import()` returns a
// fresh promise per call, so only a memo can return the same promise twice.
//
// "No static edge" is likewise not a unit-test property; it is a bundle fact,
// and P0's bundle-budget attribution measures it directly.
//
// One hoisted mock per FILE, and no doMock/doUnmock anywhere: an unmock at the
// end of a test body leaks into every later test if an assertion above it
// throws, and it strips the file-level registration rather than restoring it.
// The failure shapes live in sibling files for that reason.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { marker: 'client', rpc: () => {}, auth: {} },
}));

beforeEach(() => {
  vi.resetModules();
});

describe('getSupabase', () => {
  it('resolves the shared client', async () => {
    const { getSupabase } = await import('../getSupabase');
    const client = (await getSupabase()) as unknown as { marker: string };
    expect(client.marker).toBe('client');
  });

  it('memoises the PROMISE itself, not just the resolved value', async () => {
    const { getSupabase } = await import('../getSupabase');
    const first = getSupabase();
    const second = getSupabase();
    expect(first).toBe(second);
    expect(await first).toBe(await second);
  });

  it('gives concurrent callers one in-flight import, not a race', async () => {
    const { getSupabase } = await import('../getSupabase');
    // Started together, compared as PROMISES before either settles. Comparing
    // the resolved values instead would pass with the memo deleted, because
    // both imports resolve through the same cached module.
    const a = getSupabase();
    const b = getSupabase();
    expect(a).toBe(b);
    await Promise.all([a, b]);
  });
});
