// Cover/media images are stored as FULL-SIZE originals on the R2 media bucket
// (uploadToR2 does no resize/format step), so a 48px list thumbnail was costing
// a multi-MB download on mobile. Route every cover <img> through Vercel Image
// Optimization (/_vercel/image), which resizes + re-encodes (WebP) at the edge
// and caches the variant for minimumCacheTTL (31 days).
//
// HOST GATE -- READ BEFORE EDITING. This must list the host the DATABASE
// actually stores, not the host we wish it stored. It previously listed only
// `media.bachatacalendar.co.uk`, which does not resolve to R2 at all -- it is a
// dangling DNS record pointing at Vercel ("The deployment could not be found on
// Vercel"). Every stored URL is `pub-<id>.r2.dev`, so the gate never matched and
// this function silently returned the untouched multi-MB original on every call:
// image optimization was written, wired into every cover call site, and dead on
// arrival. Measured cost on prod: 5.94 MB of images on the homepage, 0 optimized,
// LCP 15-25s. If you ever move to a real custom domain, add it here rather than
// replacing these -- stored rows keep the r2.dev host until they are backfilled.
//
// A hostname MUST also appear in vercel.json images.remotePatterns or Vercel
// rejects the request with 400 INVALID_IMAGE_OPTIMIZE_REQUEST. `width` MUST be
// one of vercel.json's images.sizes and `quality` one of images.qualities.
// Keep imageCdn.ts, vercel.json and app/csp.ts in sync.
const OPTIMIZABLE_HOSTS = new Set([
  'pub-07f606224cac4f2596903c44df723644.r2.dev', // media bucket: covers, posters, avatars
  'pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev', // secondary media bucket
]);

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
