// /api/embed/calendar — embeddable calendar widget for external sites.
//
// Returns a self-contained HTML page intended to be embedded via <iframe>.
// Public read, no auth, rate-limited by Vercel platform defaults.
//
// Query params:
//   city_slug      filter by city
//   from_date      YYYY-MM-DD (default: today)
//   to_date        YYYY-MM-DD (default: +60 days)
//   organiser_id   UUID
//   type           party | class | course | festival | workshop
//   limit          1-50 (default 10)
//   theme          light | dark (default dark)
//   layout         list | cards (default list)
//   title          override (max 120 chars)
//
// Data source: get_public_events_list_v1 RPC (same shape as /api/v1/events).
//
// Item #61 of the Event Editor Rebuild (Phase 3 — Growth & Moat).
// Originally targeted the Supabase Edge Function platform, but Supabase
// edge functions rewrite text/html → text/plain (documented limitation),
// so the widget was moved to a Vercel serverless function on the Website
// repo where Content-Type is honoured.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { renderWidgetHtml, clampTitle, type WidgetEvent } from './_template';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
const PUBLIC_ORIGIN = process.env.SITE_URL ?? 'https://bachatacalendar.co.uk';

function asString(v: string | string[] | undefined): string | null {
  if (v === undefined) return null;
  const s = Array.isArray(v) ? v[0] : v;
  const t = String(s ?? '').trim();
  return t.length === 0 ? null : t;
}

function asInt(v: string | string[] | undefined, dflt: number, min: number, max: number): number {
  const s = asString(v);
  if (s === null) return dflt;
  const n = parseInt(s, 10);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, n));
}

function asTheme(v: string | string[] | undefined): 'light' | 'dark' {
  return asString(v) === 'light' ? 'light' : 'dark';
}

function asLayout(v: string | string[] | undefined): 'list' | 'cards' {
  return asString(v) === 'cards' ? 'cards' : 'list';
}

function asDate(v: string | string[] | undefined): string | null {
  const s = asString(v);
  if (s === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function asUuid(v: string | string[] | undefined): string | null {
  const s = asString(v);
  if (s === null) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return null;
  return s;
}

function errorHtml(message: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Widget error</title></head><body style="font-family:system-ui;padding:20px;color:#475569;background:#f8fafc;font-size:13px"><p>${message}</p></body></html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).setHeader('Content-Type', 'text/html; charset=utf-8').send(errorHtml('Method not allowed.'));
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8').send(errorHtml('Widget not configured.'));
    return;
  }

  const q = req.query;
  const params = {
    p_city_slug:    asString(q.city_slug),
    p_from_date:    asDate(q.from_date),
    p_to_date:      asDate(q.to_date),
    p_organiser_id: asUuid(q.organiser_id),
    p_type:         asString(q.type),
    p_limit:        asInt(q.limit, 10, 1, 50),
    p_offset:       0,
  };

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.rpc('get_public_events_list_v1', params);

  if (error) {
    console.error('[embed/calendar] rpc_error', { message: error.message, params });
    res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8').send(errorHtml('Could not load events.'));
    return;
  }

  const events = (data ?? []) as WidgetEvent[];

  const html = renderWidgetHtml({
    events,
    city_slug:      params.p_city_slug,
    organiser_name: events[0]?.organiser_name ?? null,
    title:          clampTitle(asString(q.title)),
    theme:          asTheme(q.theme),
    layout:         asLayout(q.layout),
    public_origin:  PUBLIC_ORIGIN,
  });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Allow embedding from anywhere — that's the entire point.
  res.setHeader('Content-Security-Policy', 'frame-ancestors *');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Soft cache: 5 min at the edge, 1 min in the browser, 1 min stale.
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=60');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).send(html);
}
