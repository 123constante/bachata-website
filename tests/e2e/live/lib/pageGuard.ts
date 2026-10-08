import type { Page, Request } from '@playwright/test';

// Read-only guard + error collector for the live QA suite (tests/e2e/live).
//
// READ-ONLY AGAINST PRODUCTION. Every write the public site can make on a page
// view (record_event_view_v1, record_profile_view_v1, record_web_vital_v1, link
// and search click/query recorders) is answered in the browser with an empty
// 200, so a daily run never inflates analytics. Any OTHER write-shaped request
// to Supabase (a table POST/PATCH/DELETE, or an RPC whose name says it writes)
// is ABORTED and recorded as a finding: this suite must never write to prod,
// and a page that tries to on a plain view is itself a bug worth seeing.
//
// ERRORS. What counts as a client failure:
//   - any uncaught page error;
//   - any console.error, minus browser network noise ("Failed to load
//     resource" -- broken responses are judged by status below instead) and
//     React DEV-only "Warning:" lines (production React never prints them;
//     they appear only when the suite is pointed at `react-router dev`);
//   - React hydration errors in either build: minified #418/#421/#423/#425 and
//     the dev-mode "Hydration failed" / "did not match" texts. These are
//     matched BEFORE the dev-warning filter so a dev run cannot hide them;
//   - a same-origin SUBRESOURCE or data response >= 500. The document's own
//     status is kept apart (`documentStatus`) and never asserted here: for
//     paused/archived/ended/cancelled pages the status is another worker's
//     moving target, so the specs decide per shape whether it is a fact.

export const HYDRATION = [
  /Minified React error #(418|421|423|425)\b/,
  /react\.dev\/errors\/(418|421|423|425)\b/,
  /Hydration failed/i,
  /There was an error while hydrating/i,
  /Text content does not match server-rendered HTML/i,
  /did not match\. Server:/i,
];

const NETWORK_NOISE = [/^Failed to load resource/i];
// Environment-only noise, opt-in per run and never set in CI: e.g. a sandbox
// whose egress proxy cannot carry Supabase's realtime websocket sets
// LIVE_QA_IGNORE_CONSOLE='WebSocket connection to .*realtime'.
const EXTRA_IGNORE = process.env.LIVE_QA_IGNORE_CONSOLE ? [new RegExp(process.env.LIVE_QA_IGNORE_CONSOLE)] : [];
const DEV_ONLY = [/^Warning: /];

// Recorders the site calls on a page view or a click. Answered, never sent.
const RECORDER_RPC = /\/rest\/v1\/rpc\/record_[a-z0-9_]+/i;
// RPC names that write. Aborted and reported if a public page ever calls one.
const WRITE_RPC = /\/rest\/v1\/rpc\/(submit_|claim_|upsert_|create_|delete_|update_|set_|toggle_|rsvp|admin_|cancel_|send_)/i;
const SUPABASE_REST = /\/rest\/v1\//;

export type GuardFindings = {
  errors: string[];
  hydration: string[];
  writes: string[];
  documentStatus: number[];
};

/** Keep the head AND the tail: CSP and handshake errors put the cause last. */
export function clip(t: string, max = 420): string {
  return t.length <= max ? t : `${t.slice(0, 140)} ... ${t.slice(-(max - 145))}`;
}

export function classifyConsole(text: string): 'hydration' | 'error' | 'ignore' {
  if (HYDRATION.some((re) => re.test(text))) return 'hydration';
  if (NETWORK_NOISE.some((re) => re.test(text))) return 'ignore';
  if (EXTRA_IGNORE.some((re) => re.test(text))) return 'ignore';
  if (DEV_ONLY.some((re) => re.test(text))) return 'ignore';
  return 'error';
}

function isWriteAttempt(req: Request): boolean {
  const url = req.url();
  if (!SUPABASE_REST.test(url)) return false;
  if (RECORDER_RPC.test(url)) return false;
  if (WRITE_RPC.test(url)) return true;
  const m = req.method();
  return !url.includes('/rpc/') && (m === 'POST' || m === 'PATCH' || m === 'PUT' || m === 'DELETE');
}

const attached = new WeakMap<Page, GuardFindings>();

/** Idempotent per page: a second visit on the same page resets the findings. */
export async function guardPage(page: Page, origin: string): Promise<GuardFindings> {
  const prev = attached.get(page);
  if (prev) {
    for (const k of Object.keys(prev) as (keyof GuardFindings)[]) prev[k].length = 0;
    return prev;
  }
  const f: GuardFindings = { errors: [], hydration: [], writes: [], documentStatus: [] };
  attached.set(page, f);
  await page.route(RECORDER_RPC, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }),
  );
  await page.route(SUPABASE_REST, (route) => {
    const req = route.request();
    if (isWriteAttempt(req)) {
      f.writes.push(`${req.method()} ${req.url().split('?')[0]}`);
      return route.abort('blockedbyclient');
    }
    return route.fallback();
  });
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    const kind = classifyConsole(text);
    if (kind === 'hydration') f.hydration.push(clip(text));
    else if (kind === 'error') f.errors.push(`console: ${clip(text)}`);
  });
  page.on('pageerror', (e) => {
    const text = e.message;
    if (HYDRATION.some((re) => re.test(text))) f.hydration.push(clip(text));
    else f.errors.push(`pageerror: ${clip(text)}`);
  });
  page.on('response', (r) => {
    if (r.request().isNavigationRequest() && r.request().frame() === page.mainFrame()) {
      f.documentStatus.push(r.status());
      return;
    }
    if (r.status() >= 500 && r.url().startsWith(origin)) {
      f.errors.push(`HTTP ${r.status()} ${r.url().slice(origin.length).slice(0, 200)}`);
    }
  });
  return f;
}
