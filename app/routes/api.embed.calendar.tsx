// /api/embed/calendar — RESOURCE ROUTE (loader only, no component).
// Embeddable calendar widget for external sites (self-contained HTML page,
// intended for <iframe>). Public read, no auth.
//
// Delivered as a framework resource route, NOT a /api/*.ts serverless
// function: under the react-router preset + Build Output API, Vercel does
// not route the top-level /api functions (they fall through to the SSR
// handler — see app/routes/api.revalidate.tsx for the full diagnosis). This
// was previously api/embed/calendar.ts, silently broken in prod.
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
// Data source: get_public_events_list_v2 RPC.
import { supabase } from "@/integrations/supabase/client";
import {
  parsePublicEventsListRow,
  type PublicEventsListRow,
} from "../lib/publicEventsList";
import { wallClockTimeKey, type WallClock } from "@/lib/time/wallClock";
import type { Route } from "./+types/api.embed.calendar";

// The row shape is DERIVED from the regenerated schema (see eventRpcs.ts), not
// hand-declared here -- a hand-written interface silently drifts from the wire.
type WidgetEvent = PublicEventsListRow;

interface WidgetConfig {
  events: WidgetEvent[];
  city_slug: string | null;
  organiser_name: string | null;
  title: string | null;
  theme: "light" | "dark";
  layout: "list" | "cards";
  public_origin: string;
}

