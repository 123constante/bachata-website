import {
  RESERVED_LABELS,
  eventSubdomainLinksEnabled,
  isSubdomainLabel,
  isWwwOrApexHost,
  parseEventHost,
  parseNightPath,
} from "./eventSubdomain";

// www.bachatacalendar.co.uk/<name> forwards to <name>.bachatacalendar.co.uk when
// <name> is a live public event with a subdomain-able slug. Site pages always
// win: every single-segment path the app owns is listed here and never resolved.
// eventRootForward.test.ts regenerates this list from src/ and app/routes.ts and
// fails when a page is added without being listed.
const SITE_SEGMENTS = [
  // framework routes (app/routes.ts)
  "festivals", "parties", "classes", "faq", "for-organisers", "london-bachata-guide", "learn-bachata-london",
  "bachata-parties-london", "bachata-london-sensual-parties", "bachata-london-dominican-parties",
  "bachata-london-monday", "bachata-london-tuesday", "bachata-london-wednesday",
  "bachata-london-thursday", "bachata-london-friday", "bachata-london-saturday",
  "bachata-london-sunday", "sitemap.xml", "advertising-stop",
  // client routes (src/components/AnimatedRoutes.tsx and other route tables)
  "account", "all-profiles", "ambassador", "auth", "bachata-london", "choreography", "cities",
  "dancers", "discounts", "djs", "finish-profile", "home", "invite", "organisers",
  "practice-partners", "privacy", "profile", "raffles", "search", "start-organiser",
  "teachers", "terms", "tonight", "vendors", "venues", "videographers",
];

export const APP_PATHS: ReadonlySet<string> = new Set([
  ...SITE_SEGMENTS,
  ...RESERVED_LABELS,
]);

/** The lower-cased label to resolve as an event name, or null. */
export function rootForwardCandidate(
  host: string | null,
  seg: string,
  env: Record<string, string | undefined> = process.env,
): string | null {
  if (parseEventHost(host).kind !== "none") return null;
  if (!eventSubdomainLinksEnabled(env)) return null;
  if (!isWwwOrApexHost(host)) return null;
  if (parseNightPath(seg)) return null;
  const label = seg.toLowerCase();
  if (!isSubdomainLabel(label)) return null;
  if (APP_PATHS.has(label)) return null;
  return label;
}
