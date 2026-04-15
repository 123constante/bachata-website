import { next } from '@vercel/edge';

// ─── Configuration ────────────────────────────────────────────────────────────

export const config = {
  matcher: ['/event/:path*', '/festival/:path*'],
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface EventMeta {
  id: string;
  kind: 'event' | 'festival';
  title: string;
  description: string | null;
  image: string | null;
  startDate: string | null;
  endDate: string | null;
  venueName: string | null;
  venueAddress: string | null;
  cityName: string | null;
  organiser: string | null;
}

// ─── Supabase fetchers ────────────────────────────────────────────────────────

async function fetchEventMeta(eventId: string): Promise<EventMeta | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/get_event_page_snapshot_v2`,
      {
        method: 'POST',
        headers: SUPABASE_HEADERS,
        body: JSON.stringify({ p_event_id: eventId }),
        signal: controller.signal,
      },
    );

    if (!res.ok) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const snapshot: any = await res.json();
    if (!snapshot || !snapshot.event) return null;

    const event = snapshot.event;
    const location = snapshot.location_default;
    const occ = snapshot.occurrence_effective;
    const venue = location?.venue;
    const city = location?.city;

    return {
      id: eventId,
      kind: 'event',
      title: event.name ?? 'Bachata Event',
      description: event.description ?? null,
      image: event.cover_image_url ?? venue?.image_url ?? null,
      startDate: occ?.starts_at ?? event.date ?? null,
      endDate: occ?.ends_at ?? null,
      venueName: venue?.name ?? null,
      venueAddress: venue?.address_line ?? null,
      cityName: city?.name ?? null,
      organiser: snapshot.organisers?.[0]?.display_name ?? null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchFestivalMeta(eventId: string): Promise<EventMeta | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/get_public_festival_detail`,
      {
        method: 'POST',
        headers: SUPABASE_HEADERS,
        body: JSON.stringify({ p_event_id: eventId }),
        signal: controller.signal,
      },
    );

    if (!res.ok) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const festival: any = await res.json();
    if (!festival || !festival.identity) return null;

    const identity = festival.identity;
    const dates = festival.dates;
    const location = festival.location;
    const venue = location?.primaryVenue;
    const city = location?.city;

    return {
      id: eventId,
      kind: 'festival',
      title: identity.name ?? 'Bachata Festival',
      description: identity.description ?? null,
      image: identity.posterUrl ?? venue?.imageUrl ?? null,
      startDate: dates?.startsAt ?? null,
      endDate: dates?.endsAt ?? null,
      venueName: venue?.name ?? null,
      venueAddress: venue?.address ?? null,
      cityName: city?.name ?? null,
      organiser: null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Date formatting ──────────────────────────────────────────────────────────

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

function truncate(text: string | null, max: number): string {
  if (!text) return '';
  return text.length <= max ? text : text.slice(0, max - 1).trimEnd() + '\u2026';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

function buildMetaHtml(meta: EventMeta): string {
  const canonicalUrl = `${SITE_URL}/${meta.kind}/${meta.id}`;
  const image = meta.image ?? FALLBACK_OG_IMAGE;
  const formattedDate = formatDate(meta.startDate);

  // Build og:description
  const descParts: string[] = [];
  if (formattedDate) descParts.push(formattedDate);
  if (meta.venueName) descParts.push(`at ${meta.venueName}`);
  const locationLine = descParts.join(' ');

  const rawDescription = meta.description ? truncate(meta.description, 150) : '';
  const ogDescription = locationLine
    ? rawDescription
      ? `${locationLine}. ${rawDescription}`
      : locationLine
    : rawDescription;

  // Build page title
  const titleParts = [meta.title];
  if (meta.venueName) titleParts.push(meta.venueName);
  if (meta.cityName) titleParts.push(meta.cityName);
  if (formattedDate) titleParts.push(formattedDate);
  const pageTitle = titleParts.join(' \u2014 ');

  // JSON-LD
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'DanceEvent',
    name: meta.title,
    url: canonicalUrl,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
  };
  if (meta.startDate) jsonLd.startDate = meta.startDate;
  if (meta.endDate) jsonLd.endDate = meta.endDate;
  if (meta.image) jsonLd.image = meta.image;
  if (meta.description) jsonLd.description = truncate(meta.description, 500);
  if (meta.venueName) {
    jsonLd.location = {
      '@type': 'Place',
      name: meta.venueName,
      address: {
        '@type': 'PostalAddress',
        ...(meta.venueAddress ? { streetAddress: meta.venueAddress } : {}),
        ...(meta.cityName ? { addressLocality: meta.cityName } : {}),
        addressCountry: 'GB',
      },
    };
  }
  if (meta.organiser) {
    jsonLd.organizer = { '@type': 'Organization', name: meta.organiser };
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(truncate(ogDescription || meta.title, 160))}" />
  <meta property="og:site_name" content="Bachata Community" />
  <meta property="og:type" content="event" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:title" content="${escapeHtml(meta.title)}" />
  <meta property="og:description" content="${escapeHtml(truncate(ogDescription || meta.title, 200))}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(meta.title)}" />
  <meta name="twitter:description" content="${escapeHtml(truncate(ogDescription || meta.title, 200))}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
  <p>${escapeHtml(meta.title)}${formattedDate ? ` \u2014 ${escapeHtml(formattedDate)}` : ''}${meta.venueName ? ` at ${escapeHtml(meta.venueName)}` : ''}${meta.cityName ? `, ${escapeHtml(meta.cityName)}` : ''}</p>
</body>
</html>`;
}

// ─── Middleware entry point ───────────────────────────────────────────────────

export default async function middleware(request: Request): Promise<Response> {
  const ua = request.headers.get('user-agent') ?? '';

  if (!BOT_UA_PATTERN.test(ua)) {
    return next();
  }

  const url = new URL(request.url);
  const segments = url.pathname.split('/').filter(Boolean);
  // segments[0] = 'event' | 'festival', segments[1] = id
  const kind = segments[0] as 'event' | 'festival' | undefined;
  const id = segments[1];

  if (!id || (kind !== 'event' && kind !== 'festival')) {
    return next();
  }

  // Skip if no Supabase credentials configured (e.g. local dev without env vars)
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return next();
  }

  const meta =
    kind === 'festival'
      ? await fetchFestivalMeta(id)
      : await fetchEventMeta(id);

  if (!meta) {
    // Event not found or RPC error — let the SPA handle the 404
    return next();
  }

  return new Response(buildMetaHtml(meta), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Cache for 5 min at the edge; serve stale for up to 10 min while revalidating
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
