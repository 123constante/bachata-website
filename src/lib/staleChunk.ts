// Stale-chunk detection + once-per-session reload, shared by main.tsx
// (vite:preloadError), AnimatedRoutes.tsx (lazyWithRetry), and the error
// boundaries. After a Vercel deploy, cached HTML references hashed chunk URLs
// that no longer exist; the SPA rewrite then serves index.html for the missing
// /assets/*.js, which WebKit rejects as "'text/html' is not a valid JavaScript
// MIME type" (BACHATA-WEBSITE-1/-3/-11). One reload picks up fresh HTML; the
// sessionStorage flag prevents reload loops when a chunk genuinely can't load.

export const CHUNK_RELOAD_KEY = 'chunk-reload-attempted';

const STALE_CHUNK_RE =
  /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|is not a valid JavaScript MIME type|Unable to preload CSS/i;

export function isStaleChunkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return STALE_CHUNK_RE.test(msg);
}

function safeGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* storage unavailable — reload anyway, the loop risk is preferable to a dead page */
  }
}

export function chunkReloadAttempted(): boolean {
  return safeGet(CHUNK_RELOAD_KEY) === '1';
}

export function clearChunkReloadFlag(): void {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    /* ignore */
  }
}

// Returns true if a reload was initiated (callers should stop rendering error
// UI); false if a reload was already attempted this session.
export function attemptChunkReloadOnce(): boolean {
  if (chunkReloadAttempted()) return false;
  safeSet(CHUNK_RELOAD_KEY, '1');
  window.location.reload();
  return true;
}
