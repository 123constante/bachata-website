// Cloudflare WAF bypass for the production probes. See docs/ops/ci-bypass-header.md.
//
// The owner's Cloudflare rule SKIPS the challenge for a request carrying
// `X-CI-Bypass: <secret>` (GitHub Actions secret CI_BYPASS_HEADER). The value
// is a credential: it is sent to the production host ONLY, never to a Vercel
// preview, Supabase, Google or any other third party, and never logged.

/** The one production host constant (check-og-images.mjs re-uses it). */
export const PROD_HOST = 'www.bachatacalendar.co.uk';

/** `{ 'x-ci-bypass': value }` when CI_BYPASS_HEADER is set and non-blank, else `{}`.
 *  Throws (without echoing the value) on CR/LF or anything outside printable ASCII. */
export function ciBypassHeaders(env = process.env) {
  const value = String(env.CI_BYPASS_HEADER ?? '').trim();
  if (!value) return {};
  if (!/^[\x20-\x7e]+$/.test(value)) {
    throw new Error('ciBypassHeader: CI_BYPASS_HEADER must be printable ASCII with no CR/LF (value withheld).');
  }
  return { 'x-ci-bypass': value };
}

/** True only for an https URL whose host is exactly the production host. */
export function isProductionUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === PROD_HOST;
  } catch {
    return false;
  }
}

/** The bypass header for `url`: `{}` unless the target is the production host. */
export function ciBypassHeadersFor(url, env = process.env) {
  return isProductionUrl(url) ? ciBypassHeaders(env) : {};
}
