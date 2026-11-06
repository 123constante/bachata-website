// Organiser analytics W1 -- capture `?ref=<code>` from the landing URL and hold
// it for the session so the two tracking writers can send it as `p_ref_code`.
//
// Contract (admin repo docs/organiser-analytics.md): the database stores a code
// only if it matches ^[a-z0-9]{6,12}$ exactly; anything else is stored untagged.
// So the client lower-cases, shape-checks, and sends nothing when absent or
// malformed. The code travels as `p_ref_code`, never inside `source`.

const REF_CODE_RE = /^[a-z0-9]{6,12}$/;
const STORAGE_KEY = 'bc_ref_code';

function normalise(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.toLowerCase();
  return REF_CODE_RE.test(code) ? code : null;
}

function read(): string | null {
  try {
    return normalise(window.sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Reads `ref` from a query string; a valid code replaces the held one. */
export function captureRefCode(search: string): string | null {
  let code: string | null = null;
  try {
    code = normalise(new URLSearchParams(search).get('ref'));
  } catch {
    code = null;
  }
  if (!code) return read();
  try {
    window.sessionStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* private mode / blocked storage -- never throw */
  }
  return code;
}

/** The held code, or null. Safe to call anywhere (SSR, private mode). */
export function refCodeForTracking(): string | null {
  if (typeof window === 'undefined') return null;
  return read();
}
