import { next } from '@vercel/edge';

// ─── Configuration ────────────────────────────────────────────────────────────

export const config = {
  matcher: [
    '/event/:path*',
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

const SITE_URL = process.env.SITE_URL ?? 'https://www.bachatacalendar.co.uk';
const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';

const FALLBACK_OG_IMAGE =
  'https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b5c411db-d29a-4d08-a85b-d1e88b365990/id-preview-c35aebe7--aceee982-d013-4635-84af-1b9a227224dd.lovable.app-1771389005547.png';

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
  eventExtras?: {
    startDate: string | null;
    endDate: string | null;
    venueName: string | null;
    venueAddress: string | null;
    cityName: string | null;
    organiser: string | null;
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

// ─── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchEventMeta(id: string, url: string): Promise<OgMeta | null> {
  const res = await supabaseFetch('/rest/v1/rpc/get_event_page_snapshot_v2', {
    method: 'POST',
    body: JSON.stringify({ p_event_id: id }),
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
  const image = absoluteUrl(event.cover_image_url ?? venue?.image_url) ?? FALLBACK_OG_IMAGE;

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

  return {
    title,
    description,
    image,
    type: 'event',
    url,
    eventExtras: {
      startDate,
      endDate: occ?.ends_at ?? null,
      venueName: venue?.name ?? null,
      venueAddress: venue?.address_line ?? null,
      cityName: city?.name ?? null,
      organiser: snapshot.organisers?.[0]?.display_name ?? null,
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
  const image = absoluteUrl(identity.posterUrl ?? venue?.imageUrl) ?? FALLBACK_OG_IMAGE;

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

  return {
    title,
    description,
    image,
    type: 'event',
    url,
    eventExtras: {
      startDate,
      endDate: dates?.endsAt ?? null,
      venueName: venue?.name ?? null,
      venueAddress: venue?.address ?? null,
      cityName: city?.name ?? null,
      organiser: null,
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
  const image = absoluteUrl(firstString(venue.photo_url)) ?? FALLBACK_OG_IMAGE;

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
  const query = `id=eq.${encodeURIComponent(id)}&select=first_name,surname,photo_url,teaching_styles,years_teaching,city:cities!city_id(name)`;
  const res = await supabaseFetch(`/rest/v1/teacher_profiles?${query}`);
  if (!res || !res.ok) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any = await res.json();
  const t = Array.isArray(rows) ? rows[0] : null;
  if (!t) return null;

  const nameRaw = `${t.first_name ?? ''} ${t.surname ?? ''}`.replace(/\s+/g, ' ').trim();
  const title = truncate(nameRaw || 'Bachata Teacher', 90);

  let base = 'Bachata teacher';
  if (t.city?.name) base += ` in ${t.city.name}`;
  if (Array.isArray(t.teaching_styles) && t.teaching_styles.length > 0) {
    base += ' \u2014 ' + t.teaching_styles.slice(0, 3).join(', ');
  }
  if (typeof t.years_teaching === 'number' && t.years_teaching > 0) {
    base += ` \u00b7 ${t.years_teaching} years`;
  }
  const description = truncate(base, 160);

  const image = absoluteUrl(firstString(t.photo_url)) ?? FALLBACK_OG_IMAGE;

  return { title, description, image, type: 'profile', url };
}

async function fetchDjMeta(id: string, url: string): Promise<OgMeta | null> {
  const query = `id=eq.${encodeURIComponent(id)}&select=dj_name,first_name,surname,photo_url,bio,genres,cities!city_id(name)`;
  const res = await supabaseFetch(`/rest/v1/dj_profiles?${query}`);
  if (!res || !res.ok) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any = await res.json();
  const d = Array.isArray(rows) ? rows[0] : null;
  if (!d) return null;

  const realName = `${d.first_name ?? ''} ${d.surname ?? ''}`.replace(/\s+/g, ' ').trim();
  const titleRaw = (d.dj_name && String(d.dj_name).trim()) || realName || 'Bachata DJ';
  const title = truncate(titleRaw, 90);

  let description: string;
  if (d.bio && String(d.bio).trim()) {
    description = truncate(d.bio, 160);
  } else {
    let base = 'Bachata DJ';
    if (d.cities?.name) base += ` in ${d.cities.name}`;
    if (Array.isArray(d.genres) && d.genres.length > 0) {
      base += ' \u2014 ' + d.genres.slice(0, 3).join(', ');
    }
    description = truncate(base, 160);
  }

  const image = absoluteUrl(firstString(d.photo_url)) ?? FALLBACK_OG_IMAGE;

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

  const image = absoluteUrl(firstString(d.avatar_url)) ?? FALLBACK_OG_IMAGE;

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

  const image = absoluteUrl(c.hero_image_url) ?? `${SITE_URL.replace(/\/$/, '')}/og-image.png`;

  return { title, description, image, type: 'website', url };
}

async function fetchOrganiserMeta(id: string, url: string): Promise<OgMeta | null> {
  const query = `id=eq.${encodeURIComponent(id)}&type=eq.organiser&select=name,avatar_url,bio,cities:cities!entities_city_id_fkey(name)`;
  const res = await supabaseFetch(`/rest/v1/entities?${query}`);
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

  const image = absoluteUrl(firstString(o.avatar_url)) ?? FALLBACK_OG_IMAGE;

  return { title, description, image, type: 'profile', url };
}

// ─── HTML renderer ────────────────────────────────────────────────────────────

function buildMetaHtml(meta: OgMeta): string {
  const { title, description, image, type, url, eventExtras } = meta;

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
    if (eventExtras.venueName) {
      ld.location = {
        '@type': 'Place',
        name: eventExtras.venueName,
        address: {
          '@type': 'PostalAddress',
          ...(eventExtras.venueAddress ? { streetAddress: eventExtras.venueAddress } : {}),
          ...(eventExtras.cityName ? { addressLocality: eventExtras.cityName } : {}),
          addressCountry: 'GB',
        },
      };
    }
    if (eventExtras.organiser) {
      ld.organizer = { '@type': 'Organization', name: eventExtras.organiser };
    }
    jsonLdTag = `<script type="application/ld+json">${JSON.stringify(ld)}</script>`;
  }

  const descForMeta = description || title;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(descForMeta)}" />
  <meta property="og:site_name" content="Bachata Community" />
  <meta property="og:type" content="${escapeHtml(type)}" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(descForMeta)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
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

  const url = new URL(request.url);
  const segments = url.pathname.split('/').filter(Boolean);
  const kind = segments[0];
  const id = segments[1];

  if (!id) return next();
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return next();

  const canonicalUrl = request.url;

  let meta: OgMeta | null = null;
  switch (kind) {
    case 'event':
      meta = await fetchEventMeta(id, canonicalUrl);
      break;
    case 'festival':
      meta = await fetchFestivalMeta(id, canonicalUrl);
      break;
    case 'venue-entity':
      if (!UUID_RE.test(id)) return next();
      meta = await fetchVenueMeta(id, canonicalUrl);
      break;
    case 'teachers':
      if (!UUID_RE.test(id)) return next();
      meta = await fetchTeacherMeta(id, canonicalUrl);
      break;
    case 'djs':
      if (!UUID_RE.test(id)) return next();
      meta = await fetchDjMeta(id, canonicalUrl);
      break;
    case 'dancers':
      if (!UUID_RE.test(id)) return next();
      meta = await fetchDancerMeta(id, canonicalUrl);
      break;
    case 'organisers':
      if (!UUID_RE.test(id)) return next();
      meta = await fetchOrganiserMeta(id, canonicalUrl);
      break;
    case 'city':
      if (!CITY_SLUG_RE.test(id)) return next();
      meta = await fetchCityMeta(id, canonicalUrl);
      break;
    default:
      return next();
  }

  if (!meta) return next();

  return new Response(buildMetaHtml(meta), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
