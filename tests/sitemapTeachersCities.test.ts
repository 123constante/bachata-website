// @vitest-environment node
/**
 * The teachers directory is one page per ACTIVE city (/city/<slug>/teachers),
 * so the sitemap lists exactly those -- never the bare /teachers (a redirect)
 * and never an inactive city -- and nothing at all while the flag is off.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  flags: { teachersDirectory: true, organisersDirectory: false, venueDetail: false, organiserDetail: false, teacherDetail: false },
  cities: [
    { slug: 'london-gb', name: 'London', is_active: true },
    { slug: 'manchester-gb', name: 'Manchester', is_active: true },
    { slug: 'madrid-es', name: 'Madrid', is_active: false },
  ],
}));

vi.mock('@/integrations/supabase/client', () => {
  const builder = (table: string): Record<string, unknown> => {
    const eqs: [string, unknown][] = [];
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'neq', 'order', 'limit', 'not']) b[m] = () => b;
    b.eq = (k: string, v: unknown) => { eqs.push([k, v]); return b; };
    b.then = (resolve: (v: unknown) => unknown) => {
      const rows = table === 'cities'
        ? h.cities.filter((r) => eqs.every(([k, v]) => (r as Record<string, unknown>)[k] === v))
        : [];
      return Promise.resolve({ data: rows, error: null }).then(resolve);
    };
    return b;
  };
  return { supabase: { from: (t: string) => builder(t), rpc: () => Promise.resolve({ data: [], error: null }) } };
});
vi.mock('@/lib/featureFlags', () => ({ flags: h.flags }));

async function teacherLocs(): Promise<string[]> {
  const { loader } = await import('../app/routes/sitemap');
  const xml = await (await loader()).text();
  return [...xml.matchAll(/<loc>([^<]*teachers[^<]*)<\/loc>/g)].map((m) => m[1].replace('https://www.bachatacalendar.co.uk', ''));
}

describe('sitemap: teachers directory per active city', () => {
  beforeEach(() => { h.flags.teachersDirectory = true; });

  it('flag on: one URL per active city, no bare /teachers, no inactive city', async () => {
    expect(await teacherLocs()).toEqual(['/city/london-gb/teachers', '/city/manchester-gb/teachers']);
  });

  it('flag off: no teachers directory URL at all', async () => {
    h.flags.teachersDirectory = false;
    expect(await teacherLocs()).toEqual([]);
  });
});
