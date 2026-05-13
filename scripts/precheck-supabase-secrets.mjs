#!/usr/bin/env node
/**
 * CI precheck: validate the shape of VITE_SUPABASE_URL +
 * VITE_SUPABASE_PUBLISHABLE_KEY before any downstream contract-check step
 * tries to use them.
 *
 * Why this exists
 * ---------------
 * Without this, a malformed `VITE_SUPABASE_URL` secret cascades through the
 * workflow: each contract step crashes inside `@supabase/supabase-js` with
 * the same opaque "Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL"
 * and stack trace, and every downstream step is short-circuited by
 * GitHub Actions' default `bash -e`. From `db-contract-check.yml` failing
 * 77 consecutive times since 2026-04-28, you can't tell from the surface
 * whether it's a code regression, a real contract violation, or a CI-only
 * secret-rot issue.
 *
 * This precheck runs FIRST, validates the secret's *shape* (not value), and
 * exits with a precise, masked-friendly diagnostic so the operator who
 * provisioned the secret knows exactly what needs fixing — without leaking
 * the secret itself into the workflow logs.
 *
 * Validation rules
 * ----------------
 * VITE_SUPABASE_URL
 *   - non-empty after trim
 *   - starts with `https://`
 *   - ends with `.supabase.co` (no trailing slash, no path)
 *   - host part matches a 20-char project-ref-shaped subdomain
 *     (`[a-z]{20}.supabase.co`); we don't enforce the literal value
 *     so the workflow stays portable across staging/preview projects
 *
 * VITE_SUPABASE_PUBLISHABLE_KEY
 *   - non-empty after trim
 *   - matches one of:
 *       * legacy anon JWT: starts with `eyJ` and has 2 dots (JWT structure)
 *       * new publishable key: starts with `sb_publishable_`
 *   - length sanity: >= 60 chars (rules out accidental ref-only paste)
 *
 * Output (no secret value ever printed)
 * -------------------------------------
 *   PASS — both secrets look valid
 *   FAIL — one or more diagnostic codes:
 *     - VITE_SUPABASE_URL: MISSING | EMPTY | NOT_HTTPS | WHITESPACE
 *                          TRAILING_SLASH | WRONG_DOMAIN | UNEXPECTED_PATH
 *                          BAD_REF_SHAPE
 *     - VITE_SUPABASE_PUBLISHABLE_KEY: MISSING | EMPTY | TOO_SHORT
 *                                       UNKNOWN_FORMAT | WHITESPACE
 *
 * Exit codes:
 *   0 — pass
 *   2 — config error (any FAIL code), fail the workflow immediately
 */

const url = process.env.VITE_SUPABASE_URL ?? '';
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

const urlErrors = [];
const keyErrors = [];

// ── URL validation ──────────────────────────────────────────────────────────
if (url === '') {
  urlErrors.push('MISSING (env var not set or unmasked-empty)');
} else if (url.trim() === '') {
  urlErrors.push('EMPTY (only whitespace)');
} else {
  const raw = url;
  const trimmed = raw.trim();

  if (trimmed !== raw) {
    urlErrors.push('WHITESPACE (leading or trailing — supabase-js trims, but lint flags this)');
  }
  if (!trimmed.startsWith('https://')) {
    urlErrors.push('NOT_HTTPS (must start with https://)');
  }
  if (trimmed.endsWith('/')) {
    urlErrors.push('TRAILING_SLASH (drop the trailing /)');
  }

  let host = '';
  try {
    host = new URL(trimmed).host;
  } catch {
    urlErrors.push('UNPARSEABLE (URL constructor rejected — likely bad scheme or chars)');
  }

  if (host) {
    if (!host.endsWith('.supabase.co')) {
      urlErrors.push(`WRONG_DOMAIN (host ends with ${JSON.stringify(host.slice(-20))}, expected .supabase.co)`);
    }
    const ref = host.replace(/\.supabase\.co$/, '');
    if (!/^[a-z]{20}$/.test(ref)) {
      urlErrors.push(`BAD_REF_SHAPE (project-ref part is ${ref.length} char(s), expected 20 lowercase letters)`);
    }
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname && parsed.pathname !== '/' && parsed.pathname !== '') {
      urlErrors.push(`UNEXPECTED_PATH (URL has path ${JSON.stringify(parsed.pathname)} — should be bare host)`);
    }
  } catch {
    /* already reported UNPARSEABLE */
  }
}

// ── KEY validation ──────────────────────────────────────────────────────────
if (key === '') {
  keyErrors.push('MISSING (env var not set or unmasked-empty)');
} else if (key.trim() === '') {
  keyErrors.push('EMPTY (only whitespace)');
} else {
  const raw = key;
  const trimmed = raw.trim();

  if (trimmed !== raw) {
    keyErrors.push('WHITESPACE (leading or trailing)');
  }
  if (trimmed.length < 60) {
    keyErrors.push(`TOO_SHORT (length ${trimmed.length}, expected >= 60 — likely ref-only paste)`);
  }

  const isJwt = trimmed.startsWith('eyJ') && trimmed.split('.').length === 3;
  const isNewPub = trimmed.startsWith('sb_publishable_');
  if (!isJwt && !isNewPub) {
    keyErrors.push('UNKNOWN_FORMAT (must be a JWT starting with "eyJ" with 3 segments OR a new publishable key starting with "sb_publishable_")');
  }
}

// ── Report ──────────────────────────────────────────────────────────────────
const hasErrors = urlErrors.length > 0 || keyErrors.length > 0;

if (hasErrors) {
  console.error('FAIL: Supabase secret precheck failed.\n');
  if (urlErrors.length > 0) {
    console.error('VITE_SUPABASE_URL:');
    for (const e of urlErrors) console.error('  - ' + e);
    console.error('');
  }
  if (keyErrors.length > 0) {
    console.error('VITE_SUPABASE_PUBLISHABLE_KEY:');
    for (const e of keyErrors) console.error('  - ' + e);
    console.error('');
  }
  console.error('Fix: GitHub → repo → Settings → Secrets and variables → Actions →');
  console.error('     edit the failing secret(s). Format reference:');
  console.error('     VITE_SUPABASE_URL              = https://<20-char-ref>.supabase.co');
  console.error('     VITE_SUPABASE_PUBLISHABLE_KEY  = eyJ… (anon JWT)  OR  sb_publishable_…');
  console.error('');
  console.error('Without this check, the next step crashes inside @supabase/supabase-js with');
  console.error('a cryptic stack trace and every downstream contract is silently un-watched.');
  process.exit(2);
}

console.log('PASS: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY look well-formed.');
process.exit(0);
