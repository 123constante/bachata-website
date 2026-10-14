// @vitest-environment node
/**
 * Owner decision 2026-10-13: the public /videographers page is hidden
 * (src/lib/videographersPublic.ts). Table-driven over the flag: with it OFF the
 * path is a 404 / absent everywhere a crawler or a person could find it; with
 * it ON the page is restored. Every row mocks the flag module, so flipping the
 * shipped constant needs no test edit beyond the "shipped value" row.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');

// Sitemap loader mocks (same closed shape as tests/sitemapEdgeTtl.test.ts).
const empty: Record<string, unknown> = new Proxy({}, {
  get(_t, prop) {
    if (prop === 'then') return (r: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(r);
    if (typeof prop === 'string' && ['select', 'neq', 'order', 'limit', 'not'].includes(prop)) return () => empty;
    return undefined;
  },
}) as Record<string, unknown>;
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => empty, rpc: () => Promise.resolve({ data: [], error: null }) },
}));
vi.mock('@/lib/featureFlags', () => ({
  flags: { teachersDirectory: false, organisersDirectory: false, venueDetail: false, organiserDetail: false, teacherDetail: false, rafflesPage: false },
}));

const ROWS = [
  { enabled: false, listed: false },
  { enabled: true, listed: true },
];

async function withFlag(enabled: boolean) {
  vi.resetModules();
  vi.doMock('@/lib/videographersPublic', async () => {
    const actual = await vi.importActual<typeof import('@/lib/videographersPublic')>('@/lib/videographersPublic');
    return { ...actual, VIDEOGRAPHERS_PUBLIC_ENABLED: enabled, isPathPublic: (p: string) => enabled || p !== actual.VIDEOGRAPHERS_PATH };
  });
}

describe.each(ROWS)('videographers page, flag enabled=$enabled', ({ enabled, listed }) => {
  beforeEach(() => withFlag(enabled));

  it('catchall gate: /videographers is a page (200) only when enabled, else unknown (404)', async () => {
    const { classifyCatchallPath } = await import('../app/catchallGate');
    expect(classifyCatchallPath('/videographers').kind).toBe(listed ? 'client' : 'unknown');
  });

  it('sitemap lists /videographers only when enabled', async () => {
    const { loader } = await import('../app/routes/sitemap');
    const xml = await (await loader()).text();
    expect(xml.includes('<loc>https://www.bachatacalendar.co.uk/videographers</loc>')).toBe(listed);
    // control: a sibling directory is unaffected
    expect(xml).toContain('<loc>https://www.bachatacalendar.co.uk/vendors</loc>');
  });

  it('SEO map has the videographers spec only when enabled', async () => {
    const { buildSeoForRoute } = await import('@/lib/seo/buildSeoForRoute');
    const seo = buildSeoForRoute('videographers');
    expect(seo.title === 'Bachata Videographers').toBe(listed);
  });

  it('route table: /videographers is routable only when enabled', async () => {
    const { isRoutable } = await import('@/lib/__tests__/routeTable');
    expect(isRoutable('/videographers')).toBe(listed);
  });
});

describe('shipped state', () => {
  it('the shipped constant is false (page hidden)', async () => {
    vi.resetModules();
    vi.doUnmock('@/lib/videographersPublic');
    const m = await import('@/lib/videographersPublic');
    expect(m.VIDEOGRAPHERS_PUBLIC_ENABLED).toBe(false);
  });

  it('AnimatedRoutes mounts the route only behind the flag (splat -> NotFound otherwise)', () => {
    const src = readFileSync(path.join(ROOT, 'src/components/AnimatedRoutes.tsx'), 'utf8');
    expect(src).toMatch(/VIDEOGRAPHERS_PUBLIC_ENABLED\s*&&\s*\(\s*<Route path="\/videographers"/);
  });

  it('no src/app/public file links or navigates to /videographers (outside the page itself)', () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = path.join(dir, name);
        if (statSync(p).isDirectory()) { if (name !== 'node_modules') walk(p); continue; }
        if (!/\.(tsx?|html)$/.test(name) || /\.test\./.test(name) || /__tests__/.test(p)) continue;
        const rel = path.relative(ROOT, p).replace(/\\/g, '/');
        if (/^src\/(pages\/Videographers|lib\/videographersPublic|components\/catchallClientPaths|lib\/seo\/buildSeoForRoute|lib\/breadcrumbs\/siteIa|components\/AnimatedRoutes)/.test(rel)) continue;
        if (/^app\/(routes\/sitemap|cityCanonical)/.test(rel)) continue;
        const text = readFileSync(p, 'utf8');
        // a navigation target / href to the directory (not /videographers/<id>, which
        // is event-lineup display data and stays)
        if (/['"`(]\/videographers['"`)?#]/.test(text)) hits.push(rel);
      }
    };
    for (const d of ['src', 'app', 'public']) { try { walk(path.join(ROOT, d)); } catch { /* absent dir */ } }
    expect(hits).toEqual([]);
  });
});
