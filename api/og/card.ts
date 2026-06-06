// /api/og/card — branded Open Graph preview image for social shares.
//
// Why this exists: ~60% of event covers are WebP, which WhatsApp/Facebook/
// LinkedIn refuse to render as link previews (so no card appears at all), and
// some are >300KB. This endpoint returns a normalized 1200x630 JPEG so every
// shared link gets a preview. For events/festivals it composes a branded card
// (flyer letterboxed on brand-dark + title/date/venue); for other entities it
// just letterbox-normalizes their image.
//
// Query params:
//   kind   event | festival | image   (default: event)
//   id     event/festival UUID or slug (for kind=event|festival)
//   src    absolute image URL          (for kind=image)
//   v      optional cache-buster (e.g. updated_at epoch)
//
// Never throws to the client: any failure 302-redirects to the static
// /og-image.jpg so a preview always resolves.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildEventCard, buildFallbackCard, buildImageCard } from './_card';

// api/*.ts defaults to the Node runtime (required: sharp is a native binary and
// cannot run on the Edge runtime). maxDuration covers the first uncached render.
export const config = { maxDuration: 20 };

const SITE_URL = (process.env.SITE_URL ?? 'https://www.bachatacalendar.co.uk').replace(/\/$/, '');
const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';

const SUPABASE_HEADERS = {
  'Content-Type': 'application/json',
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function firstString(val: unknown): string | null {
  if (Array.isArray(val)) {
    const f = val.find((v) => typeof v === 'string' && v.trim());
    return typeof f === 'string' ? f : null;
  }
  return typeof val === 'string' && val.trim() ? val : null;
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London',
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

async function supabaseRpc(fn: string, body: unknown): Promise<unknown | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 3500);
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST', headers: SUPABASE_HEADERS, body: JSON.stringify(body), signal: ctrl.signal,
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function resolveEventId(param: string): Promise<string | null> {
  if (UUID_RE.test(param)) return param;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 3500);
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/events?slug=eq.${encodeURIComponent(param)}&select=id`,
      { headers: SUPABASE_HEADERS, signal: ctrl.signal },
    );
    if (!r.ok) return null;
    const rows = (await r.json()) as Array<{ id?: string }>;
    const id = Array.isArray(rows) && rows[0] ? rows[0].id : null;
    return typeof id === 'string' ? id : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

interface CardData {
  title: string;
  dateLine: string | null;
  venueLine: string | null;
  coverUrl: string | null;
}

async function fetchEventData(id: string): Promise<CardData | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snap: any = await supabaseRpc('event_view_p5', {
    p_target: { series_id: id },
    p_viewer: { role: 'anon', shape: 'snapshot_compat' },
  });
  if (!snap || !snap.event) return null;
  const venue = snap.location_default?.venue;
  const startDate = snap.occurrence_effective?.starts_at ?? snap.event.date ?? null;
  return {
    title: snap.event.name ?? 'Bachata Event',
    dateLine: formatDate(startDate),
    venueLine: venue?.name ? `at ${venue.name}` : null,
    coverUrl: firstString(snap.event.cover_image_url) ?? firstString(venue?.image_url),
  };
}

async function fetchFestivalData(id: string): Promise<CardData | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fest: any = await supabaseRpc('get_public_festival_detail', { p_event_id: id });
  if (!fest || !fest.identity) return null;
  const venue = fest.location?.primaryVenue;
  return {
    title: fest.identity.name ?? 'Bachata Festival',
    dateLine: formatDate(fest.dates?.startsAt ?? null),
    venueLine: venue?.name ? `at ${venue.name}` : null,
    coverUrl: firstString(fest.identity.posterUrl) ?? firstString(venue?.imageUrl),
  };
}

async function fetchImageBytes(url: string): Promise<Buffer | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4500);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) return null;
    const ab = await r.arrayBuffer();
    if (ab.byteLength > 12_000_000) return null; // sanity cap
    return Buffer.from(ab);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function sendImage(res: VercelResponse, buf: Buffer): void {
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Content-Length', String(buf.length));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Generated once per card, then served from the Vercel CDN edge cache.
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800');
  res.status(200).send(buf);
}

function redirectToStatic(res: VercelResponse): void {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.statusCode = 302;
  res.setHeader('Location', `${SITE_URL}/og-image.jpg`);
  res.end();
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  const q = req.query;
  const kind = (Array.isArray(q.kind) ? q.kind[0] : q.kind) ?? 'event';
  const idParam = (Array.isArray(q.id) ? q.id[0] : q.id) ?? '';
  const src = (Array.isArray(q.src) ? q.src[0] : q.src) ?? '';

  try {
    // Plain image normalize (people / cities / venues) — no text overlay.
    if (kind === 'image') {
      if (!src) return redirectToStatic(res);
      const bytes = await fetchImageBytes(src);
      if (!bytes) return redirectToStatic(res);
      return sendImage(res, await buildImageCard(bytes));
    }

    // Branded event / festival card.
    if (!idParam) return redirectToStatic(res);
    const id = await resolveEventId(idParam);
    if (!id) return redirectToStatic(res);

    const data = kind === 'festival' ? await fetchFestivalData(id) : await fetchEventData(id);
    if (!data) return sendImage(res, await buildFallbackCard({ title: null }));

    const coverBytes = data.coverUrl ? await fetchImageBytes(data.coverUrl) : null;
    if (!coverBytes) {
      return sendImage(
        res,
        await buildFallbackCard({ title: data.title, dateLine: data.dateLine, venueLine: data.venueLine }),
      );
    }

    const card = await buildEventCard({
      title: data.title,
      dateLine: data.dateLine,
      venueLine: data.venueLine,
      coverBuf: coverBytes,
    });
    return sendImage(res, card);
  } catch (err) {
    console.error('[og/card] render_failed', err);
    return redirectToStatic(res);
  }
}
