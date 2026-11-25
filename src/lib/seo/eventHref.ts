import { flags } from '@/lib/featureFlags';

/** Reserved subdomain labels (never events). ONE client copy; the server copy is app/lib/eventSubdomain.ts (a test asserts equal). */
export const EVENT_SUBDOMAIN_RESERVED_LABELS: readonly string[] = [
  'www', 'api', 'admin', 'app', 'mail', 'cdn', 'static', 'assets', 'status', 'blog', 'docs',
];

const EVENT_SUBDOMAIN_DOMAIN = 'bachatacalendar.co.uk';
const SUBDOMAIN_LABEL_RE = /^[a-z0-9]+$/;

/**
 * URL for an event-detail page.
 *
 * Flag `eventSubdomainLinks` ON and a clean slug (`[a-z0-9]+`, not reserved) ->
 * `https://<slug>.bachatacalendar.co.uk/`. Otherwise (and always with the flag
 * OFF) the internal `/event/<slug-or-id>` path; falls back to the event UUID so
 * this is deploy-order-safe. `occurrenceId` is appended as `?occurrenceId=` so
 * the correct occurrence opens; the bot middleware canonicalises the slug URL.
 */
export function eventHref(
  event: { slug?: string | null; event_id: string },
  occurrenceId?: string | null,
): string {
  const slug = event.slug;
  const base =
    flags.eventSubdomainLinks &&
    slug &&
    SUBDOMAIN_LABEL_RE.test(slug) &&
    !EVENT_SUBDOMAIN_RESERVED_LABELS.includes(slug)
      ? `https://${slug}.${EVENT_SUBDOMAIN_DOMAIN}/`
      : `/event/${slug || event.event_id}`;
  return occurrenceId ? `${base}?occurrenceId=${occurrenceId}` : base;
}
