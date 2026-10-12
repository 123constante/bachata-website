// Tiny home-made browser error reporter (replaces the Sentry SDK removed on
// 2026-09-13 for page weight). Sends one row per distinct failure to the
// `report_client_error_v1` RPC so a broken save or a render crash is visible
// before someone complains.
//
// NEVER ON THE FIRST-LOAD PATH. Every caller reaches this module through the
// one dynamic `import()` in src/lib/reportClientErrorLazy.ts -- app/root.tsx
// installs it on idle, and the error boundaries, the global mutation hook and
// saveMyDancerProfile load it only when they have something to report. A
// static import from any of those would put it into every route's first load;
// tests/clientErrorReporterLazy.test.ts fails if one appears.
//
// PRIVACY. The server scrubs too, but nothing personal may leave the browser:
// the message is the error NAME plus the FIRST LINE of its message only (no
// stack frames), with emails, uuids, JWT-like tokens, long digit runs, query
// strings and quoted input values replaced; the route is location.pathname
// only. No user id, no form values.
//
// NOISE. Each fingerprint is sent at most once per page load and at most
// MAX_REPORTS_PER_LOAD in total. Failures that are the visitor's connection,
// browser extension or a benign browser quirk are dropped (shouldIgnore).
//
// NEVER THROWS, NEVER AWAITED. Every entry point is wrapped in try/catch and
// the RPC is fire-and-forget; a failed report is silently dropped.

// Deliberately NOT importing '@/lib/staleChunk': a module shared between this
// lazy chunk and the first-load graph gets split into its own chunk, which
// cost every route one extra first-load request (chunk ratchet). The error
// boundaries already skip stale-chunk errors before calling in, and on the
// window path vite:preloadError reloads the page (app/entry.client.tsx).
// For the same reason this module imports NOTHING, the supabase client
// included: see sendReport below.

export type ClientErrorKind = 'error' | 'unhandledrejection' | 'render' | 'save_failed';

export type ClientErrorReport = {
  p_kind: ClientErrorKind;
  p_message: string;
  p_route: string;
  p_release: string;
  p_fingerprint: string;
};

export const MAX_REPORTS_PER_LOAD = 5;
export const MAX_MESSAGE_CHARS = 200;
const MAX_ROUTE_CHARS = 200;
const MAX_RELEASE_CHARS = 64;

const EXTENSION_RE = /(chrome|moz|safari|safari-web|ms-browser)-extension:\/\//i;
// The visitor's connection, not our bug: Chrome / Safari / Firefox wordings of
// a fetch that never reached a server (supabase-js prefixes "TypeError: ").
const OFFLINE_RE = /^(TypeError: )?(Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.?)$/;

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const EMAIL_RE = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const JWT_RE = /eyJ[\w-]+\.[\w-]+(\.[\w-]+)?/g;
// A query string or fragment glued to a path/URL. No lookbehind: older iOS
// Safari cannot parse one, and a parse error would silently disable reporting.
const QUERY_RE = /([\w/.-])[?#][^\s"'<>]*/g;
// Postgres echoes the offending INPUT in quotes after a colon
// (`invalid input syntax for type uuid: "..."`); constraint/relation names
// appear without the colon and are kept.
const QUOTED_INPUT_RE = /: "[^"]*"/g;
const LONG_DIGITS_RE = /\d{6,}/g;

type ErrorLike = { name?: unknown; message?: unknown; filename?: unknown; stack?: unknown };

