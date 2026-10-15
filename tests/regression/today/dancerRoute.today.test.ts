// @vitest-environment node
/**
 * TODAY's /dancers/:id ROUTE (app/routes/dancers.tsx: loader + meta + headers),
 * pinned for the production-shaped rows the rebuild's public page v2 must not
 * disturb: head tags (title, description, canonical, og:type, og:image, robots),
 * the noindex rule for a nameless profile, the uuid -> slug 301, the 404s
 * (unknown, deactivated), the cache tag, and the hidden-surname names that come
 * only through get_public_dancer_names_v1. JSON-LD: the route emits NONE today
 * (asserted, so adding one is a visible change, not a silent one).
 * The fake client mirrors the two reads the loader makes (slug lookup, content
 * select) and the names RPC; it is a mirror, not the live database.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Row = {
  id: string;
  slug: string | null;
  first_name: string | null;
  nationality?: string | null;
  dance_role?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  avatar_url?: string | null;
  website_url?: string | null;
  gallery_urls?: string[] | null;
  cities?: { name: string } | null;
  dancing_role_details?: Record<string, unknown> | null;
  is_active?: boolean | null;
  /** What get_public_dancer_names_v1 answers for this id (null = not visible / RPC returns no row). */
  names: { surname: string | null; display_name: string | null; public_name: string | null } | null;
};

const U = (n: number) => `00000000-0000-4000-8000-00000000${String(n).padStart(4, '0')}`;
const AVATAR = 'https://cdn.example.test/ana.jpg';

const SHAPES: Record<string, Row> = {
  'empty stub (no name at all)': { id: U(1), slug: null, first_name: null, names: { surname: null, display_name: null, public_name: null } },
  'name + city only': { id: U(2), slug: 'bea', first_name: 'Bea', cities: { name: 'London' }, names: { surname: null, display_name: 'Bea', public_name: 'Bea' } },
  'four-field complete': { id: U(3), slug: 'ana-lopez', first_name: 'Ana', dance_role: 'Follower', avatar_url: AVATAR, cities: { name: 'London' }, names: { surname: 'Lopez', display_name: 'Ana Lopez', public_name: 'Ana Lopez' } },
  'complete + all extras': {
    id: U(4), slug: 'carla-ruiz', first_name: 'Carla', nationality: 'Spain', dance_role: 'Lead and Follow', instagram: '@carla', facebook: 'carla.ruiz', website_url: 'carla.example',
    avatar_url: AVATAR, gallery_urls: ['https://cdn.example.test/g1.jpg', 'https://cdn.example.test/g2.jpg'], cities: { name: 'Manchester' },
    dancing_role_details: { dance_started_year: 2015, favorite_styles: ['Sensual', 'Dominican'], achievements: ['Best newcomer 2022'], favorite_songs: ['Obsesion'], looking_for_partner: true, partner_search_role: 'Leader', partner_search_level: ['Intermediate'], partner_practice_goals: ['Footwork'], partner_details: 'Weekday evenings' },
    names: { surname: 'Ruiz', display_name: 'Carla Ruiz', public_name: 'Carla Ruiz' },
  },
  'admin-made, unclaimed, photoless': { id: U(5), slug: 'dani', first_name: 'Dani', names: { surname: null, display_name: 'Dani', public_name: 'Dani' } },
  'admin-made, surname inside display_name': { id: U(6), slug: 'eli-gomez', first_name: 'Eli', avatar_url: AVATAR, names: { surname: null, display_name: 'Eli Gomez', public_name: 'Eli Gomez' } },
  'hidden surname (RPC masks it)': { id: U(7), slug: 'fay', first_name: 'Fay', avatar_url: AVATAR, names: { surname: null, display_name: 'Fay', public_name: 'Fay' } },
  'names RPC returns no row (fails closed to first name)': { id: U(8), slug: 'gus', first_name: 'Gus', names: null },
  'deactivated (is_active=false)': { id: U(9), slug: 'hal', first_name: 'Hal', is_active: false, names: { surname: null, display_name: 'Hal', public_name: 'Hal' } },
};

const h = vi.hoisted(() => ({ rows: [] as Row[] }));

const client = () => {
  const query = (table: string) => {
    let cols = '';
    let where: [string, unknown] | null = null;
    let activeOnly = false;
    const b = {
      select(c: string) { cols = c; return b; },
      eq(col: string, val: unknown) { where = [col, val]; return b; },
      not(col: string, op: string, val: unknown) { if (col === 'is_active' && op === 'is' && val === false) activeOnly = true; return b; },
      async maybeSingle() {
        if (table !== 'dancer_profiles' || !where) return { data: null, error: null };
        const row = h.rows.find((r) => (where![0] === 'slug' ? r.slug === where![1] : r.id === where![1]));
        if (!row) return { data: null, error: null };
        if (cols.startsWith('id, slug')) return { data: { id: row.id, slug: row.slug }, error: null };
        if (activeOnly && row.is_active === false) return { data: null, error: null };
        const { slug: _s, names: _n, is_active: _a, ...content } = row;
        return { data: content, error: null };
      },
    };
    return b;
  };
  return {
    from: query,
    rpc: async (name: string, args: { p_ids?: string[] }) => {
      if (name !== 'get_public_dancer_names_v1') return { data: null, error: null };
      return { data: h.rows.filter((r) => r.names && args.p_ids?.includes(r.id)).map((r) => ({ id: r.id, ...r.names })), error: null };
    },
  };
};

