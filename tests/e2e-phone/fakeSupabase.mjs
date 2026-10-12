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
// A second organiser WITH upcoming nights (the first has none): the "Upcoming
// events" heading row and its owner-only Create event link need one.
export const ORG2_ID = 'a0000000-0000-4000-8000-0000000000a2';
export const ORG2_SLUG = 'salsa-nights-phone-qa';
// The City sheet's pick (resolveCanonicalCity confirms it against `cities`).
// Hero-polish organisers: a long name, a long category and a founded year, for
// organiser-hero-owner.phone.spec.ts. Looked up by slug only.
export const HERO_ORGS = [
  { id: 'a0000000-0000-4000-8000-0000000000a3', slug: 'bachata-playground-phone-qa', name: 'Bachata Playground' },
  { id: 'a0000000-0000-4000-8000-0000000000a4', slug: 'long-name-phone-qa', name: 'Bachata Playground Dance Company L' },
];
export const HERO_CATEGORY = 'Dance school and social events';

export const CITY2_ID = 'c1000000-0000-4000-8000-000000000002';

// search_cities, matched on the display name and cut to p_limit (the organiser
// search asks for 12): "united" matches every row, so the City sheet's list
// overflows and must scroll inside the sheet at 360x640.
const SEARCH_CITY_NAMES = ['London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Liverpool', 'Bristol', 'Sheffield', 'Edinburgh', 'Leicester',
  'Coventry', 'Bradford', 'Cardiff', 'Belfast', 'Nottingham', 'Southampton', 'Brighton', 'Newcastle upon Tyne', 'Plymouth', 'Reading'];
const searchCityRows = (q, limit) => SEARCH_CITY_NAMES
  .map((name, i) => ({
    city_id: i === 0 ? CITY_ID : i === 1 ? CITY2_ID : `c1000000-0000-4000-8000-0000000000${String(i + 10).padStart(2, '0')}`,
    city_name: name,
    city_slug: `${name.toLowerCase().replace(/\W+/g, '-')}-gb`,
    country_name: 'United Kingdom',
    display_name: `${name}, United Kingdom`,
  }))
  .filter((r) => r.display_name.toLowerCase().includes(String(q ?? '').toLowerCase()))
  .slice(0, Number(limit) || 20);

const LONG = 'Weekly bachata socials and classes in central London. '.repeat(6).trim();

/** Table rows, filtered by eq./is./in. query params. Shapes follow the public column lists. */
const HERO_BASE = {
  first_name: null, surname: null, bio: 'Weekly socials.', short_bio: 'Weekly socials.', website: null, instagram: 'bachataplayground',
  facebook: null, whatsapp: null, email: null, phone: null, photo_url: null, avatar_url: null, cover_url: null, gallery_urls: [],
  city_id: CITY_ID, is_active: true, lifecycle_status: 'live', team_member_ids: [], created_at: '2024-01-01T00:00:00Z',
  organisation_category: HERO_CATEGORY, founded_year: 2012,
};

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
    {
      id: ORG2_ID,
      slug: ORG2_SLUG,
      name: 'Salsa Nights Phone QA',
      organisation_name: 'Salsa Nights Phone QA',
      first_name: null,
      surname: null,
      bio: 'Monthly socials.',
      short_bio: 'Monthly socials.',
      website: null,
      instagram: 'salsanights',
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
    {
      ...HERO_BASE,
      id: HERO_ORGS[0].id,
      slug: HERO_ORGS[0].slug,
      name: HERO_ORGS[0].name,
      organisation_name: HERO_ORGS[0].name,
    },
    {
      ...HERO_BASE,
      id: HERO_ORGS[1].id,
      slug: HERO_ORGS[1].slug,
      name: HERO_ORGS[1].name,
      organisation_name: HERO_ORGS[1].name,
    },
  ],
  cities: [
    { id: CITY_ID, name: 'London', slug: 'london-gb', country_code: 'GB', is_active: true, timezone: 'Europe/London' },
    { id: CITY2_ID, name: 'Manchester', slug: 'manchester-gb', country_code: 'GB', is_active: true, timezone: 'Europe/London' },
  ],
};

/** RPC answers by name. Anything unlisted answers [], unless it looks like a write. */
export const RPCS = {
  organiser_ownership_v1: { is_managed: true, i_own_it: true, my_role: 'owner' },
  // /city/:slug 404s unless the DB vouches for the slug (app/routes/home.tsx).
  is_valid_city_slug: true,
  // The owner's private contact (admin #771 shape: both split flags, plus the
  // deprecated derived show_contact_publicly). ORG has a phone and an email; every
  // other organiser has an email only, so its phone switch is disabled with a reason.
  get_organiser_contact_settings_v1: (args) => (args.p_organiser_id === ORG_ID
    ? { contact_phone: '+44 7700 900123', contact_email: 'hello@example.com', show_phone_publicly: true, show_email_publicly: false, show_contact_publicly: true, claim_email: null }
    : { contact_phone: null, contact_email: 'hello@example.com', show_phone_publicly: true, show_email_publicly: false, show_contact_publicly: true, claim_email: null }),
  search_cities: (args) => searchCityRows(args.p_query, args.p_limit),
  // ORG2's nights: no dated occurrence rows, so the page lists them as upcoming
  // (the base-date fallback); every other organiser has none.
  get_organiser_public_events_v1: (args) => (args.p_organiser_id === ORG2_ID ? [
    { id: 'e0000000-0000-4000-8000-0000000000e1', name: 'Friday Salsa Social', date: '2099-01-02', start_time: '2099-01-02T20:00:00', is_active: true, poster_url: null, location: 'Studio One', city: 'London' },
    { id: 'e0000000-0000-4000-8000-0000000000e2', name: 'Saturday Bachata Party', date: '2099-01-03', start_time: '2099-01-03T21:00:00', is_active: true, poster_url: null, location: 'Studio One', city: 'London' },
  ] : []),
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

/** The JSON body of an RPC call ({} when there is none or it is not JSON). */
function rpcArgs(body) {
  try {
    const v = JSON.parse(body || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

/**
 * @param {{method: string, url: string, headers?: Record<string, string>, body?: string | null}} req
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
    if (!Object.prototype.hasOwnProperty.call(RPCS, name)) return json(200, []);
    const a = RPCS[name];
    // A function answer reads the call's arguments (POST body, or GET query params).
    if (typeof a === 'function') return json(200, a(method === 'GET' ? Object.fromEntries(url.searchParams) : rpcArgs(req.body)));
    return json(200, a);
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
