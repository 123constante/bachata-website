// A fake of the Supabase HTTP API (PostgREST /rest/v1, GoTrue /auth/v1, Storage)
// for the PHONE suite (playwright.phone.config.ts). ONE answer() serves both sides
// of the page:
//   - the dev server's SSR loaders, through fakeSupabasePreload.mjs, which patches
//     Node's global fetch inside the dev-server process (page.route() can never
//     reach a server loader -- see playwright.config.ts webServer note);
//   - the browser, through page.route() in helpers.ts.
// So framework routes (/organisers/:id, /faq, /city/:slug ...) render for real,
// with no secret and no request leaving the machine. Table writes and write-shaped
// RPCs (WRITE_RPC_RE) are refused.
//
// Plain .mjs with no imports: the preload is loaded by Node via --import before
// the dev server, without any TypeScript loader.

// NOT the production ref: if a request ever slips past both interceptors it goes
// to a project that does not exist and fails, instead of reaching production.
// Still under *.supabase.co, because the CSP's connect-src only admits that.
export const FAKE_REF = 'phoneqafakenotaproject';
export const FAKE_ORIGIN = `https://${FAKE_REF}.supabase.co`;

export const ORG_ID = 'a0000000-0000-4000-8000-0000000000a1';
export const ORG_SLUG = 'ritmo-phone-qa';
export const CITY_ID = 'c1000000-0000-4000-8000-000000000001';

const LONG = 'Weekly bachata socials and classes in central London. '.repeat(6).trim();

/** Table rows, filtered by eq./is./in. query params. Shapes follow the public column lists. */
export const TABLES = {
  organiser_profiles: [
    {
      id: ORG_ID,
      slug: ORG_SLUG,
      name: 'Ritmo Phone QA',
      organisation_name: 'Ritmo Phone QA',
      first_name: null,
      surname: null,
      bio: LONG,
      short_bio: LONG.slice(0, 120),
      website: 'https://example.org/ritmo',
      instagram: 'ritmo',
      facebook: null,
      whatsapp: null,
      email: null,
      phone: null,
      photo_url: null,
      avatar_url: null,
      cover_url: null,
      gallery_urls: [],
      city_id: CITY_ID,
      is_active: true,
      lifecycle_status: 'live',
      team_member_ids: [],
      created_at: '2024-01-01T00:00:00Z',
    },
  ],
  cities: [{ id: CITY_ID, name: 'London', slug: 'london-gb', country_code: 'GB', is_active: true, timezone: 'Europe/London' }],
};

/** RPC answers by name. Anything unlisted answers [], unless it looks like a write. */
export const RPCS = {
  organiser_ownership_v1: { is_managed: true, i_own_it: true, my_role: 'owner' },
  // /city/:slug 404s unless the DB vouches for the slug (app/routes/home.tsx).
  is_valid_city_slug: true,
};

/** RPCs that change state are refused, so an accidental Save can never "succeed" here. */
const WRITE_RPC_RE = /^(?:record|save|create|update|delete|remove|upsert|insert|submit|set|claim|redeem|upload|add|cancel|publish|invite|accept|reject|transfer|rate|vote)_/;

const json = (status, body) => ({ status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

function matches(row, key, raw) {
  const v = row[key];
  const m = /^(not\.)?(eq|is|in|neq)\.(.*)$/.exec(raw);
  if (!m) return true; // select=, order=, limit= and anything we do not model
  const [, not, op, arg] = m;
  let hit;
  // `raw` comes from URLSearchParams, already decoded: decoding again throws on a literal %.
  if (op === 'eq') hit = String(v) === arg;
  else if (op === 'neq') hit = String(v) !== arg;
  else if (op === 'is') hit = arg === 'null' ? v == null : String(v) === arg;
  else hit = arg.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/"/g, '')).includes(String(v));
  return not ? !hit : hit;
}

/**
 * @param {{method: string, url: string, headers?: Record<string, string>}} req
 * @returns {{status: number, headers: Record<string,string>, body: string}}
 */
export function answer(req) {
  const url = new URL(req.url);
  const method = (req.method || 'GET').toUpperCase();
  const accept = (req.headers?.accept || req.headers?.Accept || '').toLowerCase();
  const path = url.pathname;
  if (path.startsWith('/auth/v1/')) return json(200, {});
  if (path.startsWith('/rest/v1/rpc/')) {
    const name = path.slice('/rest/v1/rpc/'.length);
    if (WRITE_RPC_RE.test(name)) return json(403, { message: `fake supabase: write RPC ${name} is refused` });
    return json(200, Object.prototype.hasOwnProperty.call(RPCS, name) ? RPCS[name] : []);
  }
  if (path.startsWith('/rest/v1/')) {
    if (method !== 'GET' && method !== 'HEAD') return json(403, { message: 'fake supabase: writes are refused' });
    const table = path.slice('/rest/v1/'.length);
    let rows = TABLES[table] ?? [];
    for (const [k, raw] of url.searchParams) {
      if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
      rows = rows.filter((r) => matches(r, k, raw));
    }
    const limit = Number(url.searchParams.get('limit'));
    if (limit > 0) rows = rows.slice(0, limit);
    if (accept.includes('vnd.pgrst.object')) {
      return rows.length === 1
        ? json(200, rows[0])
        : json(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `${rows.length} rows`, hint: null });
    }
    return { ...json(200, rows), headers: { 'content-type': 'application/json', 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` } };
  }
  return json(404, { message: 'fake supabase: no such endpoint' });
}
