// @vitest-environment node
/**
 * app/routes/dancers.tsx with public page v2: the loader reads the open flag
 * (dancer_area_gate_v1) and the extras, and the HEAD (title, description,
 * canonical, og tags, robots/noindex, JSON-LD count), the entity name, the slug,
 * the cache tag and the 404s are IDENTICAL in every mode, for every shape.
 * The fake client mirrors tests/regression/today/dancerRoute.today.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Row = {
  id: string;
  slug: string | null;
  first_name: string | null;
  avatar_url?: string | null;
  cities?: { name: string } | null;
  dancing_role_details?: Record<string, unknown> | null;
  /** false = paused / hidden / archived: anon RLS returns no row, the extras RPC returns SQL null. */
  visible?: boolean;
  names: { surname: string | null; display_name: string | null; public_name: string | null } | null;
};

const U = (n: number) => `00000000-0000-4000-8000-00000000${String(n).padStart(4, '0')}`;
const AVATAR = 'https://cdn.example.test/ana.jpg';

const SHAPES: Record<string, Row> = {
  photoless: { id: U(1), slug: 'dani', first_name: 'Dani', names: { surname: null, display_name: 'Dani', public_name: 'Dani' } },
  'long name': { id: U(2), slug: 'maria', first_name: 'Maria-Fernanda', avatar_url: AVATAR, names: { surname: null, display_name: 'Maria-Fernanda Alejandra de los Santos', public_name: 'Maria-Fernanda Alejandra de los Santos' } },
  'surname hidden': { id: U(3), slug: 'fay', first_name: 'Fay', avatar_url: AVATAR, names: { surname: null, display_name: 'Fay', public_name: 'Fay' } },
  nameless: { id: U(4), slug: 'nameless', first_name: null, names: { surname: null, display_name: null, public_name: null } },
  'admin-made unclaimed': { id: U(5), slug: 'eli-gomez', first_name: 'Eli', avatar_url: AVATAR, names: { surname: null, display_name: 'Eli Gomez', public_name: 'Eli Gomez' } },
  'four-field complete': { id: U(6), slug: 'ana-lopez', first_name: 'Ana', avatar_url: AVATAR, cities: { name: 'London' }, names: { surname: 'Lopez', display_name: 'Ana Lopez', public_name: 'Ana Lopez' } },
  paused: { id: U(7), slug: 'paused', first_name: 'Pat', visible: false, names: null },
};

type GateMode = 'closed' | 'open' | 'gate error' | 'gate odd shape';
const MODES: GateMode[] = ['closed', 'open', 'gate error', 'gate odd shape'];

const h = vi.hoisted(() => ({ hang: false, rows: [] as Row[], mode: 'closed' as string, extras: 'ok' as 'ok' | 'error' | 'hang', rpcCalls: [] as string[] }));

const client = () => {
  const query = (table: string) => {
    let cols = '';
    let where: [string, unknown] | null = null;
    const b = {
      select(c: string) { cols = c; return b; },
      eq(col: string, val: unknown) { where = [col, val]; return b; },
      not() { return b; },
      async maybeSingle() {
        if (table !== 'dancer_profiles' || !where) return { data: null, error: null };
        const row = h.rows.find((r) => (where![0] === 'slug' ? r.slug === where![1] : r.id === where![1]));
        if (!row) return { data: null, error: null };
        if (cols.startsWith('id, slug')) return { data: { id: row.id, slug: row.slug }, error: null };
        if (row.visible === false) return { data: null, error: null };
        const { slug: _s, names: _n, visible: _v, ...content } = row;
        return { data: content, error: null };
      },
    };
    return b;
  };
  return {
    from: query,
    rpc: async (name: string, args: { p_ids?: string[]; p_profile_id?: string }) => {
      h.rpcCalls.push(name);
      if (name === 'get_public_dancer_names_v1') {
        return { data: h.rows.filter((r) => r.names && args.p_ids?.includes(r.id)).map((r) => ({ id: r.id, ...r.names })), error: null };
      }
      if (name === 'dancer_area_gate_v1') {
        if (h.hang) return new Promise(() => undefined);
        if (h.mode === 'gate error') return { data: null, error: { message: 'network' } };
        if (h.mode === 'gate odd shape') return { data: { open: 'yes' }, error: null };
        return { data: { open: h.mode === 'open', allowed: false }, error: null };
      }
      if (name === 'get_public_dancer_extras_v1') {
        if (h.extras === 'error') return { data: null, error: { message: 'boom' } };
        if (h.extras === 'hang') return new Promise(() => undefined);
        const row = h.rows.find((r) => r.id === args.p_profile_id);
        return { data: row && row.visible !== false ? { bio: 'Hi', languages: ['English'], whatsapp: null } : null, error: null };
      }
      return { data: null, error: null };
    },
  };
};

vi.mock('@/integrations/supabase/client', () => ({ get supabase() { return client(); } }));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => client() }));

const callLoader = async (param: string) => {
  const mod = await import('../../../../../app/routes/dancers');
  try {
    const out = (await mod.loader({ params: { id: param }, request: new Request(`https://example.test/dancers/${param}`), context: {} as never } as never)) as {
      data: { entityName?: string; entitySlug?: string; ogImage?: string; publicPage: unknown };
      init: { headers: Record<string, string> };
    };
    const metaTags = mod.meta({ data: out.data } as never);
    return { kind: 'ok' as const, bound: out.init.headers['X-Edge-Ttl-Bound'] ?? null, publicPage: out.data.publicPage, same: { entityName: out.data.entityName ?? null, entitySlug: out.data.entitySlug, ogImage: out.data.ogImage, tag: out.init.headers['Vercel-Cache-Tag'], meta: metaTags } };
  } catch (e) {
    if (e instanceof Response) return { kind: 'response' as const, publicPage: undefined, same: { status: e.status, robots: e.headers.get('X-Robots-Tag') } };
    throw e;
  }
};

