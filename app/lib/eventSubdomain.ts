import { londonTodayKey } from "@/lib/londonDate";

// Event subdomains (brief D1, #2147): https://<label>.bachatacalendar.co.uk is
// one event, https://<label>.bachatacalendar.co.uk/19-dec is one night of it.
// Pure host/path parsing + the server flag + reserved labels. vercel.json maps
// the subdomain host onto the existing /event/:id route (rewrite); the checks
// that need the DB or the flag (miss -> www, www.<label> -> bare) live in the
// /event loader and read this module.

export const EVENT_SUBDOMAIN_DOMAIN = "bachatacalendar.co.uk";
export const EVENT_SUBDOMAIN_WWW_HOME = `https://www.${EVENT_SUBDOMAIN_DOMAIN}/`;

/** Labels that are infrastructure, never events. Keep in sync with vercel.json. */
export const RESERVED_LABELS: readonly string[] = [
  "www", "api", "admin", "app", "mail", "cdn", "static", "assets", "status", "blog", "docs",
];

/** Server env flag, read at call time (pattern: OG_BRANDED_CARD_ENABLED). Default OFF. */
export function eventSubdomainLinksEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.EVENT_SUBDOMAIN_LINKS === "true";
}

export type EventHost =
  | { kind: "none" } // www, apex, *.vercel.app, localhost, reserved: behaves as today
  | { kind: "event"; label: string } // <label>.bachatacalendar.co.uk
  | { kind: "www-event"; label: string }; // www.<label>.bachatacalendar.co.uk

const LABEL_RE = /^[a-z0-9]+$/;
const SUFFIX = `.${EVENT_SUBDOMAIN_DOMAIN}`;

export function parseEventHost(rawHost: string | null | undefined): EventHost {
  if (!rawHost) return { kind: "none" };
  // A proxy may send "a.example, b.example"; the first is the client-facing one.
  const host = rawHost.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  if (!host.endsWith(SUFFIX)) return { kind: "none" };
  const prefix = host.slice(0, -SUFFIX.length);
  if (prefix.startsWith("www.")) {
    const label = prefix.slice(4);
    return LABEL_RE.test(label) && !RESERVED_LABELS.includes(label)
      ? { kind: "www-event", label }
      : { kind: "none" };
  }
  return LABEL_RE.test(prefix) && !RESERVED_LABELS.includes(prefix) ? { kind: "event", label: prefix } : { kind: "none" };
}

/** True when a CURRENT event slug can live on its own subdomain: one DNS label
 *  (no dashes yet) and not infrastructure. The one copy of this rule (D2a). */
export const isSubdomainLabel = (slug: string | null | undefined): slug is string =>
  !!slug && LABEL_RE.test(slug) && !RESERVED_LABELS.includes(slug);

/** Hosts whose /event/<ref> forwards to the subdomain (never *.vercel.app previews). */
export const isWwwOrApexHost = (rawHost: string | null | undefined): boolean => {
  const host = (rawHost ?? "").split(",")[0].trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  return host === `www.${EVENT_SUBDOMAIN_DOMAIN}` || host === EVENT_SUBDOMAIN_DOMAIN;
};

/** Canonical URL of an event page on its own subdomain (night pages canonical to this). */
export const eventSubdomainOrigin = (label: string): string => `https://${label}${SUFFIX}`;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const NIGHT_RE = /^\/?(\d{1,2})-([a-z]{3})(?:-(\d{4}))?\/?$/;

export type NightSpec = { day: number; month: number; year: number | null };

/** "/19-dec", "3-jan", "/19-dec-2027" -> {day, month(1-12), year|null}; anything else null. */
export function parseNightPath(path: string | null | undefined): NightSpec | null {
  if (!path) return null;
  const m = NIGHT_RE.exec(path.toLowerCase());
  if (!m) return null;
  const month = MONTHS.indexOf(m[2]) + 1;
  const day = Number(m[1]);
  if (month < 1 || day < 1 || day > 31) return null;
  return { day, month, year: m[3] ? Number(m[3]) : null };
}

/**
 * Pick the occurrence for a night, matched on the London calendar date key
 * (YYYY-MM-DD, as the snapshot's localDate carries it). No year: nearest
 * upcoming night with that day+month, else the most recent past one. No match
 * -> null (caller serves the plain event page, never a 404).
 */
export function pickNightOccurrenceId(
  occurrences: ReadonlyArray<{ occurrenceId: string; localDate: unknown }>,
  spec: NightSpec,
  todayKey: string = londonTodayKey(),
): string | null {
  const mm = String(spec.month).padStart(2, "0");
  const dd = String(spec.day).padStart(2, "0");
  const hits: Array<{ key: string; id: string }> = [];
  for (const o of occurrences) {
    const key = typeof o.localDate === "string" ? o.localDate.slice(0, 10) : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    if (key.slice(5) !== `${mm}-${dd}`) continue;
    if (spec.year !== null && key.slice(0, 4) !== String(spec.year)) continue;
    hits.push({ key, id: o.occurrenceId });
  }
  if (hits.length === 0) return null;
  hits.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const upcoming = hits.find((h) => h.key >= todayKey);
  return (upcoming ?? hits[hits.length - 1]).id;
}
