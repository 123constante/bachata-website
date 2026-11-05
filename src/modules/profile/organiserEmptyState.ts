/**
 * Which empty state the public organiser page shows. One decision, read by
 * src/pages/OrganiserProfile.tsx and pinned by
 * src/pages/__tests__/OrganiserProfileEmpty.matrix.test.tsx over every events
 * shape prod holds.
 *
 * - 'owner-blank': the signed-in owner or manager (anyone who can edit), and the profile has nothing at all yet
 *   (no bio, contact links, team or nights) -- prompt them to complete it.
 * - 'none': no nights listed, ever. Shown whatever else the profile has: a bio
 *   or contact links used to hide it, leaving "0 upcoming dates / 0 past
 *   nights" and nothing saying what the visitor can do (live QA KB-2,
 *   /organisers/bachata-connect, /organisers/crouch-end).
 * - 'past-only': past nights but nothing upcoming -- say so before the past
 *   list, with somewhere to go.
 * - null: still loading, or something is upcoming.
 */
export type OrganiserEmptyKind = 'owner-blank' | 'none' | 'past-only';

export function organiserEmptyState(s: {
  loading: boolean;
  upcoming: number;
  past: number;
  hasBio: boolean;
  hasContact: boolean;
  team: number;
  canEdit: boolean;
}): OrganiserEmptyKind | null {
  if (s.loading || s.upcoming > 0) return null;
  if (s.past > 0) return 'past-only';
  if (s.canEdit && !s.hasBio && !s.hasContact && s.team === 0) return 'owner-blank';
  return 'none';
}

/**
 * The one quiet line a visitor sees when nothing is upcoming (ACCEPTANCE S4
 * copy): above "Recently hosted" when there are past nights, alone when there
 * are none. It names no city (E6: the old copy hardcoded London for every
 * organiser). Never shown while a feed has failed -- the caller passes null then.
 */
export const NO_DATES_ANNOUNCED = 'No dates announced yet';
