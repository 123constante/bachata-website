// Cover/media images are stored as FULL-SIZE originals on the R2 bucket behind
// media.bachatacalendar.co.uk (uploadToR2 does no resize/format step), so a
// 48px list thumbnail was costing a multi-MB JPEG download on mobile. Route
// every cover <img> through Vercel Image Optimization (/_vercel/image), which
// resizes + re-encodes (WebP) at the edge and caches the variant.
//
// `width` MUST be one of vercel.json's images.sizes and `quality` one of
// images.qualities, or Vercel rejects the request. Keep the three in sync.
const OPTIMIZABLE_HOSTS = new Set(['media.bachatacalendar.co.uk']);

export function optimizedImageUrl(url: string, width: number, quality = 70): string {
  // Dev servers have no /_vercel/image endpoint -- render originals locally.
  if (import.meta.env.DEV) return url;
  try {
    if (!OPTIMIZABLE_HOSTS.has(new URL(url).hostname)) return url;
  } catch {
    return url; // relative/malformed URL -- leave untouched
  }
  return `/_vercel/image?url=${encodeURIComponent(url)}&w=${width}&q=${quality}`;
}