vi.mock('@/integrations/supabase/client', () => ({ get supabase() { return client(); } }));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => client() }));

const callLoader = async (param: string) => {
  const mod = await import('../../../app/routes/dancers');
  try {
    const out = (await mod.loader({ params: { id: param }, request: new Request(`https://example.test/dancers/${param}?x=1`), context: {} as never } as never)) as {
      data: { entityName?: string; entitySlug?: string; ogImage?: string };
      init: { headers: Record<string, string> };
    };
    const metaTags = mod.meta({ data: out.data } as never) as Array<Record<string, string>>;
    const loaderHeaders = new Headers(out.init.headers);
    const cdn = mod.headers({ loaderHeaders } as never);
    return { kind: 'ok' as const, data: out.data, metaTags, tag: out.init.headers['Vercel-Cache-Tag'], cdnKeys: Object.keys(cdn).sort() };
  } catch (e) {
    if (e instanceof Response) return { kind: 'response' as const, status: e.status, location: e.headers.get('Location'), robots: e.headers.get('X-Robots-Tag') };
    throw e;
  }
};

const pick = (tags: Array<Record<string, string>>) => ({
  title: tags.find((t) => 'title' in t)?.title,
  description: tags.find((t) => t.name === 'description')?.content,
  canonical: tags.find((t) => t.rel === 'canonical')?.href,
  ogType: tags.find((t) => t.property === 'og:type')?.content,
  ogImage: tags.find((t) => t.property === 'og:image')?.content,
  robots: tags.find((t) => t.name === 'robots')?.content ?? null,
  jsonLd: tags.filter((t) => t.type === 'application/ld+json' || 'script:ld+json' in t || 'json-ld' in t).length,
});

beforeEach(() => {
  h.rows = Object.values(SHAPES);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe('/dancers/:id route, by shape (requested by slug)', () => {
  it.each(Object.entries(SHAPES).filter(([, r]) => r.slug))('%s', async (_name, row) => {
    const out = await callLoader(row.slug!);
    if (out.kind === 'response') {
      expect({ status: out.status, robots: out.robots }).toMatchSnapshot();
      return;
    }
    expect({ entityName: out.data.entityName ?? null, entitySlug: out.data.entitySlug, tag: out.tag, head: pick(out.metaTags), cdnKeys: out.cdnKeys }).toMatchSnapshot();
  });

  it('a profile with no resolvable name is 200 + noindex (not a 404), and a named one is indexable', async () => {
    h.rows = [{ ...SHAPES['empty stub (no name at all)'], slug: 'nameless' }];
    const nameless = await callLoader('nameless');
    expect(nameless.kind).toBe('ok');
    if (nameless.kind === 'ok') expect(pick(nameless.metaTags).robots).toBe('noindex,nofollow');
    h.rows = Object.values(SHAPES);
    const named = await callLoader('ana-lopez');
    if (named.kind === 'ok') expect(pick(named.metaTags).robots).toBeNull();
  });

  it('hidden surname: only the masked name reaches the head and the entity name', async () => {
    const out = await callLoader('fay');
    expect(out.kind).toBe('ok');
    if (out.kind === 'ok') {
      expect(out.data.entityName).toBe('Fay');
      expect(JSON.stringify(out.metaTags)).not.toMatch(/surname/i);
    }
  });

  it('emits no JSON-LD today', async () => {
    for (const row of Object.values(SHAPES).filter((r) => r.slug && r.is_active !== false)) {
      const out = await callLoader(row.slug!);
      if (out.kind === 'ok') expect(pick(out.metaTags).jsonLd, row.slug!).toBe(0);
    }
  });

  it('og:image: the avatar goes through /api/og/card, a photoless profile gets the default card', async () => {
    const withPhoto = await callLoader('ana-lopez');
    const without = await callLoader('dani');
    if (withPhoto.kind === 'ok' && without.kind === 'ok') {
      expect(pick(withPhoto.metaTags).ogImage).toContain('/api/og/card?kind=image&src=');
      expect(pick(without.metaTags).ogImage).not.toContain('/api/og/card');
    }
  });
});

describe('/dancers/:id route, by uuid and misses', () => {
  it('uuid with a canonical slug -> 301 to the slug, query string kept', async () => {
    expect(await callLoader(SHAPES['four-field complete'].id)).toMatchSnapshot();
  });
  it('uuid with no slug yet -> served at the uuid', async () => {
    const out = await callLoader(SHAPES['empty stub (no name at all)'].id);
    expect(out.kind).toBe('ok');
  });
  it('unknown slug -> 404 + noindex', async () => {
    expect(await callLoader('nobody-here')).toMatchSnapshot();
  });
  it('malformed uuid prefix -> 404 + noindex', async () => {
    expect(await callLoader('00000000-0000-4000-zzzz')).toMatchSnapshot();
  });
  it('deactivated profile -> 404 + noindex', async () => {
    expect(await callLoader('hal')).toMatchSnapshot();
  });
});
