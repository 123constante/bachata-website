// /api/og/card — live Open Graph preview image for social shares.
//
// Returns a normalized 1200x630 JPEG so every shared link gets a preview that
// WhatsApp/Facebook/LinkedIn will actually render (they refuse WebP and large
// files). The render + data logic is shared with api/og/bake.ts via ogRender.ts,
// so the live image and the pre-baked image are identical.
//
// In steady state the middleware serves the pre-baked R2 URL (see api/og/bake);
// this endpoint is the fallback for not-yet-baked entities and is always current
// — occurrence-aware (`occ`) and cover-versioned (`v`) via the query string.
//
// Query params:
//   kind   event | festival | image   (default: event)
//   id     event/festival UUID or slug (for kind=event|festival)
//   occ    occurrence id                (optional, for kind=event)
//   v      cover version token          (cache-buster; only affects URL + ETag)
//   src    absolute image URL           (for kind=image)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'node:crypto';
import {
  buildFallbackCard, buildImageCard, fetchEventData, fetchFestivalData, fetchImageBytes, resolveEventId,
} from './_ogRender';

export const config = { maxDuration: 20 };

const SITE_URL = (process.env.SITE_URL ?? 'https://www.bachatacalendar.co.uk').replace(/\/$/, '');

function makeEtag(kind: string, idParam: string, src: string, occ = '', v = ''): string {
  // Hash the FULL discriminator so occ + cover version actually affect the ETag
  // (the old base64-prefix slice dropped everything past the id).
  const h = createHash('sha1').update(`${kind}:${idParam}:${src}:${occ}:${v}`).digest('base64url').slice(0, 24);
  return `"${h}"`;
}

function sendImage(res: VercelResponse, buf: Buffer, etag?: string): void {
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Content-Length', String(buf.length));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800');
  if (etag) res.setHeader('ETag', etag);
  res.status(200).send(buf);
}

function redirectToStatic(res: VercelResponse): void {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.statusCode = 302;
  res.setHeader('Location', `${SITE_URL}/og-image.jpg`);
  res.end();
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.status(405).send('Method Not Allowed'); return; }
  const q = req.query;
  const kind = (Array.isArray(q.kind) ? q.kind[0] : q.kind) ?? 'event';
  const idParam = (Array.isArray(q.id) ? q.id[0] : q.id) ?? '';
  const src = (Array.isArray(q.src) ? q.src[0] : q.src) ?? '';
  const occ = (Array.isArray(q.occ) ? q.occ[0] : q.occ) ?? '';
  const v = (Array.isArray(q.v) ? q.v[0] : q.v) ?? '';

  const etag = makeEtag(kind, idParam, src, occ, v);
  if (req.headers['if-none-match'] === etag) { res.status(304).end(); return; }

  try {
    if (kind === 'image') {
      if (!src) return redirectToStatic(res);
      const bytes = await fetchImageBytes(src);
      if (!bytes) return redirectToStatic(res);
      return sendImage(res, await buildImageCard(bytes), etag);
    }
    if (!idParam) return redirectToStatic(res);
    const id = await resolveEventId(idParam);
    if (!id) return redirectToStatic(res);
    const data = kind === 'festival' ? await fetchFestivalData(id) : await fetchEventData(id, occ || null);
    if (!data) return sendImage(res, await buildFallbackCard(null, null, null), etag);
    // Hybrid: when the entity has a flyer, the preview IS the flyer normalized to
    // 1200x630 (no text, no fonts — cannot tofu). The branded card is only the
    // fallback for entities with no flyer.
    const coverBytes = data.coverUrl ? await fetchImageBytes(data.coverUrl) : null;
    if (!coverBytes) return sendImage(res, await buildFallbackCard(data.title, data.dateLine, data.venueLine), etag);
    return sendImage(res, await buildImageCard(coverBytes), etag);
  } catch (err) {
    console.error('[og/card] render_failed', err);
    return redirectToStatic(res);
  }
}