beforeEach(() => {
  h.hang = false;
  h.rows = Object.values(SHAPES);
  h.mode = 'closed';
  h.extras = 'ok';
  h.rpcCalls = [];
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe.each(Object.entries(SHAPES))('%s', (_name, row) => {
  it('head, entity name, slug, og image, cache tag and status are identical in every flag mode', async () => {
    h.mode = 'closed';
    const baseline = await callLoader(row.slug!);
    for (const mode of MODES) {
      h.mode = mode;
      const out = await callLoader(row.slug!);
      expect(out.kind, mode).toBe(baseline.kind);
      expect(out.same, mode).toEqual(baseline.same);
    }
  });

  it('v2 data only when the flag is open; closed or a failed read = today (null)', async () => {
    for (const mode of MODES) {
      h.mode = mode;
      const out = await callLoader(row.slug!);
      if (out.kind === 'response') continue;
      if (mode === 'open') expect(out.publicPage, mode).toEqual({ extrasOk: true, extras: { bio: 'Hi', languages: ['English'], whatsapp: null, goingNext: [] } });
      else expect(out.publicPage, mode).toBeNull();
    }
  });
});

describe('rules', () => {
  it('nameless stays 200 + noindex in v2', async () => {
    h.mode = 'open';
    const out = await callLoader('nameless');
    expect(out.kind).toBe('ok');
    if (out.kind === 'ok') expect(JSON.stringify(out.same.meta)).toContain('noindex');
  });

  it('paused: the same 404 as today, in both modes', async () => {
    for (const mode of ['closed', 'open']) {
      h.mode = mode;
      const out = await callLoader('paused');
      expect(out.kind).toBe('response');
      if (out.kind === 'response') expect(out.same.status).toBe(404);
    }
  });

  it('extras failure with the flag open: v2 still shows, without bio / languages / WhatsApp', async () => {
    h.mode = 'open';
    h.extras = 'error';
    const out = await callLoader('dani');
    expect(out.publicPage).toEqual({ extrasOk: false, extras: { bio: null, languages: [], whatsapp: null } });
  });

  it('surname hidden: nothing in the v2 payload or the head carries a surname', async () => {
    h.mode = 'open';
    const out = await callLoader('fay');
    expect(JSON.stringify(out)).not.toMatch(/surname"\s*:\s*"[^"]/);
  });

  // F17: extras are read only AFTER the flag says open (sequenced), never read-then-discarded.
  it.each(['closed', 'gate error', 'gate odd shape'] as const)('flag %s: the extras RPC is never called', async (mode) => {
    h.mode = mode;
    await callLoader('dani');
    expect(h.rpcCalls).not.toContain('get_public_dancer_extras_v1');
  });

  it('a hanging gate read: the extras RPC is never called either', async () => {
    h.hang = true;
    await callLoader('dani');
    expect(h.rpcCalls).not.toContain('get_public_dancer_extras_v1');
  });

  it('flag open: the extras RPC is called after the gate, once', async () => {
    h.mode = 'open';
    await callLoader('dani');
    const gateAt = h.rpcCalls.indexOf('dancer_area_gate_v1');
    const extrasAt = h.rpcCalls.indexOf('get_public_dancer_extras_v1');
    expect(gateAt).toBeGreaterThanOrEqual(0);
    expect(extrasAt).toBeGreaterThan(gateAt);
    expect(h.rpcCalls.filter((n) => n === 'get_public_dancer_extras_v1')).toHaveLength(1);
  });

  it('flag open but a hanging extras read: v2 without extras, cached briefly, inside the same deadline', async () => {
    h.mode = 'open';
    h.extras = 'hang';
    const t0 = Date.now();
    const out = await callLoader('dani');
    expect(Date.now() - t0).toBeLessThan(4000);
    if (out.kind !== 'ok') throw new Error('expected 200');
    expect(out.publicPage).toEqual({ extrasOk: false, extras: { bio: null, languages: [], whatsapp: null } });
    expect(out.bound).toBe('60');
  });

  it('records no profile view in the loader (no recorder added)', async () => {
    h.mode = 'open';
    await callLoader('ana-lopez');
    expect(h.rpcCalls.filter((n) => /view/.test(n))).toEqual([]);
  });

  it('a hanging gate read falls back to today\'s page within the deadline (never the 8s SSR error page)', async () => {
    h.hang = true;
    const t0 = Date.now();
    const out = await callLoader('dani');
    expect(out.kind).toBe('ok');
    expect(out.publicPage).toBeNull();
    expect(Date.now() - t0).toBeLessThan(4000);
  });

  it('a failed read is cached briefly; a clean answer keeps the normal edge TTL', async () => {
    h.mode = 'gate error';
    const failed = await callLoader('dani');
    h.mode = 'open';
    h.extras = 'error';
    const extrasFailed = await callLoader('dani');
    h.extras = 'ok';
    const clean = await callLoader('dani');
    h.mode = 'closed';
    const closed = await callLoader('dani');
    if (failed.kind !== 'ok' || extrasFailed.kind !== 'ok' || clean.kind !== 'ok' || closed.kind !== 'ok') throw new Error('expected 200s');
    expect(failed.bound).toBe('60');
    expect(extrasFailed.bound).toBe('60');
    expect(clean.bound).toBeNull();
    expect(closed.bound).toBeNull();
  });
});
