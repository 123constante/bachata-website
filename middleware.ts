import { next } from '@vercel/edge';
import { teacherTag } from './app/cacheTags';
// The Edge runtime bundle cannot resolve ./app/detailLoader's transitive
// imports (react-router, @/integrations/supabase/getSupabase, @/lib/seo) --
// broke the Vercel build (#272). edgeCacheControl lives in the dependency-free
// leaf module below for exactly that reason; import it from there, never from
// detailLoader.ts, even though detailLoader.ts re-exports the same name.
import { edgeCacheControl } from './app/edgeCacheControl';

// ─── Configuration ────────────────────────────────────────────────────────────

export const config = {
  matcher: [
    // Bots keep hitting this edge middleware for the branded OG card + DanceEvent
    // JSON-LD + noindex-404. /event was retired from this list (Phase 5, 2026-07-06): its route
    // now emits equivalent-or-better JSON-LD (BentoPage's buildEventJsonLd) and
    // og:image normalization (resolveOgCardImage in app/detailLoader.ts) itself,
    // verified byte-for-byte identical to this file's own output for a real
    // event before removal. /festival was retired the same way (Phase 5,
    // 2026-07-06): FestivalDetail's buildEventJsonLd is equivalent-or-better
    // (real venue address + performers vs middleware's generic fallbacks) and
    // the SSR loader's resolveOgCardImage renders a byte-identical og:image
    // (verified against a live festival before removal). /venue-entity was
    // retired next (Phase 5, 2026-07-06): its SSR route is strictly better —
    // buildVenueJsonLd (LocalBusiness + BreadcrumbList) where middleware emitted
    // NO JSON-LD, and normalizeOgImage (the /api/og/card?kind=image letterbox)
    // renders the real venue photo where middleware's fetchVenueMeta fell back to
    // the generic og-image.jpg. VITE_ENABLE_VENUE_DETAIL is on in prod, so the
    // route serves real content, not the coming-soon gate (verified on preview).
    // /djs + /dancers were retired next (Phase 5, 2026-07-06): both are ungated
    // and their SSR loaders now normalize og:image via normalizeOgImage (same
    // /api/og/card?kind=image src as middleware's fetchDjMeta/fetchDancerMeta —
    // verified identical on preview for a live DJ + dancer).
    //
    // /organisers was retired here (2026-09-01) once app/routes/organiser.tsx
    // gained a loader. BOTH premises of the note that used to keep it are now
    // false: the route has a loader, and VITE_ENABLE_ORGANISER_DETAIL is true in
    // prod (production served OrganiserProfile, not the coming-soon gate — which
    // is how it served "<h1>Organiser not found</h1>" at HTTP 200 on 34 valid
    // organisers). Checked against this file's own output before removal, field
    // by field: og:image is the SAME normalizeOgImage/api/og/card?kind=image
    // src; the canonical is the same /organisers/<slug>; a genuine miss is a
    // real 404 + X-Robots-Tag: noindex (throwDetailNotFound) where this file
    // returned its NOINDEX_404 stub; the description prefers the organiser's own
    // bio exactly as fetchOrganiserMeta did (no organiser has one today, so both
    // sides fall back — the SSR template is the richer fallback of the two); and
    // middleware emitted NO JSON-LD for organisers. It also ENDS a cloaking
    // exposure: bots were served a 1,582-byte document whose body was
    // "<p>La Familia</p>" while humans got 32,537 bytes. Both now get the page.
    //
    // /teachers STAYS: it is flag-gated and VITE_ENABLE_TEACHER_DETAIL=false in
    // prod, so its SSR route serves a coming-soon/noindex page — bots must keep
    // getting the rich card from here until that flag ships.
    '/teachers/:path*',
    '/city/:path*',
  ],
};

const BOT_UA_PATTERN =
  /googlebot|bingbot|facebookexternalhit|whatsapp|twitterbot|linkedinbot|slackbot|telegrambot|discordbot/i;

// Search engines get the rich prerendered homepage on a bare /city/:slug; social
// bots keep the OG-card HTML so WhatsApp/Facebook link previews still work.
const SEARCH_BOT_PATTERN = /googlebot|bingbot/i;

// Clean (non-city-prefixed) public listing routes. City-prefixed duplicates
// (/city/:slug/<listing>) canonicalise onto these so equity consolidates on the
// prerendered clean pages instead of splitting across the /city/* variants.
const CLEAN_LISTINGS = new Set([
  'parties', 'classes', 'tonight', 'venues', 'discounts', 'practice-partners',
  'choreography', 'dancers', 'festivals', 'teachers', 'djs', 'organisers',
  'cities', 'videographers', 'vendors', 'search',
]);

