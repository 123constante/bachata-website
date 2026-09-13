import { getViewerSession } from '@/lib/viewerSession';
import { flags } from '@/lib/featureFlags';

// ─── emitProfileView ─────────────────────────────────────────────────────────
//
// Fire-and-forget click telemetry from PersonChip. Mirrors the existing
// useRecordEventView shape so both surfaces share the same anon-session
// dedupe model on the server (one row per person+session+UTC-day).
//
// Phase 2: Moved from Supabase RPC → external Vercel KV storage ($0.20/GB vs $100+/GB).
// Still enforces the same session-per-day deduplication, just faster and cheaper.
//
// Design rules:
//   • Telemetry NEVER blocks navigation. All errors are swallowed.
//   • SSR-safe — early-returns if window is unavailable.
//   • Profile-type is normalised + sanitised so unknown values land as 'unknown'
//     for later inspection (matches pre-Phase-2 server behavior).
//   • POST to /api/analytics/profile-view (see app/routes/api.analytics.profile-view.tsx).
//
// See plan_person_discoverability.md (Bachata Calendar PM workspace).

export interface EmitProfileViewArgs {
  /** Polymorphic profile id (dancer_profiles.id, organiser_profiles.id, …). */
  personId: string;
  /** One of dancer | teacher | dj | organiser | videographer | vendor. */
  profileType: string | null | undefined;
  /** Where the click came from. e.g. 'schedule:single-room',
   *  'schedule:multi-room', 'schedule:multi-room-party', 'search',
   *  'festival-lineup'. Free-form but should be human-readable for analytics. */
  context: string;
  /** When the click originates from a specific event surface (schedule
   *  rows, related-events strips), pass it for organiser-attribution. */
  eventId?: string | null;
}

const ALLOWED_PROFILE_TYPES = new Set([
  'dancer',
  'teacher',
  'dj',
  'organiser',
  'videographer',
  'vendor',
]);

const sanitiseProfileType = (raw: string | null | undefined): string => {
  if (!raw) return 'unknown';
  const lower = String(raw).toLowerCase().trim();
  return ALLOWED_PROFILE_TYPES.has(lower) ? lower : 'unknown';
};

export function emitProfileView(args: EmitProfileViewArgs): void {
  // Profile view tracking is disabled during Phase 1 IO optimization.
  // Re-enable once analytics are moved to external storage (Phase 2).
  if (!flags.enableProfileTracking) return;

  // SSR / non-browser contexts have no session; nothing to emit.
  if (typeof window === 'undefined') return;

  // Skip automated/headless agents (build-time prerender sets navigator.webdriver)
  // so nightly snapshots of the 100+ profile pages don't log fake profile views.
  if (typeof navigator !== 'undefined' && navigator.webdriver) return;

  const sessionId = getViewerSession();
  if (!sessionId) return;

  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const profileType = sanitiseProfileType(args.profileType);

  // Fire-and-forget POST to /api/analytics/profile-view (Phase 2: Vercel KV).
  // Errors are swallowed — telemetry must never block navigation.
  void fetch('/api/analytics/profile-view', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personId: args.personId,
      profileType,
      context: args.context,
      eventId: args.eventId ?? null,
      sessionId,
      userAgent,
    }),
  }).catch(() => {
    // Fail silently — telemetry errors must never reach the console
  });
}
