// 90-day viewer-session cookie. Bundle E.1.
//
// Single source of truth for `viewer_session_id`. Reads/writes a
// `viewer_session_id` cookie with a 90-day rolling Max-Age so we can
// stitch retention metrics across browser sessions. Falls back to
// sessionStorage if cookies are unavailable (private mode, denied
// permissions, etc.) and migrates the legacy `bcal_viewer_session`
// sessionStorage entry into the cookie on first read.
//
// All callers (errorReporter, profileViewEmit, searchTelemetry,
// useRecordEventView, OrganiserCardBlock) go through `getViewerSession`
// — keep that the canonical export. `getViewerSessionId` is an alias
// for new call sites that prefer the explicit name.

const COOKIE_NAME = 'viewer_session_id';
const LEGACY_STORAGE_KEY = 'bcal_viewer_session';
const NINETY_DAYS_SECONDS = 60 * 60 * 24 * 90;

function isSecureContext(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.protocol === 'https:';
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined' || !document.cookie) return null;
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function writeCookie(name: string, value: string): void {
  if (typeof document === 'undefined') return;
  const segments = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${NINETY_DAYS_SECONDS}`,
  ];
  if (isSecureContext()) segments.push('Secure');
  document.cookie = segments.join('; ');
}

function readLegacyStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(LEGACY_STORAGE_KEY);
  } catch {
    return null;
  }
}

function clearLegacyStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

let cached: string | null = null;

export function getViewerSessionId(): string {
  if (cached) return cached;
  if (typeof window === 'undefined') return '';

  const fromCookie = readCookie(COOKIE_NAME);
  if (fromCookie) {
    cached = fromCookie;
    // Refresh the rolling Max-Age on every read.
    writeCookie(COOKIE_NAME, fromCookie);
    return fromCookie;
  }

  // First read: migrate any pre-existing sessionStorage value into the cookie
  // so retention chains aren't reset for users that already had a session id.
  const legacy = readLegacyStorage();
  if (legacy) {
    writeCookie(COOKIE_NAME, legacy);
    clearLegacyStorage();
    cached = legacy;
    return legacy;
  }

  // Brand-new viewer.
  const fresh =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  writeCookie(COOKIE_NAME, fresh);
  // If the cookie write was rejected (e.g. cookies disabled), fall back to
  // sessionStorage so the same value is at least stable within the tab.
  if (!readCookie(COOKIE_NAME)) {
    try {
      window.sessionStorage.setItem(LEGACY_STORAGE_KEY, fresh);
    } catch {
      /* ignore */
    }
  }
  cached = fresh;
  return fresh;
}

// Back-compat alias — existing callers import `getViewerSession`. Keep this
// export; do not rename without sweeping all call sites.
export function getViewerSession(): string {
  return getViewerSessionId();
}