const SITE_URL = process.env.SITE_URL ?? 'https://www.bachatacalendar.co.uk';
const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';

const FALLBACK_OG_IMAGE = `${SITE_URL.replace(/\/$/, '')}/og-image.jpg`;

const SUPABASE_HEADERS = {
  'Content-Type': 'application/json',
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CITY_SLUG_RE = /^[a-z]+(-[a-z]+)*-[a-z]{2}$/;

// ─── Types ────────────────────────────────────────────────────────────────────

interface OgMeta {
  title: string;
  description: string;
  image: string;
  type: string;
  url: string;
  canonicalHref?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(text: string | null | undefined, max: number): string {
  if (!text) return '';
  const trimmed = String(text).trim();
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max - 1).trimEnd() + '\u2026';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function absoluteUrl(maybeUrl: string | null | undefined): string | null {
  if (!maybeUrl) return null;
  const v = String(maybeUrl).trim();
  if (!v) return null;
  if (v.startsWith('http://') || v.startsWith('https://')) return v;
  return `${SITE_URL.replace(/\/$/, '')}/${v.replace(/^\//, '')}`;
}

// ─── OG image normalize ──────────────────────────────────────────────────────
// Many entity covers are WebP, which WhatsApp/Facebook/LinkedIn refuse to render
// as link previews (so no card appears), and some are >300KB. Route the OG image
// through /api/og/card?kind=image, which returns a letterboxed 1200x630 JPEG.
// Falls back to the static branded og-image.jpg. (The branded event/festival
// card path — ogCardUrl/coverVersionToken/fetchBakedOgImage — was removed once
// those routes moved their OG generation into the SSR loaders; the remaining
// bot-served kinds — teachers, organisers, city — only ever used this normalize.)
function ogNormalizedImage(rawUrl: string | null | undefined): string {
  const abs = absoluteUrl(rawUrl);
  if (!abs) return FALLBACK_OG_IMAGE; // already a 1200x630 JPEG
  return `${SITE_URL.replace(/\/$/, '')}/api/og/card?kind=image&src=${encodeURIComponent(abs)}`;
}

// og:image MUST be an absolute URL on the host the crawler actually fetched.
// Two failure modes this guards against, both of which make WhatsApp/Facebook
// drop the preview card:
//   1. SITE_URL is the apex domain (bachatacalendar.co.uk) while the page is
//      served from www — apex→www is a 308 redirect, and crawlers don't follow
//      redirects on og:image.
//   2. SITE_URL is unset/empty, so the builders emit a host-less relative URL
//      ("/api/og/card?…") which is not a valid og:image at all.
// Resolving against the request origin and pinning same-site hosts to it fixes
// both, enforcing the og:url ↔ og:image host invariant regardless of SITE_URL.
function sameHostImage(imageUrl: string, requestOrigin: string): string {
  try {
    const ro = new URL(requestOrigin);
    // base resolves a relative imageUrl (case 2) against the request origin;
    // an absolute imageUrl ignores the base and keeps its own host.
    const img = new URL(imageUrl, ro);
    if (img.hostname === ro.hostname || /(^|\.)bachatacalendar\.co\.uk$/i.test(img.hostname)) {
      img.protocol = ro.protocol;
      img.host = ro.host;
      return img.toString();
    }
  } catch {
    /* unparseable even with a base — leave as-is */
  }
  return imageUrl;
}

function firstString(val: unknown): string | null {
  if (Array.isArray(val)) {
    const first = val.find((v) => typeof v === 'string' && v.trim());
    return typeof first === 'string' ? first : null;
  }
  if (typeof val === 'string' && val.trim()) return val;
  return null;
}

async function supabaseFetch(path: string, init?: RequestInit): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${SUPABASE_URL}${path}`, {
      ...init,
      headers: { ...SUPABASE_HEADERS, ...(init?.headers ?? {}) },
      signal: controller.signal,
    });
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Resolve a param (slug OR uuid) to BOTH its uuid and canonical slug in one round
// trip, so bot HTML can emit a slug-based <link rel=canonical> that consolidates the
// legacy /{kind}/{uuid} URLs onto the slug. `table` must expose `id` + `slug`
// (events, venues, dancer_profiles, organiser_profiles) -- the same `id` the detail
// page's useEntitySlugOrId (idColumn:'id') and the entity's fetcher/RPC expect.
async function resolveRef(table: string, param: string): Promise<{ id: string; slug: string | null } | null> {
  const col = UUID_RE.test(param) ? 'id' : 'slug';
  const res = await supabaseFetch(`/rest/v1/${table}?${col}=eq.${encodeURIComponent(param)}&select=id,slug`);
  if (!res || !res.ok) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any = await res.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row || typeof row.id !== 'string') return null;
  return { id: row.id, slug: typeof row.slug === 'string' && row.slug ? row.slug : null };
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchTeacherMeta(id: string, url: string): Promise<OgMeta | null> {
  const res = await supabaseFetch('/rest/v1/rpc/get_public_teacher_preview_v1', {
    method: 'POST',
    body: JSON.stringify({ p_entity_id: id }),
  });
  if (!res || !res.ok) {
    console.error(`[middleware-og-fallback] teacher ${id} status=${res?.status ?? 'no-res'}`);
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any = await res.json();
  const t = Array.isArray(rows) ? rows[0] : null;
  if (!t) return null;

  const nameRaw = `${t.first_name ?? ''} ${t.surname ?? ''}`.replace(/\s+/g, ' ').trim();
  const title = truncate(nameRaw || 'Bachata Teacher', 90);

  let base = 'Bachata teacher';
  if (t.city) base += ` in ${t.city}`;
  if (Array.isArray(t.teaching_styles) && t.teaching_styles.length > 0) {
    base += ' \u2014 ' + t.teaching_styles.slice(0, 3).join(', ');
  }
  if (typeof t.years_teaching === 'number' && t.years_teaching > 0) {
    base += ` \u00b7 ${t.years_teaching} years`;
  }
  const description = truncate(base, 160);

  const image = ogNormalizedImage(firstString(t.photo_url));

  return { title, description, image, type: 'profile', url };
}

async function fetchCityMeta(slug: string, url: string): Promise<OgMeta | null> {
  const query = `slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&select=name,description,hero_image_url`;
  const res = await supabaseFetch(`/rest/v1/cities?${query}`);
  if (!res || !res.ok) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any = await res.json();
  const c = Array.isArray(rows) ? rows[0] : null;
  if (!c || !c.name) return null;

  const title = truncate(`Bachata in ${c.name}`, 90);

  const rawDesc = c.description && String(c.description).trim()
    ? c.description
    : `Bachata classes, socials and festivals in ${c.name}.`;
  const description = truncate(rawDesc, 160);

  const image = ogNormalizedImage(c.hero_image_url);

  return { title, description, image, type: 'website', url };
}

async function fetchOrganiserMeta(id: string, url: string): Promise<OgMeta | null> {
  const query = `id=eq.${encodeURIComponent(id)}&select=name,avatar_url,bio`;
  const res = await supabaseFetch(`/rest/v1/organiser_profiles?${query}`);
  if (!res || !res.ok) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any = await res.json();
  const o = Array.isArray(rows) ? rows[0] : null;
  if (!o || !o.name) return null;

  const title = truncate(o.name, 90);

  let description: string;
  if (o.bio && String(o.bio).trim()) {
    description = truncate(o.bio, 160);
  } else {
    let base = 'Event organiser';
    if (o.cities?.name) base += ` in ${o.cities.name}`;
    description = truncate(base, 160);
  }

  const image = ogNormalizedImage(firstString(o.avatar_url));

  return { title, description, image, type: 'profile', url };
}

// ─── HTML renderer ────────────────────────────────────────────────────────────

function buildMetaHtml(meta: OgMeta): string {
  const { title, description, image, type, url, canonicalHref } = meta;

  const descForMeta = description || title;
  const canonicalTag = canonicalHref
    ? `<link rel="canonical" href="${escapeHtml(canonicalHref)}" />`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(descForMeta)}" />
  ${canonicalTag}
  <meta property="og:site_name" content="Bachata Calendar" />
  <meta property="og:type" content="${escapeHtml(type)}" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(descForMeta)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:alt" content="${escapeHtml(title)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(descForMeta)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />
</head>
<body>
  <p>${escapeHtml(title)}</p>
</body>
</html>`;
}

// ─── Middleware entry point ───────────────────────────────────────────────────

export default async function middleware(request: Request): Promise<Response> {
  const ua = request.headers.get('user-agent') ?? '';
  if (!BOT_UA_PATTERN.test(ua)) return next();
  const isSearchBot = SEARCH_BOT_PATTERN.test(ua);

  const url = new URL(request.url);
  const segments = url.pathname.split('/').filter(Boolean);
  const kind = segments[0];
  const id = segments[1];

  if (!id) return next();
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return next();

  const canonicalUrl = request.url;

  let meta: OgMeta | null = null;
  // Set only where a real purge exists for the entity behind the response, so a
  // long s-maxage is safe. `teacher` is in REVALIDATABLE_ENTITY_TYPES and
  // admin_save_person_v1 purges teacherTag(id) on every write; organisers and
  // cities have no such tag today, so they stay on a blind TTL below.
  let cacheTag: string | null = null;
  switch (kind) {
    case 'teachers': {
      const ref = await resolveRef('dancer_profiles', id);
      meta = ref ? await fetchTeacherMeta(ref.id, canonicalUrl) : null;
      if (meta && ref) {
        meta.canonicalHref = `${SITE_URL}/teachers/${ref.slug || ref.id}`;
        cacheTag = teacherTag(ref.id);
      }
      break;
    }
    // UNREACHABLE since 2026-09-01: '/organisers/:path*' was removed from the
    // matcher above, so this branch and fetchOrganiserMeta are dead. Left in
    // place DELIBERATELY so the retirement is one line to revert if the SSR route
    // regresses; delete both when middleware.ts itself goes (SSR roadmap,
    // commitment 5). 'organisers' stays in CLEAN_LISTINGS — that is the separate
    // /city/:slug/organisers canonicalisation, unrelated to this matcher.
    case 'organisers': {
      const ref = await resolveRef('organiser_profiles', id);
      meta = ref ? await fetchOrganiserMeta(ref.id, canonicalUrl) : null;
      if (meta && ref) meta.canonicalHref = `${SITE_URL}/organisers/${ref.slug || ref.id}`;
      break;
    }
    case 'city': {
      if (!CITY_SLUG_RE.test(id)) return next();
      const isBareCity = segments.length === 2;
      // Bare /city/:slug is the homepage equivalent (canonical '/'). Send search
      // crawlers to the rich prerendered homepage (next() -> the SPA rewrite
      // serves dist/index.html) rather than the thin city skeleton; social bots
      // still get the OG card so link previews keep working.
      if (isBareCity && isSearchBot) return next();
      meta = await fetchCityMeta(id, canonicalUrl);
      if (meta) {
        const listing = segments[2];
        meta.canonicalHref = isBareCity
          ? `${SITE_URL}/`
          : CLEAN_LISTINGS.has(listing)
            ? `${SITE_URL}/${listing}`
            : `${SITE_URL}/`;
      }
      break;
    }
    default:
      return next();
  }

  if (!meta) {
    // Soft-404 fix: a UUID-shaped id that doesn't resolve to a real record is a
    // dead URL, so return 404 + noindex and let Google drop it. Slug params for
    // these kinds already returned next() above, so reaching here is a genuine
    // miss. City misses fall through to next() (the SPA still renders a city).
    const NOINDEX_404_KINDS = ['teachers', 'organisers'];
    if (NOINDEX_404_KINDS.includes(kind)) {
      return new Response(
        `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Not found</title><meta name="robots" content="noindex"></head><body><p>Not found.</p></body></html>`,
        {
          status: 404,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=0, s-maxage=300',
            'X-Robots-Tag': 'noindex',
          },
        },
      );
    }
    return next();
  }

  // Keep og:image on the same host as og:url (= the fetched URL) so the
  // preview image never 308-redirects (apex→www) and breaks the card.
  meta.image = sameHostImage(meta.image, url.origin);

  // Two caching regimes, and which one applies is a fact about whether a PURGE
  // reaches this response -- not about how fresh we would like it to be.
  //
  // Tagged (teachers): the same Vercel-Cache-Tag / Vercel-CDN-Cache-Control
  // mechanism app/detailLoader.ts uses site-wide, on the same 1h/24h TTL
  // convention. A teacher write emits the purge, so a long s-maxage costs no
  // staleness -- the edge entry dies on edit, not on expiry.
  //
  // Untagged (organisers, city): these ride a TTL, not a purge, because no
  // organiser/city tag exists yet (wiring one is a cross-repo change: new
  // entity type + admin RPC emission + cacheTags.test.ts conformance). The
  // payload is bot-only OG-card HTML edited by a single operator at low
  // frequency, so an hour of blind staleness on a link preview is the cheap
  // side of the trade against re-invoking this function per crawl.
  const headers: Record<string, string> = {
    'Content-Type': 'text/html; charset=utf-8',
  };
  if (cacheTag) {
    headers['Vercel-Cache-Tag'] = cacheTag;
    // Routed through edgeCacheControl() rather than restating its default
    // literal, so a future retune of EDGE_S_MAXAGE/EDGE_SWR in
    // app/detailLoader.ts -- the "same 1h/24h TTL convention" this block
    // already claims to follow -- cannot leave this sibling behind silently.
    headers['Vercel-CDN-Cache-Control'] = edgeCacheControl();
    headers['Cache-Control'] = 'public, s-maxage=300, stale-while-revalidate=600';
  } else {
    headers['Cache-Control'] = 'public, s-maxage=3600, stale-while-revalidate=604800';
  }

  return new Response(buildMetaHtml(meta), { headers });
}
