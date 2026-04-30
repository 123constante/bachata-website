import { supabase } from '@/integrations/supabase/client';
import { getViewerSession } from '@/lib/viewerSession';

// ─── emitProfileView ─────────────────────────────────────────────────────────
//
// Fire-and-forget click telemetry from PersonChip. Mirrors the existing
// useRecordEventView shape so both surfaces share the same anon-session
// dedupe model on the server (one row per person+session+UTC-day).
//
// Design rules:
//   • Telemetry NEVER blocks navigation. All errors are swallowed.
//   • SSR-safe — early-returns if window is unavailable.
//   • Server enforces bot-UA filter and admin-session skip; this util just
//     forwards what the browser knows. See record_profile_view_v1 in
//     migration 20260430170000.
//   • Profile-type is normalised + sanitised against the server's CHECK
//     constraint set so unknown values don't reject silently on the DB
//     side; they land as 'unknown' for later inspection.
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
  const lower = raw.toLowerCase().trim();
  return ALLOWED_PROFILE_TYPES.has(lower) ? lower : 'unknown';
};

export function emitProfileView(args: EmitProfileViewArgs): void {
  // SSR / non-browser contexts have no session; nothing to emit.
  if (typeof window === 'undefined') return;

  const sessionId = getViewerSession();
  if (!sessionId) return;

  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const profileType = sanitiseProfileType(args.profileType);

  // Fire-and-forget. supabase.rpc returns a thenable; we discard the result
  // and the error.  Swallowed errors are deliberate — never break navigation.
  void supabase
    .rpc('record_profile_view_v1' as any, {
      p_person_id: args.personId,
      p_profile_type: profileType,
      p_context: args.context,
      p_event_id: args.eventId ?? null,
      p_session_id: sessionId,
      p_user_agent: userAgent,
    })
    .then(
      () => undefined,
      () => undefined,
    );
}
