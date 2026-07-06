import { next } from '@vercel/edge';

// ─── Configuration ────────────────────────────────────────────────────────────

export const config = {
  matcher: [
    // Bots keep hitting this edge middleware for the branded OG card + DanceEvent
    // JSON-LD + noindex-404. /organisers stays matched: the RR7 framework loader
    // serves HUMANS, but the route meta() is only a fallback head (no loader —
    // still flag-gated) — the rich card still comes from here until that flag
    // ships. /event was retired from this list (Phase 5, 2026-07-06): its route
    // now emits equivalent-or-better JSON-LD (BentoPage's buildEventJsonLd) and
    // og:image normalization (resolveOgCardImage in app/detailLoader.ts) itself,
    // verified byte-for-byte identical to this file's own output for a real
    // event before removal. /festival, /venue-entity, /teachers, /djs, /dancers
    // still need the same port before they can drop off this list too.
    '/festival/:path*',
    '/venue-entity/:path*',
    '/teachers/:path*',
    '/djs/:path*',
    '/dancers/:path*',
    '/organisers/:path*',
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
  eventExtras?: {
    startDate: string | null;
    endDate: string | null;
    venueName: string | null;
    venueAddress: string | null;
    cityName: string | null;
    organiser: string | null;
    organiserUrl: string | null;
    performers: string[];
    offers: Array<{ url: string | null; name: string | null; price: string | null }>;
  };
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

// ─── Branded OG image seam ──────────────────────────────────────────────────
// ~60% of event covers are WebP, which WhatsApp/Facebook/LinkedIn refuse to
// render as link previews (so no card appears), and some are >300KB. Route
// every OG image through /api/og/card, which returns a normalized 1200x630
// JPEG: a branded card for events/festivals, a letterboxed normalize for other
// entities. See api/og/card.ts. Falls back to the static branded og-image.jpg.
// A stable per-cover token: the cover's filename (R2 names are unique per upload).
// When the cover changes this changes, so the og:image URL changes and BOTH the CDN
// edge cache and WhatsApp's URL-keyed preview cache are busted. Previously the intended
// `&v=` was always empty (event_view_p5's snapshot_compat omits updated_at), so cards
// froze for the full 1-year s-maxage on whatever cover existed at first scrape.
function coverVersionToken(coverUrl: string | null | undefined): string | null {
  if (!coverUrl) return null;
  const seg = String(coverUrl).split('?')[0].split('/').pop() ?? '';
  return seg ? seg.slice(0, 64) : null;
}
function ogCardUrl(
  kind: 'event' | 'festival',
  id: string,
  opts?: { occ?: string | null; version?: string | null },
): string {
  const base = SITE_URL.replace(/\/$/, '');
  const params = new URLSearchParams({ kind, id });
  if (opts?.occ) params.set('occ', opts.occ);
  if (opts?.version) params.set('v', opts.version);
  return `${base}/api/og/card?${params.toString()}`;
}
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

function capitalize(s: string | null | undefined): string {
  if (!s) return '';
  const t = String(s).trim().toLowerCase();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function firstString(val: unknown): string | null {
  if (Array.isArray(val)) {
    const first = val.find((v) => typeof v === 'string' && v.trim());
    return typeof first === 'string' ? first : null;
  }
  if (typeof val === 'string' && val.trim()) return val;
  return null;
}

function formatDate(iso: string | null, timezone?: string): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: timezone ?? 'Europe/London',
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
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

// Prefer a pre-baked, immutable R2 OG image (rendered once on cover change, stored
// in R2) over a live /api/og/card render. get_og_image_v1 matches on the cover
// token, so a stale/not-yet-baked entry returns NULL and the caller falls back to
// the (always-current) live card — previews are never broken or stale.
async function fetchBakedOgImage(
  entityType: string, entityId: string, occ: string | null, coverToken: string | null,
): Promise<string | null> {
  const res = await supabaseFetch('/rest/v1/rpc/get_og_image_v1', {
    method: 'POST',
    body: JSON.stringify({
      p_entity_type: entityType, p_entity_id: entityId,
      p_occurrence_id: occ, p_cover_token: coverToken,
    }),
  });
  if (!res || !res.ok) return null;
  try {
    const url = await res.json();
    return typeof url === 'string' && /^https?:\/\//i.test(url) ? url : null;
  } catch { return null; }
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

async function fetchEventMeta(id: string, occId: string | null, url: string): Promise<OgMeta | null> {
  const target: Record<string, string> = { series_id: id };
  if (occId) target.occurrence_id = occId;
  const res = await supabaseFetch('/rest/v1/rpc/event_view_p5', {
    method: 'POST',
    body: JSON.stringify({ p_target: target, p_viewer: { role: 'anon', shape: 'snapshot_compat' } }),
  });
  if (!res || !res.ok) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snapshot: any = await res.json();
  if (!snapshot || !snapshot.event) return null;

  const event = snapshot.event;
  const location = snapshot.location_default;
  const occ = snapshot.occurrence_effective;
  const venue = location?.venue;
  const city = location?.city;

  const title = truncate(event.name ?? 'Bachata Event', 90);
  const coverToken = coverVersionToken(event.cover_image_url);
  const image = (await fetchBakedOgImage('event', id, occId, coverToken))
    ?? ogCardUrl('event', id, { occ: occId, version: coverToken });

  const startDate = occ?.starts_at ?? event.date ?? null;
  const formattedDate = formatDate(startDate);
  const descParts: string[] = [];
  if (formattedDate) descParts.push(formattedDate);
  if (venue?.name) descParts.push(`at ${venue.name}`);
  const locationLine = descParts.join(' ');
  const rawDescription = event.description ? truncate(event.description, 150) : '';
  const composedDesc = locationLine
    ? rawDescription
      ? `${locationLine}. ${rawDescription}`
      : locationLine
    : rawDescription;
  const description = truncate(composedDesc || title, 160);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const teachers: any[] = Array.isArray(occ?.lineup?.teachers) ? occ.lineup.teachers : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const djs: any[] = Array.isArray(occ?.lineup?.djs) ? occ.lineup.djs : [];
  const performers: string[] = [
    ...teachers.map((p) => (typeof p?.display_name === 'string' ? p.display_name : '')),
    ...djs.map((p) => (typeof p?.display_name === 'string' ? p.display_name : '')),
  ].filter((s) => s && s.trim());

  const metaPub = (event && typeof event.meta_data_public === 'object' && event.meta_data_public) || {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ticketRows: any[] = Array.isArray(metaPub.tickets) ? metaPub.tickets : [];
  const ticketUrl = event?.actions?.ticket_url ?? null;
  const offers: Array<{ url: string | null; name: string | null; price: string | null }> =
    ticketRows.length > 0
      ? ticketRows.map((t) => ({
          url: ticketUrl,
          name: typeof t?.name === 'string' ? t.name : null,
          price: t?.price != null ? String(t.price) : null,
        }))
      : ticketUrl
        ? [{ url: ticketUrl, name: null, price: null }]
        : [{ url, name: null, price: null }];

  return {
    title,
    description,
    image,
    // og:type 'website' (not 'event'): the OG "event" structured type requires
    // event:start_time/end_time, which we don't emit — so Meta's Graph scrape
    // rejects the URL (400) and never refreshes the preview cache. The schema.org
    // DanceEvent JSON-LD (for Google rich results) is separate and unaffected.
    type: 'website',
    url,
    eventExtras: {
      startDate,
      endDate: occ?.ends_at ?? null,
      venueName: venue?.name ?? null,
      venueAddress: venue?.address_line ?? null,
      cityName: city?.name ?? null,
      organiser: snapshot.organisers?.[0]?.display_name ?? null,
      organiserUrl: snapshot.organisers?.[0]?.website ?? null,
      performers,
      offers,
    },
  };
}

async function fetchFestivalMeta(id: string, url: string): Promise<OgMeta | null> {
  const res = await supabaseFetch('/rest/v1/rpc/get_public_festival_detail', {
    method: 'POST',
    body: JSON.stringify({ p_event_id: id }),
  });
  if (!res || !res.ok) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const festival: any = await res.json();
  if (!festival || !festival.identity) return null;

  const identity = festival.identity;
  const dates = festival.dates;
  const location = festival.location;
  const venue = location?.primaryVenue;
  const city = location?.city;

  const title = truncate(identity.name ?? 'Bachata Festival', 90);
  const coverToken = coverVersionToken(identity.posterUrl);
  const image = (await fetchBakedOgImage('festival', id, null, coverToken))
    ?? ogCardUrl('festival', id, { version: coverToken ?? identity.updatedAt ?? null });

  const startDate = dates?.startsAt ?? null;
  const formattedDate = formatDate(startDate);
  const descParts: string[] = [];
  if (formattedDate) descParts.push(formattedDate);
  if (venue?.name) descParts.push(`at ${venue.name}`);
  const locationLine = descParts.join(' ');
  const rawDescription = identity.description ? truncate(identity.description, 150) : '';
  const composedDesc = locationLine
    ? rawDescription
      ? `${locationLine}. ${rawDescription}`
      : locationLine
    : rawDescription;
  const description = truncate(composedDesc || title, 160);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const teachers: any[] = Array.isArray(festival?.lineup?.teachers) ? festival.lineup.teachers : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const djs: any[] = Array.isArray(festival?.lineup?.djs) ? festival.lineup.djs : [];
  const performers: string[] = [
    ...teachers.map((p) => (typeof p?.displayName === 'string' ? p.displayName : '')),
    ...djs.map((p) => (typeof p?.displayName === 'string' ? p.displayName : '')),
  ].filter((s) => s && s.trim());

  const ticketUrl = festival?.links?.ticketUrl ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const passes: any[] = Array.isArray(festival?.passes) ? festival.passes : [];
  const offers: Array<{ url: string | null; name: string | null; price: string | null }> =
    passes.length > 0
      ? passes.map((p) => ({
          url: ticketUrl,
          name: typeof p?.name === 'string' ? p.name : null,
          price: p?.price != null ? String(p.price) : null,
        }))
      : [{ url: ticketUrl ?? url, name: null, price: null }];

  return {
    title,
    description,
    image,
    // og:type 'website' (not 'event'): the OG "event" structured type requires
    // event:start_time/end_time, which we don't emit — so Meta's Graph scrape
    // rejects the URL (400) and never refreshes the preview cache. The schema.org
    // DanceEvent JSON-LD (for Google rich results) is separate and unaffected.
    type: 'website',
    url,
    eventExtras: {
      startDate,
      endDate: dates?.endsAt ?? null,
      venueName: venue?.name ?? null,
      venueAddress: venue?.address ?? null,
      cityName: city?.name ?? null,
      organiser: festival?.organiser?.displayName ?? null,
      organiserUrl: festival?.organiser?.href ?? null,
      performers,
      offers,
    },
  };
}

async function fetchVenueMeta(id: string, url: string): Promise<OgMeta | null> {
  const res = await supabaseFetch('/rest/v1/rpc/get_public_venue_by_venues_id', {
    method: 'POST',
    body: JSON.stringify({ p_venue_id: id }),
  });
  if (!res || !res.ok) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const venue: any = await res.json();
  if (!venue || !venue.name) return null;

  const title = truncate(venue.name, 90);
  const image = ogNormalizedImage(firstString(venue.photo_url));

  let description: string;
  if (venue.description && String(venue.description).trim()) {
    description = truncate(venue.description, 160);
  } else if (venue.address) {
    description = truncate(`Bachata venue \u2014 ${venue.address}`, 160);
  } else {
    description = 'Bachata venue in London';
  }

  return { title, description, image, type: 'business.business', url };
}

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

async function fetchDjMeta(id: string, url: string): Promise<OgMeta | null> {
  const res = await supabaseFetch('/rest/v1/rpc/get_public_dj_v1', {
    method: 'POST',
    body: JSON.stringify({ p_dj_id: id }),
  });
  if (!res || !res.ok) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d: any = await res.json();
  if (!d) return null;

  const realName = `${d.first_name ?? ''} ${d.surname ?? ''}`.replace(/\s+/g, ' ').trim();
  const titleRaw = (d.display_name && String(d.display_name).trim())
    || (d.dj_name && String(d.dj_name).trim())
    || realName
    || 'Bachata DJ';
  const title = truncate(titleRaw, 90);

  let description: string;
  if (d.bio && String(d.bio).trim()) {
    description = truncate(d.bio, 160);
  } else {
    let base = 'Bachata DJ';
    if (d.city_name) base += ` in ${d.city_name}`;
    if (Array.isArray(d.genres) && d.genres.length > 0) {
      base += ' \u2014 ' + d.genres.slice(0, 3).join(', ');
    }
    description = truncate(base, 160);
  }

  const image = ogNormalizedImage(firstString(d.photo_url));

  return { title, description, image, type: 'profile', url };
}

async function fetchDancerMeta(id: string, url: string): Promise<OgMeta | null> {
  const query = `id=eq.${encodeURIComponent(id)}&select=first_name,surname,avatar_url,favorite_styles,dance_role,nationality,cities!based_city_id(name)`;
  const res = await supabaseFetch(`/rest/v1/dancer_profiles?${query}`);
  if (!res || !res.ok) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any = await res.json();
  const d = Array.isArray(rows) ? rows[0] : null;
  if (!d) return null;

  const nameRaw = `${d.first_name ?? ''} ${d.surname ?? ''}`.replace(/\s+/g, ' ').trim();
  const title = truncate(nameRaw || 'Bachata Dancer', 90);

  let base = d.dance_role ? `${capitalize(d.dance_role)} in ` : 'Dancer in ';
  base += d.cities?.name ?? 'London';
  if (Array.isArray(d.favorite_styles) && d.favorite_styles.length > 0) {
    base += ' \u2014 ' + d.favorite_styles.slice(0, 3).join(', ');
  }
  const description = truncate(base, 160);

  const image = ogNormalizedImage(firstString(d.avatar_url));

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
  const { title, description, image, type, url, eventExtras, canonicalHref } = meta;

  let pageTitle = title;
  let bodyLine = title;

  if (eventExtras) {
    const formattedDate = formatDate(eventExtras.startDate);
    const titleParts = [title];
    if (eventExtras.venueName) titleParts.push(eventExtras.venueName);
    if (eventExtras.cityName) titleParts.push(eventExtras.cityName);
    if (formattedDate) titleParts.push(formattedDate);
    pageTitle = titleParts.join(' \u2014 ');
    bodyLine = `${title}${formattedDate ? ` \u2014 ${formattedDate}` : ''}${
      eventExtras.venueName ? ` at ${eventExtras.venueName}` : ''
    }${eventExtras.cityName ? `, ${eventExtras.cityName}` : ''}`;
  }

  let jsonLdTag = '';
  if (eventExtras) {
    const ld: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'DanceEvent',
      name: title,
      url,
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
    };
    if (eventExtras.startDate) ld.startDate = eventExtras.startDate;
    if (eventExtras.endDate) ld.endDate = eventExtras.endDate;
    if (image) ld.image = image;
    if (description) ld.description = truncate(description, 500);
    // Always emit a Place + PostalAddress so the address field isn't missing,
    // even when we don't have a venue. Falls back to country-only.
    ld.location = {
      '@type': 'Place',
      name: eventExtras.venueName ?? eventExtras.cityName ?? 'United Kingdom',
      address: {
        '@type': 'PostalAddress',
        ...(eventExtras.venueAddress ? { streetAddress: eventExtras.venueAddress } : {}),
        ...(eventExtras.cityName ? { addressLocality: eventExtras.cityName } : {}),
        addressCountry: 'GB',
      },
    };
    // Always emit organizer with url so the recommended fields aren't missing.
    ld.organizer = {
      '@type': 'Organization',
      name: eventExtras.organiser ?? 'Bachata Calendar',
      url: eventExtras.organiserUrl ?? SITE_URL,
    };
    // Always emit performer; fall back to generic PerformingGroup when no
    // lineup is on the snapshot.
    if (eventExtras.performers.length > 0) {
      ld.performer = eventExtras.performers.map((name) => ({ '@type': 'Person', name }));
    } else {
      ld.performer = { '@type': 'PerformingGroup', name: 'Bachata Artists' };
    }
    // Always emit at least one Offer pointing at the event URL.
    if (eventExtras.offers.length > 0) {
      ld.offers = eventExtras.offers.map((o) => {
        const offer: Record<string, unknown> = {
          '@type': 'Offer',
          url: o.url ?? url,
          availability: 'https://schema.org/InStock',
        };
        if (o.name) offer.name = o.name;
        if (o.price != null) offer.price = o.price;
        return offer;
      });
    } else {
      ld.offers = {
        '@type': 'Offer',
        url,
        availability: 'https://schema.org/InStock',
      };
    }
    jsonLdTag = `<script type="application/ld+json">${JSON.stringify(ld)}</script>`;
  }

  const descForMeta = description || title;
  const canonicalTag = canonicalHref
    ? `<link rel="canonical" href="${escapeHtml(canonicalHref)}" />`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(pageTitle)}</title>
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
  ${jsonLdTag}
</head>
<body>
  <p>${escapeHtml(bodyLine)}</p>
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
  switch (kind) {
    case 'event': {
      const ref = await resolveRef('events', id);
      const occ = url.searchParams.get('occurrenceId');
      meta = ref ? await fetchEventMeta(ref.id, occ, canonicalUrl) : null;
      if (meta && ref) meta.canonicalHref = `${SITE_URL}/event/${ref.slug || ref.id}`;
      break;
    }
    case 'festival': {
      const ref = await resolveRef('events', id);
      meta = ref ? await fetchFestivalMeta(ref.id, canonicalUrl) : null;
      if (meta && ref) meta.canonicalHref = `${SITE_URL}/festival/${ref.slug || ref.id}`;
      break;
    }
    case 'venue-entity': {
      const ref = await resolveRef('venues', id);
      meta = ref ? await fetchVenueMeta(ref.id, canonicalUrl) : null;
      if (meta && ref) meta.canonicalHref = `${SITE_URL}/venue-entity/${ref.slug || ref.id}`;
      break;
    }
    case 'teachers': {
      const ref = await resolveRef('dancer_profiles', id);
      meta = ref ? await fetchTeacherMeta(ref.id, canonicalUrl) : null;
      if (meta && ref) meta.canonicalHref = `${SITE_URL}/teachers/${ref.slug || ref.id}`;
      break;
    }
    case 'djs': {
      const ref = await resolveRef('dancer_profiles', id);
      meta = ref ? await fetchDjMeta(ref.id, canonicalUrl) : null;
      if (meta && ref) meta.canonicalHref = `${SITE_URL}/djs/${ref.slug || ref.id}`;
      break;
    }
    case 'dancers': {
      const ref = await resolveRef('dancer_profiles', id);
      meta = ref ? await fetchDancerMeta(ref.id, canonicalUrl) : null;
      if (meta && ref) meta.canonicalHref = `${SITE_URL}/dancers/${ref.slug || ref.id}`;
      break;
    }
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
    const NOINDEX_404_KINDS = ['event', 'festival', 'venue-entity', 'teachers', 'djs', 'dancers', 'organisers'];
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

  return new Response(buildMetaHtml(meta), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
