/**
 * The shapes of the dancer-area RPCs (briefs/dancer-rebuild-INTERFACE.md
 * sections 1 and 3). Server: admin repo PR A1. These types are the ONLY
 * client statement of them; wave-2 screens import from here.
 */

/** dancer_area_gate_v1() */
export type DancerGate = { open: boolean; allowed: boolean };

/** dancer_profiles.dance_role CHECK set (verified read-only on prod 2026-10-15). */
export const DANCE_ROLES = ['Leader', 'Follower', 'Lead and Follow'] as const;
export type DanceRole = (typeof DANCE_ROLES)[number];

/** strength.missing vocabulary, in priority order; next_step = the first missing item. */
export const STRENGTH_STEPS = ['first_name', 'city', 'role', 'photo', 'started_year', 'styles', 'bio_social'] as const;
export type StrengthStep = (typeof STRENGTH_STEPS)[number];

export type DancerStrength = { pct: number; next_step: StrengthStep | null; missing: StrengthStep[] };

/** my_dancer_edit_v1(), and what save_my_dancer_profile_v2 returns after a save. */
export type MyDancerEdit = {
  profile_id: string;
  user_id: string;
  display_name: string | null;
  first_name: string | null;
  surname: string | null;
  hide_surname_publicly: boolean;
  based_city_id: string | null;
  city_name: string | null;
  dance_role: DanceRole | null;
  nationality: string | null;
  languages: string[];
  bio: string | null;
  instagram: string | null;
  facebook: string | null;
  website_url: string | null;
  /** Only for a person with another profile type (other_roles non-empty); else null. */
  whatsapp: string | null;
  show_whatsapp_publicly: boolean;
  avatar_url: string | null;
  dance_started_year: number | null;
  favorite_styles: string[];
  favorite_songs: string[];
  achievements: string[];
  /** Active person_roles other than 'dancing', e.g. ['teaching', 'djing']. */
  other_roles: string[];
  /** false = paused via my_profile_disable_v1. */
  is_active: boolean;
  /** Always null in release 1a. */
  erase_requested_at: string | null;
  linked_from_admin: boolean;
  /** = profile_complete_v1(profile). */
  complete: boolean;
  strength: DancerStrength;
};

/** The keys save_my_dancer_profile_v2 accepts. Anything else is refused with `unknown_key`. */
export const SAVE_KEYS = [
  'display_name',
  'first_name',
  'surname',
  'based_city_id',
  'dance_role',
  'nationality',
  'languages',
  'bio',
  'instagram',
  'facebook',
  'website_url',
  'whatsapp',
  'show_whatsapp_publicly',
  'hide_surname_publicly',
  'avatar_url',
  'dance_started_year',
  'favorite_styles',
  'favorite_songs',
  'achievements',
] as const;
export type SaveKey = (typeof SAVE_KEYS)[number];

/**
 * A save payload: ABSENT key = leave as is; null / "" / [] = clear (except
 * first_name, based_city_id, avatar_url: replace-only). Send only what changed.
 */
export type DancerDelta = Partial<Pick<MyDancerEdit, SaveKey>>;

/** get_public_dancer_extras_v1(id): null for a hidden / paused / archived / unknown profile. */
export type PublicDancerExtras = { bio: string | null; languages: string[]; whatsapp: string | null } | null;

/**
 * Every error the dancer-area RPCs raise (INTERFACE section 3 table, plus
 * `unknown_key` from the save contract), and `unknown` for anything else
 * (network, a message we do not know). api/errors.ts must give each one copy;
 * TypeScript refuses a code here without an entry there, and
 * tests/client/dancerAppApi.test.tsx refuses it at runtime too.
 */
export const DANCER_ERROR_CODES = [
  'area_closed',
  'not_signed_in',
  'no_profile',
  'rate_limited',
  'invalid_display_name',
  'first_name_required',
  'city_required',
  'photo_required',
  'bio_too_long',
  'bio_has_link',
  'invalid_handle',
  'invalid_url',
  'invalid_year',
  'whatsapp_not_allowed',
  'invalid_role',
  'unknown_key',
  'unknown',
] as const;
export type DancerErrorCode = (typeof DANCER_ERROR_CODES)[number];

/** The field a code belongs to, so an Edit screen can put the message under the right input. */
export type DancerErrorField = SaveKey | null;
