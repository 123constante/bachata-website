// @vitest-environment node
/**
 * D38 (A-WEB2 review finding 4): the sitemap's organiser query applies the SAME lifecycle rule
 * as the organiser page read, the one NOT_PUBLIC_LIFECYCLE constant (never a second copy). An
 * archived or rejected page 404s, so submitting its URL makes Google report "Submitted URL not
 * found (404)".
 */
import { describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ calls: [] as { table: string; method: string; args: unknown[] }[] }));

vi.mock('@/integrations/supabase/client', () => {
  const builder = (table: string): Record<string, unknown> => {
    const b: Record<string, unknown> = {};
    for (const method of ['select', 'neq', 'order', 'limit', 'not', 'eq']) {
      b[method] = (...args: unknown[]) => {
        h.calls.push({ table, method, args });
        return b;
      };
    }
    b.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
    return b;
  };
  return { supabase: { from: (t: string) => builder(t), rpc: () => Promise.resolve({ data: [], error: null }) } };
});
vi.mock('@/lib/featureFlags', () => ({
  flags: { teachersDirectory: true, organisersDirectory: true, venueDetail: true, organiserDetail: true, teacherDetail: true },
}));

import { NOT_PUBLIC_LIFECYCLE } from '@/modules/profile/organiserPublicProfile';

describe('sitemap organiser visibility (D38)', () => {
  it('filters organiser_profiles by the page read\'s own NOT_PUBLIC_LIFECYCLE', async () => {
    const { loader } = await import('../app/routes/sitemap');
    await loader();
    const nots = h.calls.filter((c) => c.table === 'organiser_profiles' && c.method === 'not');
    expect(nots.map((c) => c.args)).toContainEqual([...NOT_PUBLIC_LIFECYCLE]);
    expect(NOT_PUBLIC_LIFECYCLE).toEqual(['lifecycle_status', 'in', '(archived,rejected)']);
  });
});