// ─── Renderer ────────────────────────────────────────────────────────────────

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(input: string | null | undefined): string {
  if (input == null) return "";
  return String(input).replace(/[&<>"']/g, (c) => HTML_ESCAPE_MAP[c]);
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatOccurrenceDate(yyyymmdd: string): { day: string; month: string; weekday: string } {
  const [y, m, d] = yyyymmdd.split("-").map((n) => parseInt(n, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return { day: "–", month: "", weekday: "" };
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  return {
    day: String(d).padStart(2, "0"),
    month: MONTH_ABBR[m - 1] ?? "",
    weekday: WEEKDAY_ABBR[dt.getUTCDay()] ?? "",
  };
}

// starts_at is a stored wall clock: render it AS STORED (never via new Date(),
// which would re-read it as an instant and shift the hour). wallClockTimeKey is
// byte-equal to the previous regex for the T-separated wire form, and also
// tolerates the space-separated form.
function formatStartTime(startsAt: WallClock): string {
  return wallClockTimeKey(startsAt) ?? "";
}

function eventDetailUrl(publicOrigin: string, eventId: string): string {
  const base = publicOrigin.replace(/\/+$/, "");
  return `${base}/event/${encodeURIComponent(eventId)}`;
}

function clampTitleStr(t: string | null | undefined, max = 120): string | null {
  if (!t) return null;
  const trimmed = String(t).slice(0, max).trim();
  return trimmed.length === 0 ? null : trimmed;
}

function defaultTitle(city: string | null, organiser: string | null): string {
  if (organiser) return `Upcoming events from ${organiser}`;
  if (city) return `Upcoming bachata events in ${city}`;
  return "Upcoming bachata events";
}

function renderEventRow(ev: WidgetEvent, publicOrigin: string): string {
  const { day, month, weekday } = formatOccurrenceDate(ev.occurrence_date);
  const time = formatStartTime(ev.starts_at);
  const url = eventDetailUrl(publicOrigin, ev.event_id);
  const venueLine = [ev.venue_name, ev.city_name].filter(Boolean).map(escapeHtml).join(", ");
  const type = ev.type ? ev.type.toLowerCase() : "";
  return `<li class="event"><a class="event-link" href="${escapeHtml(url)}" target="_top" rel="noopener"><div class="date" aria-label="${escapeHtml(`${weekday} ${day} ${month}`)}"><div class="weekday">${escapeHtml(weekday)}</div><div class="day">${escapeHtml(day)}</div><div class="month">${escapeHtml(month)}</div></div><div class="details"><div class="name">${escapeHtml(ev.name)}</div><div class="meta">${venueLine ? `<span class="venue">${venueLine}</span>` : ""}${time ? `<span class="time">${escapeHtml(time)}</span>` : ""}</div></div>${type ? `<span class="type type-${escapeHtml(type)}">${escapeHtml(type)}</span>` : ""}</a></li>`;
}

function renderEventCard(ev: WidgetEvent, publicOrigin: string): string {
  const { day, month, weekday } = formatOccurrenceDate(ev.occurrence_date);
  const time = formatStartTime(ev.starts_at);
  const url = eventDetailUrl(publicOrigin, ev.event_id);
  const venueLine = [ev.venue_name, ev.city_name].filter(Boolean).map(escapeHtml).join(", ");
  const type = ev.type ? ev.type.toLowerCase() : "";
  const cover = ev.cover_image_url ? escapeHtml(ev.cover_image_url) : "";
  return `<li class="card"><a class="card-link" href="${escapeHtml(url)}" target="_top" rel="noopener"><div class="card-cover" ${cover ? `style="background-image:url('${cover}')"` : ""}>${type ? `<span class="type type-${escapeHtml(type)}">${escapeHtml(type)}</span>` : ""}<div class="card-date"><span class="card-weekday">${escapeHtml(weekday)}</span><span class="card-day">${escapeHtml(day)}</span><span class="card-month">${escapeHtml(month)}</span></div></div><div class="card-body"><div class="name">${escapeHtml(ev.name)}</div><div class="meta">${venueLine ? `<span class="venue">${venueLine}</span>` : ""}${time ? `<span class="time">${escapeHtml(time)}</span>` : ""}</div></div></a></li>`;
}

function widgetCss(theme: "light" | "dark"): string {
  const isDark = theme === "dark";
  const vars = isDark
    ? `--bg:#000;--panel:#0b1220;--panel-2:#0f172a;--border:#1f2937;--text:#fff;--muted:#94a3b8;--accent:#f97316;--accent-fg:#fff;--shadow:0 1px 2px rgba(0,0,0,.4);`
    : `--bg:#fff;--panel:#fff;--panel-2:#f8fafc;--border:#e2e8f0;--text:#0f172a;--muted:#64748b;--accent:#f97316;--accent-fg:#fff;--shadow:0 1px 2px rgba(15,23,42,.06);`;
  return `:root{${vars}}*,*::before,*::after{box-sizing:border-box}html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:14px;line-height:1.4}.widget{padding:12px;max-width:720px;margin:0 auto}.header{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--border)}.header h1{margin:0;font-size:14px;font-weight:600;letter-spacing:.2px}.header .city{font-size:12px;color:var(--muted)}.events,.cards{list-style:none;margin:0;padding:0;display:grid;gap:8px}.cards{grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}.event{background:var(--panel);border:1px solid var(--border);border-radius:8px;box-shadow:var(--shadow)}.event-link{display:flex;align-items:center;gap:10px;padding:10px 12px;text-decoration:none;color:inherit}.event-link:hover{background:var(--panel-2)}.date{flex:0 0 56px;text-align:center;padding:6px 4px;background:var(--panel-2);border-radius:6px;border:1px solid var(--border)}.date .weekday{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted)}.date .day{font-size:20px;font-weight:700;line-height:1;margin:2px 0}.date .month{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted)}.details{flex:1 1 auto;min-width:0}.details .name{font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.details .meta{display:flex;flex-wrap:wrap;gap:6px 10px;color:var(--muted);font-size:12px;margin-top:2px}.type{flex:0 0 auto;font-size:10px;text-transform:uppercase;letter-spacing:.5px;padding:2px 6px;border-radius:999px;color:var(--accent-fg);background:var(--accent)}.type-course{background:#0ea5e9}.type-festival{background:#a855f7}.type-class{background:#10b981}.empty{padding:24px;text-align:center;color:var(--muted);font-size:13px;border:1px dashed var(--border);border-radius:8px}.footer{margin-top:10px;padding-top:8px;border-top:1px solid var(--border);text-align:right;font-size:11px;color:var(--muted)}.footer a{color:var(--muted);text-decoration:none}.footer a:hover{color:var(--accent)}.card{background:var(--panel);border:1px solid var(--border);border-radius:8px;overflow:hidden;box-shadow:var(--shadow)}.card-link{display:block;text-decoration:none;color:inherit}.card-link:hover .card-body{background:var(--panel-2)}.card-cover{aspect-ratio:16/9;background:var(--panel-2) center/cover no-repeat;position:relative}.card-date{position:absolute;left:8px;bottom:8px;background:rgba(0,0,0,.6);color:#fff;padding:4px 8px;border-radius:6px;display:flex;flex-direction:column;align-items:center;line-height:1}.card-weekday{font-size:9px;text-transform:uppercase;opacity:.85}.card-day{font-size:18px;font-weight:700;margin:2px 0}.card-month{font-size:9px;text-transform:uppercase;opacity:.85}.card-cover .type{position:absolute;right:8px;top:8px}.card-body{padding:10px 12px}.card-body .name{font-weight:600;font-size:14px;line-height:1.3;margin-bottom:4px}.card-body .meta{display:flex;flex-direction:column;gap:2px;color:var(--muted);font-size:12px}`;
}

function renderWidgetHtml(cfg: WidgetConfig): string {
  const title = clampTitleStr(cfg.title) ?? defaultTitle(cfg.city_slug, cfg.organiser_name);
  const cityLabel = cfg.city_slug ? cfg.city_slug.replace(/-/g, " ") : "";
  const css = widgetCss(cfg.theme);
  const items = cfg.events.length === 0
    ? `<div class="empty">No upcoming events.</div>`
    : cfg.layout === "cards"
      ? `<ul class="cards">${cfg.events.map((e) => renderEventCard(e, cfg.public_origin)).join("")}</ul>`
      : `<ul class="events">${cfg.events.map((e) => renderEventRow(e, cfg.public_origin)).join("")}</ul>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${css}</style>
</head>
<body>
<div class="widget" data-theme="${escapeHtml(cfg.theme)}">
<header class="header"><h1>${escapeHtml(title)}</h1>${cityLabel ? `<span class="city">${escapeHtml(cityLabel)}</span>` : ""}</header>
${items}
<div class="footer"><a href="${escapeHtml(cfg.public_origin)}" target="_top" rel="noopener">Powered by bachatacalendar.co.uk</a></div>
</div>
</body>
</html>`;
}

// ─── Param helpers ───────────────────────────────────────────────────────────

const PUBLIC_ORIGIN = "https://www.bachatacalendar.co.uk";

function asInt(v: string | null, dflt: number, min: number, max: number): number {
  if (v === null) return dflt;
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, n));
}

function asTheme(v: string | null): "light" | "dark" {
  return v === "light" ? "light" : "dark";
}

function asLayout(v: string | null): "list" | "cards" {
  return v === "cards" ? "cards" : "list";
}

function asDate(v: string | null): string | null {
  if (v === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return v;
}

function asUuid(v: string | null): string | null {
  if (v === null) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return null;
  return v;
}

function errorHtml(message: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Widget error</title></head><body style="font-family:system-ui;padding:20px;color:#475569;background:#f8fafc;font-size:13px"><p>${message}</p></body></html>`;
}

function htmlResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Override Vercel's default frame-ancestors 'none' so embeds work.
      "Content-Security-Policy": "frame-ancestors *",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=60",
      "Access-Control-Allow-Origin": "*",
      // No X-Frame-Options header at all — RR/Vercel don't force one on
      // framework routes the way the old /api/*.ts functions' platform
      // default did, so there's nothing to remove here.
    },
  });
}

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams;

  const params = {
    p_city_slug: q.get("city_slug"),
    p_from_date: asDate(q.get("from_date")),
    p_to_date: asDate(q.get("to_date")),
    p_organiser_id: asUuid(q.get("organiser_id")),
    p_type: q.get("type"),
    p_limit: asInt(q.get("limit"), 10, 1, 50),
    p_offset: 0,
  };

  // Typed call: no `as never`. Nullable filters become `undefined` so the RPC's
  // own DEFAULT NULL applies (PostgREST omits the key) -- same resulting query.
  // `params` itself keeps its nulls: it feeds the error log and city_slug below.
  const { data, error } = await supabase.rpc("get_public_events_list_v2", {
    p_city_slug: params.p_city_slug ?? undefined,
    p_from_date: params.p_from_date ?? undefined,
    p_to_date: params.p_to_date ?? undefined,
    p_organiser_id: params.p_organiser_id ?? undefined,
    p_type: params.p_type ?? undefined,
    p_limit: params.p_limit,
    p_offset: params.p_offset,
  });

  if (error) {
    console.error("[embed/calendar] rpc_error", { message: error.message, params });
    return htmlResponse(errorHtml("Could not load events."), 500);
  }

  const events: WidgetEvent[] = (data ?? []).map(parsePublicEventsListRow);

  const html = renderWidgetHtml({
    events,
    city_slug: params.p_city_slug,
    organiser_name: events[0]?.organiser_name ?? null,
    title: clampTitleStr(q.get("title")),
    theme: asTheme(q.get("theme")),
    layout: asLayout(q.get("layout")),
    public_origin: PUBLIC_ORIGIN,
  });

  return htmlResponse(html, 200);
}
