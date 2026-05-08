// Public-vendor-page external-link click tracking.
//
// Calls record_vendor_link_click_v1. Mirrors the eventLinkClicks contract:
// fire-and-forget via navigator.sendBeacon with a fetch-keepalive fallback.
// Bot-UA filtering and per-session rate limiting both live in the RPC.

import { getViewerSessionId } from '@/lib/viewerSession';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export type VendorLinkType =
  | 'website'
  | 'instagram'
  | 'facebook'
  | 'whatsapp'
  | 'promo_copy'
  | 'public_email'
  | 'share'
  | 'other';

export interface RecordVendorLinkClickArgs {
  vendorId: string | null | undefined;
  linkType: VendorLinkType;
  targetUrl?: string | null;
  source?: string | null;
}

interface RpcParams {
  p_vendor_id: string;
  p_link_type: VendorLinkType;
  p_target_url: string | null;
  p_session_id: string | null;
  p_source: string | null;
  p_user_agent: string;
}

const RPC_PATH = '/rest/v1/rpc/record_vendor_link_click_v1';

function buildParams(args: RecordVendorLinkClickArgs, sessionId: string, userAgent: string): RpcParams | null {
  if (!args.vendorId) return null;
  return {
    p_vendor_id: args.vendorId,
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
    /* swallow — never block navigation */
  });
}

export function recordVendorLinkClick(args: RecordVendorLinkClickArgs): void {
  if (!args.vendorId) return;
  if (typeof window === 'undefined') return;
  if (!SUPABASE_URL || !SUPABASE_KEY) return;

  const sessionId = getViewerSessionId();
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const params = buildParams(args, sessionId, userAgent);
  if (!params) return;

  const url = SUPABASE_URL.replace(/\/$/, '') + RPC_PATH;
  const body = JSON.stringify(params);

  if (sendViaBeacon(`${url}?apikey=${encodeURIComponent(SUPABASE_KEY)}`, body)) return;
  sendViaFetchKeepalive(url, body, SUPABASE_KEY);
}
