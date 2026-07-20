// /api/ics/calendar — RESOURCE ROUTE (loader only, no component). iCal
// subscription feed for external calendar apps (Google/Apple/Outlook poll
// this URL). Returns text/calendar (RFC 5545), upcoming events in the next
// 90 days.
//
// Delivered as a framework resource route, NOT a /api/*.ts serverless
// function: under the react-router preset + Build Output API, Vercel does
// not route the top-level /api functions (they fall through to the SSR
// handler — see app/routes/api.revalidate.tsx for the full diagnosis). This
// was previously api/ics/calendar.ts, silently broken in prod.
//
// Query params:
//   city_slug      filter by city (e.g. london-gb)
//   organiser_id   UUID — filter to one organiser's events
//   type           party | class | course | festival | workshop
//
// Subscribe via webcal:// or paste the https:// URL into any calendar app.
import { supabase } from "@/integrations/supabase/client";
import {
  parsePublicEventsListRow,
  type PublicEventsListRow,
} from "../lib/publicEventsList";
import { wallClockToInstant, type WallClock } from "@/lib/time/wallClock";
import type { Route } from "./+types/api.ics.calendar";

// The row shape is DERIVED from the regenerated schema (see eventRpcs.ts), not
// hand-declared here -- a hand-written interface silently drifts from the wire.
type FeedEvent = PublicEventsListRow;

// ─── ICS helpers (mirrors src/modules/event-page/bento/utils/ics.ts) ─────────

const compact = (d: Date): string =>
  d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

// Convert a stored local-as-UTC wall clock into a true UTC instant using the
// event timezone. Delegates to the shared, unit-tested wallClockToInstant rather
// than re-implementing the offset probe: the module version also tolerates the
// SPACE-separated wire form and falls back to Europe/London on a bad IANA zone,
// both of which the local copy silently failed (returning null = a dropped
// DTSTART).
const naiveLocalToCompactUtc = (
  wc: WallClock | null,
  timezone: string | null,
): string | null => {
  // `?? undefined` (not `|| "Europe/London"`): an explicit null would override
  // the parameter default rather than fall back to it.
  const instant = wallClockToInstant(wc, timezone ?? undefined);
  return instant ? compact(instant) : null;
};

const escapeIcsText = (v: string): string =>
  v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

const foldLine = (line: string): string => {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let i = 0;
  while (i < line.length) {
    chunks.push(line.slice(i, i + 75));
    i += 75;
  }
  return chunks.join("\r\n ");
};

function buildVEvent(ev: FeedEvent, nowStamp: string, publicOrigin: string): string {
  const dtStart = naiveLocalToCompactUtc(ev.starts_at, ev.city_timezone);
  const dtEnd = naiveLocalToCompactUtc(ev.ends_at ?? ev.starts_at, ev.city_timezone);
  const uid = `${ev.occurrence_id}@bachatacalendar.co.uk`;
  const url = `${publicOrigin}/event/${encodeURIComponent(ev.event_id)}`;
  const locationParts = [ev.venue_name, ev.venue_address].filter(Boolean) as string[];
  const location = locationParts.length ? locationParts.join(", ") : null;

  const descParts: string[] = [];
  if (ev.type) descParts.push(ev.type.charAt(0).toUpperCase() + ev.type.slice(1));
  if (ev.organiser_name) descParts.push(`By ${ev.organiser_name}`);
  descParts.push(url);

  const lines = [
    "BEGIN:VEVENT",
    foldLine(`UID:${uid}`),
    `DTSTAMP:${nowStamp}`,
    dtStart ? foldLine(`DTSTART:${dtStart}`) : null,
    dtEnd ? foldLine(`DTEND:${dtEnd}`) : null,
    foldLine(`SUMMARY:${escapeIcsText(ev.name)}`),
    location ? foldLine(`LOCATION:${escapeIcsText(location)}`) : null,
    foldLine(`DESCRIPTION:${escapeIcsText(descParts.join("\n"))}`),
    foldLine(`URL:${url}`),
    "END:VEVENT",
  ].filter((x): x is string => typeof x === "string");

  return lines.join("\r\n");
}

// ─── Param helpers ───────────────────────────────────────────────────────────

const PUBLIC_ORIGIN = "https://www.bachatacalendar.co.uk";

function asUuid(v: string | null): string | null {
  if (v === null) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return null;
  return v;
}

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams;
  const citySlug = q.get("city_slug");
  const organiserId = asUuid(q.get("organiser_id"));
  const type = q.get("type");

  const today = new Date();
  const fromDate = today.toISOString().split("T")[0];
  const toDate = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  // Typed call: no `as never`. Nullable filters become `undefined` so the RPC's
  // own DEFAULT NULL applies (PostgREST omits the key) -- same resulting query.
  const { data, error } = await supabase.rpc("get_public_events_list_v2", {
    p_city_slug: citySlug ?? undefined,
    p_from_date: fromDate ?? undefined,
    p_to_date: toDate ?? undefined,
    p_organiser_id: organiserId ?? undefined,
    p_type: type ?? undefined,
    p_limit: 200,
    p_offset: 0,
  });

  if (error) {
    console.error("[ics/calendar] rpc_error", { message: error.message });
    return new Response("Could not load events", { status: 500 });
  }

  const events: FeedEvent[] = (data ?? []).map(parsePublicEventsListRow);

  const cityName = events[0]?.city_name ?? (citySlug ? citySlug.split("-")[0] : null);
  const calName = cityName
    ? `Bachata Calendar — ${cityName.charAt(0).toUpperCase() + cityName.slice(1)}`
    : "Bachata Calendar";

  const nowStamp = compact(new Date());
  const vevents = events.map((ev) => buildVEvent(ev, nowStamp, PUBLIC_ORIGIN));

  const calLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bachata Calendar//Event Feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    foldLine(`X-WR-CALNAME:${escapeIcsText(calName)}`),
    "X-WR-TIMEZONE:Europe/London",
    "REFRESH-INTERVAL;VALUE=DURATION:P1D",
    "X-PUBLISHED-TTL:P1D",
    ...vevents,
    "END:VCALENDAR",
  ];

  const body = calLines.join("\r\n");

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="bachata-calendar.ics"',
      "Cache-Control": "public, max-age=3600, s-maxage=21600, stale-while-revalidate=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
