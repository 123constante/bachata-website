import type { ProfileGateValue } from '@/hooks/useAuth';
import type { ProfileField } from '@/lib/profileCompletion';

/**
 * What an organiser tap on Welcome does with the ONE completeness fact (ProfileGateContext,
 * which AppChrome already publishes: no new read). Owner pick no-city B (2026-10-28): the
 * screen looks the same for everyone, and the check runs at the tap, before any typing.
 * The server (_require_complete_dancer_profile_v1) still decides; this only moves its refusal
 * forward. Anything this copy cannot vouch for (loading, signed out, the read failed) opens
 * today's sheet, and a profile_incomplete refusal still routes to Finish profile.
 */
export type TapGate =
  | { kind: 'open' }
  | { kind: 'finish'; missing: readonly ProfileField[] }
  /** No dancer row at all (2 of 42 prod accounts): Finish profile has no form for it yet. */
  | { kind: 'no_row' };

export const tapGate = (gate: ProfileGateValue | 'loading' | null): TapGate => {
  if (!gate || gate === 'loading') return { kind: 'open' };
  if (gate.status === 'incomplete') return { kind: 'finish', missing: gate.missing };
  if (gate.status === 'no_profile') return { kind: 'no_row' };
  return { kind: 'open' };
};

/** Under the switched-off Claim it / Ask to join on the gate sheet (mockup no-city B, frames 3 and 4b). */
export const GATE_OFF_REASON = 'Finish your dancer profile first.';
/** True today: the gated Finish screen goes back to Welcome, search empty (no task carry, owner decision). */
export const GATE_RETURN_TEXT = 'When you are done you come back to Welcome; search for your page again.';
