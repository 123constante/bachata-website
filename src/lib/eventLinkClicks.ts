// Bundle E.2 — public-event-page external-link click tracking.
//
// Records record_event_link_click_v1 via a fetch(..., { keepalive: true })
// POST so the request survives the browser tearing down the page on same-tab
// navigation (the click usually navigates away). It carries the same apikey +
// Authorization headers the supabase-js client uses (proven to work) and lets
// PostgREST map the JSON body keys to the function's named parameters.
//
// History: the original implementation tried navigator.sendBeacon first and
// fell back to fetch with `Prefer: params=single-object`. Both failed silently
// — the beacon couldn't authenticate, and that Prefer header is only valid for
// single-json-argument RPCs, so it broke this multi-arg call. Result: zero
// clicks ever recorded. This version uses one reliable path.
//
// Bot-UA filtering and per-session rate limiting live in the RPC. The client
// only needs to: skip when there's no event id, pass the viewer_session_id,
// and never block navigation (fire-and-forget, all errors swallowed).

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

export function recordEventLinkClick(args: RecordEventLinkClickArgs): void {
  if (!args.eventId) return;
  if (typeof window === 'undefined') return;
  if (!SUPABASE_URL || !SUPABASE_KEY) return;

  const sessionId = getViewerSessionId();
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const params = buildParams(args, sessionId, userAgent);
  if (!params) return;

  const url = SUPABASE_URL.replace(/\/$/, '') + RPC_PATH;

  // keepalive lets the POST outlive same-tab navigation (Chrome/Edge/Firefox
  // support it for bodies up to 64 KB, far above this payload). No Prefer
  // header → PostgREST maps the JSON keys to the RPC's named parameters.
  void fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify(params),
    keepalive: true,
    mode: 'cors',
    credentials: 'omit',
  }).catch(() => {
    /* swallow — never block navigation */
  });
}
