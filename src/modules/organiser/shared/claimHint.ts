// Pure, client-free: the unit spec imports it without a Supabase client.

export interface ClaimCandidate {
  id: string;
  name: string;
  slug: string | null;
  avatar_url: string | null;
  city_id: string | null;
}

/**
 * What the onboarding list offers for one organiser. Computed by the database
 * (organiser_claim_hints_v1) from the PRIVATE claim email and the memberships,
 * so the client never reads an address; claim_organiser_v1 still decides.
 */
export type ClaimHint = 'yours' | 'managed' | 'email_matches' | 'email_differs' | 'no_email';

/** A search result with the database's hint; null when the hint call failed (then only "ask to join" is offered). */
export type ClaimableOrganiser = ClaimCandidate & { hint: ClaimHint | null };
