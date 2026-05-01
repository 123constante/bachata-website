// Bundle E.2 â€” public-event-page external-link click tracking.
//
// Calls record_event_link_click_v1 on the admin Supabase project. Uses
// `navigator.sendBeacon` when available so the request survives the
// browser tearing down the page on same-tab navigation, and falls back
// to a `fetch(..., { keepalive: true })` POST to the same REST endpoint
// when sendBeacon refuses or fails (some Supabase deploys reject
// beacons because the apikey/Authorization headers aren't carried).
//
// Bot-UA filtering and per-session rate limiting both live in the RPC.
// The client only needs to:
//   - skip when there's no event id,
//   - pass the viewer_session_id so the RPC can apply its 30-clicks-per-
//     hour cap,
//   - never block navigation (fire-and-forget, all errors swallowed).

import { getViewerSessionId } from '@/lib/viewerSession';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export type EventLinkType =
  | 'ticket'
  | 'instagram'
  | 'whatsapp'
  | 'share'
  | 'organiser_external'
  | 'other';

export interface RecordEventLinkClickArgs {
  eventId: string | null | undefined;
  linkType: EventLinkType;
  targetUrl?: string | null;
  source?: string | null;
}

interface RpcParams {
  p_event_id: string;
  p_link_type: EventLinkType;
  p_target_url: string | null;
  p_session_id: string | null;
  p_source: string | null;
  p_user_agent: string;
}

const RPC_PATH = '/rest/v1/rpc/record_event_link_click_v1';

function buildParams(args: RecordEventLinkClickArgs, sessionId: string, userAgent: string): RpcParams | null {
  if (!args.eventId) return null;
  return {
    p_event_id: args.eventId,
    p_link_type: args.linkType,
    p_target_url: args.targetUrl ?? null,
    p_session_id: sessionId || null,
    p_source: args.source ?? null,
    p_user_agent: userAgent,
  };
}

function sendViaBeacon(url: string, body: string): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
    return false;
  }
  try {
    const blob = new Blob([body], { type: 'application/json' });
    return navigator.sendBeacon(url, blob);
  } catch {
    return false;
  }
}

function sendViaFetchKeepalive(url: string, body: string, apiKey: string): void {
  // keepalive lets the request survive page navigation â€” Chrome / Edge /
  // Firefox all support it for POSTs up to 64 KB, well above our payload.
  void fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      Prefer: 'params=single-object',
    },
    body,
    keepalive: true,
    mode: 'cors',
    credentials: 'omit',
  }).catch(() => {
    /* swallow â€” never block navigation */
  });
}

export function recordEventLinkClick(args: RecordEventLinkClickArgs): void {
  if (!args.eventId) return;
  if (typeof window === 'undefined') return;
  if (!SUPABASE_URL || !SUPABASE_KEY) return;

  const sessionId = getViewerSessionId();
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const params = buildParams(args, sessionId, userAgent);
  if (!params) return;

  const url = SUPABASE_URL.replace(/\/$/, '') + RPC_PATH;
  const body = JSON.stringify(params);

  // sendBeacon strips custom headers, so Supabase's apikey/Authorization
  // can't be attached. We try it anyway â€” some deployments accept the
  // anon role on RPC POSTs without the apikey header â€” and fall through
  // to fetch+keepalive whenever beacon refuses or returns false.
  if (sendViaBeacon(`${url}?apikey=${encodeURIComponent(SUPABASE_KEY)}`, body)) return;
  sendViaFetchKeepalive(url, body, SUPABASE_KEY);
}
