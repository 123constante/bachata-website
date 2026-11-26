import {
  eventSubdomainOrigin,
  eventSubdomainTestLabels,
  isSubdomainLabel,
} from "./eventSubdomain";

// Organiser sub-addresses (step 2 of the sub-address work): https://<slug>.bachatacalendar.co.uk
// serves one public organiser. Host parsing, reserved labels and the one-label rule
// are REUSED from ./eventSubdomain (parseEventHost / RESERVED_LABELS / isSubdomainLabel),
// never copied. Everything here is behind ORGANISER_SUBDOMAIN_LINKS (default OFF).

/** Server env flag, read at call time. Default OFF: flag off = today's behaviour exactly. */
export function organiserSubdomainLinksEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.ORGANISER_SUBDOMAIN_LINKS === "true";
}

/** Server env ORGANISER_SUBDOMAIN_TEST_LABELS: comma list of labels served while the flag
 *  is OFF. Gates ONLY serving the host; redirects and the sitemap read the flag alone. */
export function organiserSubdomainTestLabels(env: Record<string, string | undefined> = process.env): string[] {
  return (env.ORGANISER_SUBDOMAIN_TEST_LABELS ?? "")
    .split(",")
    .map((l) => l.trim().toLowerCase())
    .filter(Boolean);
}

/** True when <label>.<domain> may try to serve an organiser: a real (non-reserved) label,
 *  and the flag ON or the label listed. */
export function organiserHostServable(label: string, env: Record<string, string | undefined> = process.env): boolean {
  const l = label.toLowerCase();
  if (!isSubdomainLabel(l)) return false;
  return organiserSubdomainLinksEnabled(env) || organiserSubdomainTestLabels(env).includes(l);
}

/** Canonical origin of an organiser on its own sub-address. */
export const organiserSubdomainOrigin = (slug: string): string => eventSubdomainOrigin(slug);
