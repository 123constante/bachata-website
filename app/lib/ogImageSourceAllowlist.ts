// Where /api/og/card and /api/og/bake may fetch an image from. Both fetch
// server-side from a URL that is not theirs (a `src` query param, a cover URL
// out of the DB), so without this the endpoint is an open SSRF.
//
// ONE mapping: the first three hosts are vercel.json images.remotePatterns
// (pinned by tests/ogImageSourceAllowlist.test.ts, which fails if the lists
// differ); the rest are the extras seen in prod image columns (2026-10-21
// survey). example.com test rows are deliberately absent -- they fall back to
// the default card.
export const OG_IMAGE_SOURCE_HOSTS: readonly string[] = [
  // vercel.json images.remotePatterns
  "pub-07f606224cac4f2596903c44df723644.r2.dev",
  "pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev",
  "media.bachatacalendar.co.uk",
  // extras
  "stsdtacfauprzrdebmzg.supabase.co",
  "images.unsplash.com",
  "www.bachatacalendar.co.uk",
  "bachatacalendar.co.uk",
];

// Supabase serves the whole REST/auth API on the same host; only public
// storage objects are images.
const PATH_PREFIX: Readonly<Record<string, string>> = {
  "stsdtacfauprzrdebmzg.supabase.co": "/storage/v1/object/public/",
};

const HOSTS: ReadonlySet<string> = new Set(OG_IMAGE_SOURCE_HOSTS);

export function isAllowedOgImageSource(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  if (u.port) return false;
  // WHATWG URL already lower-cases the host; IP literals (v4 or [v6]) can
  // never equal a listed name, but are refused by name too, not by accident.
  const host = u.hostname.toLowerCase();
  if (host.startsWith("[") || /^[\d.]+$/.test(host)) return false;
  if (!HOSTS.has(host)) return false;
  const prefix = PATH_PREFIX[host];
  return prefix === undefined || u.pathname.startsWith(prefix);
}
