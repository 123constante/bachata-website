// Dependency-free leaf module (mirrors app/truncate.ts, app/edgeCacheControl.ts):
// zero imports, by design. middleware.ts (Edge runtime) imports this file
// directly -- an Edge Function bundle can only resolve import-free modules
// (#272). app/detailLoader.ts (SSR loaders) imports the same definition: the
// two hand-copies it replaces both broke link previews on the same day.

// The site's own hostnames. A URL on one of these (or on the request's own
// host) is a SITE page or route and is moved onto the host the crawler
// fetched. Any other subdomain is NOT the site: media.bachatacalendar.co.uk is
// the R2 bucket's custom domain, and its paths (e.g. /events/og/...) 404 on www.
const SITE_HOSTS = new Set(["bachatacalendar.co.uk", "www.bachatacalendar.co.uk"]);

// og:image MUST be an absolute URL on the host the crawler actually fetched.
// Two failure modes this guards against, both of which make WhatsApp/Facebook
// drop the preview card:
//   1. SITE_URL is the apex domain (bachatacalendar.co.uk) while the page is
//      served from www -- apex->www is a 308 redirect, and crawlers don't follow
//      redirects on og:image.
//   2. SITE_URL is unset/empty, so the builders emit a host-less relative URL
//      ("/api/og/card?...") which is not a valid og:image at all.
// Resolving against the request origin and pinning site hosts to it fixes
// both, enforcing the og:url <-> og:image host invariant regardless of SITE_URL.
// Media-host URLs are left alone: the bucket serves them directly with a 200.
export function sameHostImage(imageUrl: string, requestOrigin: string): string {
  try {
    const ro = new URL(requestOrigin);
    // base resolves a relative imageUrl (case 2) against the request origin;
    // an absolute imageUrl ignores the base and keeps its own host.
    const img = new URL(imageUrl, ro);
    if (img.hostname === ro.hostname || SITE_HOSTS.has(img.hostname.toLowerCase())) {
      img.protocol = ro.protocol;
      img.host = ro.host;
      return img.toString();
    }
  } catch {
    /* unparseable even with a base -- leave as-is */
  }
  return imageUrl;
}
