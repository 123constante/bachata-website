// Self-owned RUM (perf programme, Pillar D): report Core Web Vitals from real
// users to the `record_web_vital_v1` RPC so p75 LCP/INP/CLS by page is
// queryable in OUR data, not a third-party dashboard. Flag-gated OFF until the
// admin-repo migration ships the RPC (see PENDING_MIGRATIONS bridge); flipping
// VITE_ENABLE_RUM=true in Vercel env enables it with no code change.
//
// Design mirrors record_event_view_v1's client gating: bots excluded, sampled
// per-session, fire-and-forget (a lost beacon must never surface to the user).
// Uses fetch(keepalive) straight at PostgREST rather than supabase-js because
// web-vitals finalises LCP/CLS/INP at pagehide, where a normal fetch is killed.
import { flags } from '@/lib/featureFlags';

const SAMPLE_RATE = 0.2;
const SESSION_KEY = 'bc-rum-sampled';
const BOT_RE = /bot|crawl|spider|preview|lighthouse|headless|smoke/i;

type VitalMetric = {
  name: string;
  value: number;
  rating: string;
  navigationType?: string;
};

function sessionSampled(): boolean {
  try {
    const prior = sessionStorage.getItem(SESSION_KEY);
    if (prior !== null) return prior === '1';
    const sampled = Math.random() < SAMPLE_RATE;
    sessionStorage.setItem(SESSION_KEY, sampled ? '1' : '0');
    return sampled;
  } catch {
    return false; // storage blocked (private mode) -- skip rather than skew
  }
}

function report(metric: VitalMetric): void {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return;
  const body = JSON.stringify({
    p_metric: metric.name,
    // CLS is a unitless score ~0-1; store x1000 as an integer like the other
    // ms-valued metrics so the RPC takes one numeric column.
    p_value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
    p_rating: metric.rating,
    p_path: window.location.pathname,
    p_nav_type: metric.navigationType ?? null,
  });
  void fetch(`${url}/rest/v1/rpc/record_web_vital_v1`, {
    method: 'POST',
    keepalive: true,
    headers: {
      'content-type': 'application/json',
      apikey: key,
      authorization: `Bearer ${key}`,
    },
    body,
  }).catch(() => {
    /* fire-and-forget: RUM must never throw into the app */
  });
}

export function initWebVitals(): void {
  if (!flags.rum) return;
  if (typeof window === 'undefined') return;
  if (BOT_RE.test(navigator.userAgent)) return;
  if (!sessionSampled()) return;
  // Dynamic import keeps web-vitals out of the critical bundle entirely.
  void import('web-vitals')
    .then(({ onLCP, onINP, onCLS, onFCP, onTTFB }) => {
      onLCP(report);
      onINP(report);
      onCLS(report);
      onFCP(report);
      onTTFB(report);
    })
    .catch(() => {
      /* chunk failed to load (offline/stale deploy) -- silently skip */
    });
}
