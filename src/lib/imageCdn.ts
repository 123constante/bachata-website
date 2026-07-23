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
    const { hostname, pathname } = new URL(url);
    if (!OPTIMIZABLE_HOSTS.has(hostname)) return url;
    // SVG passthrough. upload-validation.ts allows 'image/svg+xml', so SVGs do
    // reach R2. Vercel refuses to optimize SVG unless images.dangerouslyAllowSVG
    // is set (it isn't, and turning it on lets user-uploaded SVG execute script
    // on our origin) -- so an SVG here would 400 and render a broken image where
    // it renders fine today. Vectors gain nothing from raster resizing anyway:
    // serve them straight from the bucket.
    if (/\.svg$/i.test(pathname)) return url;
  } catch {
    return url; // relative/malformed URL -- leave untouched
  }
  return `/_vercel/image?url=${encodeURIComponent(url)}&w=${width}&q=${quality}`;
}

/** The widths Vercel will serve. MUST equal vercel.json images.sizes. */
const SIZES = [96, 160, 320, 480, 640, 960, 1280] as const;

/**
 * Smallest allowed source width that still covers `cssPx` at 3x DPR (~95% of
 * traffic is mobile, so assume retina rather than the 1x case). Use this instead
 * of hardcoding a width whenever the element's rendered size is a variable:
 * a literal silently under-serves the moment the box grows (a 52px avatar asking
 * for w=96 upscales 1.6x on a DPR-3 phone -- sharp before optimization, soft after).
 */
export function srcWidthFor(cssPx: number): number {
  const need = cssPx * 3;
  return SIZES.find((s) => s >= need) ?? SIZES[SIZES.length - 1];
}

/**
 * CSS background-image helper: `backgroundImage: cssUrl(poster, 480)`.
 * Same rewriting as optimizedImageUrl, but returns a ready `url(...)` value.
 * Background images are invisible to both an <img> sweep and the doc-weight
 * guard, so they are exactly where full-size originals hide.
 */
export function cssUrl(url: string | null | undefined, width: number, quality = 70): string | undefined {
  if (!url) return undefined;
  return `url(${optimizedImageUrl(url, width, quality)})`;
}