function asErrorLike(input: unknown): ErrorLike {
  if (input && typeof input === 'object') {
    // A React Router route error response (a 5xx from a loader) carries no
    // message; describe it by status. Its `data` is a body and is never sent.
    const r = input as { status?: unknown; statusText?: unknown; message?: unknown };
    if (typeof r.status === 'number' && r.message === undefined) {
      return { name: 'RouteErrorResponse', message: `${r.status} ${typeof r.statusText === 'string' ? r.statusText : ''}`.trim() };
    }
    return input as ErrorLike;
  }
  return { message: input === undefined || input === null ? '' : String(input) };
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Error name + first line of its message, scrubbed and truncated. */
export function describeError(input: unknown): string {
  const e = asErrorLike(input);
  const name = str(e.name) || (input instanceof Error ? 'Error' : '');
  const firstLine = str(e.message).split(/\r?\n/, 1)[0].trim();
  const raw = name && firstLine && !firstLine.startsWith(name) ? `${name}: ${firstLine}` : firstLine || name || 'Unknown error';
  return scrub(raw).slice(0, MAX_MESSAGE_CHARS);
}

export function scrub(text: string): string {
  return text
    .replace(JWT_RE, '<token>')
    .replace(QUERY_RE, '$1')
    .replace(EMAIL_RE, '<email>')
    .replace(UUID_RE, '<uuid>')
    .replace(QUOTED_INPUT_RE, ': "<value>"')
    .replace(LONG_DIGITS_RE, '<n>');
}

/** True for failures that are not ours to fix (see the NOISE note above). */
export function shouldIgnore(input: unknown, filename?: string): boolean {
  const e = asErrorLike(input);
  const name = str(e.name);
  const message = str(e.message);
  if (name === 'AbortError') return true;
  if (message.includes('ResizeObserver loop')) return true;
  // Cross-origin script failure: the browser hides everything but this text.
  if (!(input instanceof Error) && (message === '' || /^Script error\.?$/.test(message))) return true;
  if (EXTENSION_RE.test(message) || EXTENSION_RE.test(str(e.stack)) || EXTENSION_RE.test(filename ?? '') || EXTENSION_RE.test(str(e.filename))) return true;
  if (OFFLINE_RE.test(message.trim())) return true;
  return false;
}

/** 16-hex FNV-1a (two seeds) -- stable across loads, no crypto dependency. */
function hash(text: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x5bd1e995);
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

export function fingerprintOf(kind: ClientErrorKind, message: string, route: string): string {
  const normalised = message.replace(UUID_RE, '<uuid>').replace(/\d+/g, '0');
  return hash(`${kind}|${normalised}|${route}`);
}

export type ReporterDeps = {
  /** Fire-and-forget transport; its rejection is swallowed. */
  send: (report: ClientErrorReport) => Promise<unknown> | void;
  /** False in dev/test builds and under Do Not Track. */
  enabled: () => boolean;
  pathname: () => string;
  release: string;
};

export type Reporter = {
  report: (kind: ClientErrorKind, error: unknown, extra?: { filename?: string }) => void;
  install: (target?: Pick<Window, 'addEventListener'>) => void;
};

export function createReporter(deps: ReporterDeps): Reporter {
  const seen = new Set<string>();
  let sent = 0;
  let installed = false;

  const report: Reporter['report'] = (kind, error, extra) => {
    try {
      if (sent >= MAX_REPORTS_PER_LOAD) return;
      if (!deps.enabled()) return;
      if (shouldIgnore(error, extra?.filename)) return;
      const message = describeError(error);
      // Path only; a uuid or long number in it is an id, never sent.
      const route = deps.pathname().split(/[?#]/, 1)[0].replace(UUID_RE, '<uuid>').replace(LONG_DIGITS_RE, '<n>').slice(0, MAX_ROUTE_CHARS);
      const fingerprint = fingerprintOf(kind, message, route);
      if (seen.has(fingerprint)) return;
      seen.add(fingerprint);
      sent += 1;
      const pending = deps.send({
        p_kind: kind,
        p_message: message,
        p_route: route,
        p_release: deps.release.slice(0, MAX_RELEASE_CHARS),
        p_fingerprint: fingerprint,
      });
      if (pending && typeof pending.then === 'function') pending.then(undefined, () => {});
    } catch {
      // A reporter must never become the next error.
    }
  };

  const install: Reporter['install'] = (target) => {
    try {
      if (installed) return;
      const win = target ?? (typeof window !== 'undefined' ? window : undefined);
      if (!win) return;
      installed = true;
      win.addEventListener('error', (ev: Event) => {
        const e = ev as ErrorEvent;
        report('error', e.error ?? { message: e.message }, { filename: e.filename });
      });
      win.addEventListener('unhandledrejection', (ev: Event) => {
        report('unhandledrejection', (ev as PromiseRejectionEvent).reason);
      });
    } catch {
      // see report()
    }
  };

  return { report, install };
}

function browserEnabled(): boolean {
  if (import.meta.env.DEV || import.meta.env.MODE === 'test') return false;
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const dnt = navigator.doNotTrack ?? (window as unknown as { doNotTrack?: string }).doNotTrack;
  return dnt !== '1';
}

// Raw PostgREST call, the same transport src/lib/webVitals.ts uses -- NOT a
// second supabase client (no GoTrue instance, no auth storage), and NOT the
// shared one either: reaching it from this chunk (rpcLoose/getSupabase) put an
// 8-file preload list into the first-load chunk that imports this module, and
// /classes had 150 B gz of budget headroom. Anon key only, on purpose: the RPC
// is anon-callable and a report must never carry the visitor's identity.
// keepalive lets a report made during pagehide still leave. The response is
// ignored: until the admin migration lands every call 404s, silently.
function sendReport(report: ClientErrorReport): Promise<unknown> | void {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || typeof fetch !== 'function') return;
  return fetch(`${url}/rest/v1/rpc/report_client_error_v1`, {
    method: 'POST',
    keepalive: true,
    headers: { 'content-type': 'application/json', apikey: key, authorization: `Bearer ${key}` },
    body: JSON.stringify(report),
  });
}

const defaultReporter = createReporter({
  send: sendReport,
  enabled: browserEnabled,
  pathname: () => (typeof location !== 'undefined' ? location.pathname : ''),
  release: import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA?.trim() || 'unknown',
});

export function reportClientError(kind: ClientErrorKind, error: unknown, extra?: { filename?: string }): void {
  defaultReporter.report(kind, error, extra);
}

export function installClientErrorReporter(): void {
  defaultReporter.install();
}

/**
 * The lazy loader's single entry (src/lib/reportClientErrorLazy.ts): no
 * arguments installs the window handlers; otherwise report `error` as `kind`
 * (default "render"). One short call site keeps the first-load caller small.
 */
export default function run(...args: [] | [error: unknown, kind?: ClientErrorKind]): void {
  if (args.length === 0) installClientErrorReporter();
  else reportClientError(args[1] ?? 'render', args[0]);
}
