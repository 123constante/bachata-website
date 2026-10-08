/**
 * Which empty state the public organiser page shows. One decision, read by
 * src/pages/OrganiserProfile.tsx and pinned by
 * src/pages/__tests__/OrganiserProfileEmpty.matrix.test.tsx over every events
 * shape prod holds.
 *
 * - 'owner-blank': the signed-in owner, and the profile has nothing at all yet
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
  isOwner: boolean;
}): OrganiserEmptyKind | null {
  if (s.loading || s.upcoming > 0) return null;
  if (s.past > 0) return 'past-only';
  if (s.isOwner && !s.hasBio && !s.hasContact && s.team === 0) return 'owner-blank';
  return 'none';
}
