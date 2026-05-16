// Canonical Person identity type for the public website.
//
// This is the single shape returned by RPCs that go through resolve_person_v1
// or resolve_epp_person_v1 (get_event_program_v1, get_occurrence_program_v1,
// get_public_festival_detail).
//
// Architecture: the DB resolver is the only place that knows how to answer
// "who is this person and what's their photo?". This type is the wire shape
// of that answer.
//
// This file is hand-aligned with the admin repo's canonical Person type at
// c:\dev\bachata-admin-11april\lib\types\Person.ts. Keep them identical
// (the architecture decision is to duplicate, not monorepo).
//
// Migration pattern for existing local types:
//   - `Person` in EventScheduleGrid.tsx: composes this Person + UI extras
//     (href, role, level). Going forward, new schedule-style types should
//     spell out the composition explicitly:
//       type SessionPerson = Person & { href: string | null; role: string; level: SessionLevel | null };
//     The existing Person export from EventScheduleGrid is preserved for
//     back-compat; new code should import the identity shape from here.
//   - parsers in useEventPageQuery / useFestivalDetailQuery: prefer
//     parsePerson() / parseArtist() that yield this shape.

export type ProfileType =
  | 'teacher'
  | 'dj'
  | 'dancer'
  | 'organiser'
  | 'videographer'
  | 'vendor';

export const PROFILE_TYPES: ReadonlyArray<ProfileType> = [
  'teacher',
  'dj',
  'dancer',
  'organiser',
  'videographer',
  'vendor',
] as const;

export function isProfileType(v: unknown): v is ProfileType {
  return typeof v === 'string' && (PROFILE_TYPES as readonly string[]).includes(v);
}

/**
 * The canonical person identity shape. Returned by every RPC that resolves
 * a person/entity through resolve_person_v1.
 *
 * - `id` is the canonical id (dancer_profiles.id for teacher/dj/dancer;
 *   entities.id for organiser; videographers.id / vendors.id for those).
 * - `profileType` is the linkage discriminator. Same id can have multiple
 *   profileTypes across different program links — they share the same
 *   identity row but render in different contexts.
 * - `displayName` is the resolved name. `null` only when no source row
 *   has any name at all (rare; surface as initials in UI).
 * - `avatarUrl` is the resolved photo URL. `null` when no live source has
 *   an avatar.
 */
export type Person = {
  id: string;
  profileType: ProfileType;
  displayName: string | null;
  avatarUrl: string | null;
};

/**
 * Parse the snake_case RPC payload into a camelCase Person. Returns null
 * for malformed input rather than throwing; callers filter out nulls.
 */
export function parsePerson(raw: unknown): Person | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const idRaw = o.profile_id ?? o.id;
  const id = typeof idRaw === 'string' && idRaw.length > 0 ? idRaw : null;
  const profileTypeRaw = o.profile_type;
  if (!id || !isProfileType(profileTypeRaw)) return null;
  const displayName =
    typeof o.display_name === 'string' && o.display_name.trim().length > 0
      ? o.display_name
      : null;
  const avatarUrl =
    typeof o.avatar_url === 'string' && o.avatar_url.length > 0
      ? o.avatar_url
      : null;
  return { id, profileType: profileTypeRaw, displayName, avatarUrl };
}

/**
 * Initials fallback for the no-avatar / failed-to-load case. Matches
 * the pattern in PersonChip / PeopleStack / OrganiserAvatar render primitives.
 */
export function initialsFor(person: Pick<Person, 'displayName'>): string {
  const name = person.displayName ?? '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}
