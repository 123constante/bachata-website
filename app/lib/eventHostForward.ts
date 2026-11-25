import { EVENT_SUBDOMAIN_DOMAIN, parseEventHost } from "./eventSubdomain";

// Event subdomain hosts only serve their own event (/event/<label>, reached via
// the vercel.json rewrite). Every OTHER path on such a host is forwarded to the
// same path on www. Pure: the root loader calls it with the request host + URL.

const EXEMPT_PREFIXES = ["/assets/", "/api/", "/_vercel/"];
const STATIC_FILE_RE = /\.(?:png|jpe?g|ico|svg|webp|avif|gif|woff2?|webmanifest|txt|xml|js|css|map)$/i;

/** www URL to 302 to, or null when the request must be served as is. */
export function eventHostForwardUrl(
  rawHost: string | null | undefined,
  pathname: string,
  search: string = "",
): string | null {
  const host = parseEventHost(rawHost);
  if (host.kind === "none") return null;
  if (pathname === `/event/${host.label}` || pathname.startsWith(`/event/${host.label}/`)) return null;
  if (EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  if (STATIC_FILE_RE.test(pathname)) return null;
  // React Router single-fetch data requests (/x.data, /_root.data): never forward,
  // a redirect here would send the browser to a www .data URL.
  if (pathname.endsWith(".data")) return null;
  return `https://www.${EVENT_SUBDOMAIN_DOMAIN}${pathname}${search}`;
}
