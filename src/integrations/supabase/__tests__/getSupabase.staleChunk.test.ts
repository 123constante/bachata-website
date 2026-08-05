// Unit test -- a deploy-stale chunk routes to the shared reload heal.
//
// lazyWithRetry.ts is the ONE place that heals a stale chunk, and its header
// states every code-split import must route through it. This locks that the
// accessor does: clearing its own memo would only re-request the SAME hashed
// URL, which is still 404 after a Vercel deploy. From P2 onward -- once
// client.ts is genuinely code-split -- getting this wrong strands a live tab
// with a client it can never load, and the raffle path would report its
// tolerant 'unavailable' forever rather than surfacing anything.
import { describe, it, expect, vi } from 'vitest';

const heal = vi.hoisted(() => ({ reloadAttempts: 0 }));

vi.mock('@/lib/staleChunk', () => ({
  isStaleChunkError: () => true,
  attemptChunkReloadOnce: () => {
    heal.reloadAttempts += 1;
    return true;
  },
  clearChunkReloadFlag: () => {},
}));

vi.mock('@/integrations/supabase/client', () => {
  throw new Error('Failed to fetch dynamically imported module');
});

describe('getSupabase -- stale chunk', () => {
  it('hands a stale-chunk failure to the once-per-session reload', async () => {
    const { getSupabase } = await import('../getSupabase');

    // Deliberately NOT awaited. safeDynamicImport returns a never-settling
    // promise once it has triggered the reload, so the caller cannot act on a
    // failed import in the window before navigation. Awaiting would hang.
    void getSupabase();

    await new Promise((resolve) => setTimeout(resolve, 0));

    // Fails if the accessor ever reverts to a bare `import('./client')`: the
    // rejection would propagate untouched and nothing would attempt a reload.
    expect(heal.reloadAttempts).toBe(1);
  });
});
