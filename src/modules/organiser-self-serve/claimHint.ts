// Pure, client-free: the unit spec imports it without a Supabase client.

export interface ClaimCandidate {
  id: string;
  name: string;
  slug: string | null;
  avatar_url: string | null;
  city_id: string | null;
  claimed_by: string | null;
  contact_email: string | null;
}

/**
 * What the onboarding list offers for one organiser. A HINT computed from
 * public columns; claim_organiser_v1 decides.
 */
export type ClaimHint = 'yours' | 'managed' | 'email_matches' | 'email_differs' | 'no_email';

const normEmail = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();

export function claimHint(
  candidate: Pick<ClaimCandidate, 'id' | 'claimed_by' | 'contact_email'>,
  user: { id: string; email?: string | null },
  myOrganiserIds: ReadonlySet<string>,
): ClaimHint {
  if (myOrganiserIds.has(candidate.id) || candidate.claimed_by === user.id) return 'yours';
  if (candidate.claimed_by) return 'managed';
  const listed = normEmail(candidate.contact_email);
  if (!listed) return 'no_email';
  return listed === normEmail(user.email) ? 'email_matches' : 'email_differs';
}
