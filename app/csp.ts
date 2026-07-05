// Content-Security-Policy for SSR document responses. Set per-request in
// entry.server (NOT vercel.json — a static header there can't carry the
// per-request nonce, and a duplicate CSP header would intersect and re-break
// hydration). Mirrors the directives that used to live in vercel.json, with the
// one change that matters for framework mode: script-src uses a per-request
// 'nonce-…' instead of 'unsafe-inline', so RR7's inline hydration script runs
// under a strict policy. style-src keeps 'unsafe-inline' (framer-motion / inline
// styles; per-style nonces are impractical).
export function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://pub-07f606224cac4f2596903c44df723644.r2.dev https://*.r2.dev https://*.supabase.co https://flagcdn.com https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev https://*.basemaps.cartocdn.com",
    "media-src 'self' blob: https://*.r2.dev https://*.supabase.co",
    "connect-src 'self' https://*.r2.cloudflarestorage.com https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io",
    "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}
