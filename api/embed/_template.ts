// HTML rendering for the embeddable calendar widget served at
// /api/embed/calendar. Pure module — exported helpers are unit-tested under
// Vitest without a Vercel runtime.
//
// Filename prefix "_" prevents Vercel from auto-routing this file as an
// endpoint (only files without a leading underscore become serverless
// endpoints in /api).

export interface WidgetEvent {
  event_id: string;
  occurrence_id: string;
  name: string;
  type: string | null;
  occurrence_date: string;          // YYYY-MM-DD (already in city tz per RPC)
  starts_at: string;                // wall-clock-as-Z ISO string
  ends_at: string | null;
  city_slug: string | null;
  city_name: string | null;
  city_timezone: string | null;
  venue_id: string | null;
  venue_name: string | null;
  venue_address: string | null;
  organiser_id: string | null;
  organiser_name: string | null;
  cover_image_url: string | null;
  is_recurring: boolean;
}

export interface WidgetConfig {
  events: WidgetEvent[];
  city_slug: string | null;
  organiser_name: string | null;
  title: string | null;
  theme: 'light' | 'dark';
  layout: 'list' | 'cards';
  public_origin: string;            // e.g. https://bachatacalendar.co.uk
}

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(input: string | null | undefined): string {
  if (input == null) return '';
  return String(input).replace(/[&<>"']/g, (c) => HTML_ESCAPE_MAP[c]);
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatOccurrenceDate(yyyymmdd: string): { day: string; month: string; weekday: string } {
  // YYYY-MM-DD treated as a calendar date (no TZ shift). Build a Date with
  // UTC components so the weekday isn't shifted by the host TZ.
  const [y, m, d] = yyyymmdd.split('-').map((n) => parseInt(n, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return { day: '–', month: '', weekday: '' };
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  return {
    day: String(d).padStart(2, '0'),
    month: MONTH_ABBR[m - 1] ?? '',
    weekday: WEEKDAY_ABBR[dt.getUTCDay()] ?? '',
  };
}

export function formatStartTime(startsAtIso: string): string {
  // Per the project's "wall-clock-as-Z" convention for occurrence times, we
  // display the UTC HH:MM verbatim — that already IS the local wall clock.
  const m = startsAtIso.match(/T(\d{2}):(\d{2})/);
  if (!m) return '';
  return `${m[1]}:${m[2]}`;
}

export function eventDetailUrl(publicOrigin: string, eventId: string): string {
  // The public Website uses /event/:id (singular). Strip trailing slash.
  const base = publicOrigin.replace(/\/+$/, '');
  return `${base}/event/${encodeURIComponent(eventId)}`;
}

/** Cap untrusted query inputs that flow into the HTML title bar. */
export function clampTitle(t: string | null | undefined, max = 120): string | null {
  if (!t) return null;
  const trimmed = String(t).slice(0, max).trim();
  return trimmed.length === 0 ? null : trimmed;
}

function defaultTitle(city: string | null, organiser: string | null): string {
  if (organiser) return `Upcoming events from ${organiser}`;
  if (city) return `Upcoming bachata events in ${city}`;
  return 'Upcoming bachata events';
}

function renderEmpty(message: string): string {
  return `<div class="empty">${escapeHtml(message)}</div>`;
}

function renderEventRow(ev: WidgetEvent, publicOrigin: string): string {
  const { day, month, weekday } = formatOccurrenceDate(ev.occurrence_date);
  const time = formatStartTime(ev.starts_at);
  const url = eventDetailUrl(publicOrigin, ev.event_id);
  const venueLine = [ev.venue_name, ev.city_name].filter(Boolean).map(escapeHtml).join(', ');
  const type = ev.type ? ev.type.toLowerCase() : '';

  return `<li class="event"><a class="event-link" href="${escapeHtml(url)}" target="_top" rel="noopener"><div class="date" aria-label="${escapeHtml(`${weekday} ${day} ${month}`)}"><div class="weekday">${escapeHtml(weekday)}</div><div class="day">${escapeHtml(day)}</div><div class="month">${escapeHtml(month)}</div></div><div class="details"><div class="name">${escapeHtml(ev.name)}</div><div class="meta">${venueLine ? `<span class="venue">${venueLine}</span>` : ''}${time ? `<span class="time">${escapeHtml(time)}</span>` : ''}</div></div>${type ? `<span class="type type-${escapeHtml(type)}">${escapeHtml(type)}</span>` : ''}</a></li>`;
}

function renderEventCard(ev: WidgetEvent, publicOrigin: string): string {
  const { day, month, weekday } = formatOccurrenceDate(ev.occurrence_date);
  const time = formatStartTime(ev.starts_at);
  const url = eventDetailUrl(publicOrigin, ev.event_id);
  const venueLine = [ev.venue_name, ev.city_name].filter(Boolean).map(escapeHtml).join(', ');
  const type = ev.type ? ev.type.toLowerCase() : '';
  const cover = ev.cover_image_url ? escapeHtml(ev.cover_image_url) : '';

  return `<li class="card"><a class="card-link" href="${escapeHtml(url)}" target="_top" rel="noopener"><div class="card-cover" ${cover ? `style="background-image:url('${cover}')"` : ''}>${type ? `<span class="type type-${escapeHtml(type)}">${escapeHtml(type)}</span>` : ''}<div class="card-date"><span class="card-weekday">${escapeHtml(weekday)}</span><span class="card-day">${escapeHtml(day)}</span><span class="card-month">${escapeHtml(month)}</span></div></div><div class="card-body"><div class="name">${escapeHtml(ev.name)}</div><div class="meta">${venueLine ? `<span class="venue">${venueLine}</span>` : ''}${time ? `<span class="time">${escapeHtml(time)}</span>` : ''}</div></div></a></li>`;
}

function widgetCss(theme: 'light' | 'dark'): string {
  const isDark = theme === 'dark';
  const vars = isDark
    ? `--bg:#000;--panel:#0b1220;--panel-2:#0f172a;--border:#1f2937;--text:#fff;--muted:#94a3b8;--accent:#f97316;--accent-fg:#fff;--shadow:0 1px 2px rgba(0,0,0,.4);`
    : `--bg:#fff;--panel:#fff;--panel-2:#f8fafc;--border:#e2e8f0;--text:#0f172a;--muted:#64748b;--accent:#f97316;--accent-fg:#fff;--shadow:0 1px 2px rgba(15,23,42,.06);`;

  return `:root{${vars}}*,*::before,*::after{box-sizing:border-box}html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:14px;line-height:1.4}.widget{padding:12px;max-width:720px;margin:0 auto}.header{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--border)}.header h1{margin:0;font-size:14px;font-weight:600;letter-spacing:.2px}.header .city{font-size:12px;color:var(--muted)}.events,.cards{list-style:none;margin:0;padding:0;display:grid;gap:8px}.cards{grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}.event{background:var(--panel);border:1px solid var(--border);border-radius:8px;box-shadow:var(--shadow)}.event-link{display:flex;align-items:center;gap:10px;padding:10px 12px;text-decoration:none;color:inherit}.event-link:hover{background:var(--panel-2)}.date{flex:0 0 56px;text-align:center;padding:6px 4px;background:var(--panel-2);border-radius:6px;border:1px solid var(--border)}.date .weekday{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted)}.date .day{font-size:20px;font-weight:700;line-height:1;margin:2px 0}.date .month{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted)}.details{flex:1 1 auto;min-width:0}.details .name{font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.details .meta{display:flex;flex-wrap:wrap;gap:6px 10px;color:var(--muted);font-size:12px;margin-top:2px}.type{flex:0 0 auto;font-size:10px;text-transform:uppercase;letter-spacing:.5px;padding:2px 6px;border-radius:999px;color:var(--accent-fg);background:var(--accent)}.type-course{background:#0ea5e9}.type-festival{background:#a855f7}.type-class{background:#10b981}.empty{padding:24px;text-align:center;color:var(--muted);font-size:13px;border:1px dashed var(--border);border-radius:8px}.footer{margin-top:10px;padding-top:8px;border-top:1px solid var(--border);text-align:right;font-size:11px;color:var(--muted)}.footer a{color:var(--muted);text-decoration:none}.footer a:hover{color:var(--accent)}.card{background:var(--panel);border:1px solid var(--border);border-radius:8px;overflow:hidden;box-shadow:var(--shadow)}.card-link{display:block;text-decoration:none;color:inherit}.card-link:hover .card-body{background:var(--panel-2)}.card-cover{aspect-ratio:16/9;background:var(--panel-2) center/cover no-repeat;position:relative}.card-date{position:absolute;left:8px;bottom:8px;background:rgba(0,0,0,.6);color:#fff;padding:4px 8px;border-radius:6px;display:flex;flex-direction:column;align-items:center;line-height:1}.card-weekday{font-size:9px;text-transform:uppercase;opacity:.85}.card-day{font-size:18px;font-weight:700;margin:2px 0}.card-month{font-size:9px;text-transform:uppercase;opacity:.85}.card-cover .type{position:absolute;right:8px;top:8px}.card-body{padding:10px 12px}.card-body .name{font-weight:600;font-size:14px;line-height:1.3;margin-bottom:4px}.card-body .meta{display:flex;flex-direction:column;gap:2px;color:var(--muted);font-size:12px}`;
}

export function renderWidgetHtml(cfg: WidgetConfig): string {
  const title = clampTitle(cfg.title) ?? defaultTitle(cfg.city_slug, cfg.organiser_name);
  const cityLabel = cfg.city_slug ? cfg.city_slug.replace(/-/g, ' ') : '';
  const css = widgetCss(cfg.theme);
  const items = cfg.events.length === 0
    ? renderEmpty('No upcoming events.')
    : cfg.layout === 'cards'
      ? `<ul class="cards">${cfg.events.map((e) => renderEventCard(e, cfg.public_origin)).join('')}</ul>`
      : `<ul class="events">${cfg.events.map((e) => renderEventRow(e, cfg.public_origin)).join('')}</ul>`;

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
<header class="header"><h1>${escapeHtml(title)}</h1>${cityLabel ? `<span class="city">${escapeHtml(cityLabel)}</span>` : ''}</header>
${items}
<div class="footer"><a href="${escapeHtml(cfg.public_origin)}" target="_top" rel="noopener">Powered by bachatacalendar.co.uk</a></div>
</div>
</body>
</html>`;
}
